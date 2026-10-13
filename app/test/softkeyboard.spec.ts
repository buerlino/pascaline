// SPDX-License-Identifier: GPL-3.0-or-later
// Regression (user, 2026-10-12): the Android system keyboard opened when switching apps. Our keypad is the only
// keyboard, so whatever element has focus after a switch must keep the system keyboard closed: inputmode=none
// and no EditContext (CodeMirror uses Chrome's EditContext on Android, which ignores inputmode).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** The focused element, looking into shadow roots, and whether it could summon the system keyboard. */
const focused = (page: Page) =>
  page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!el || el === document.body) return { editable: false, inputmode: null, editContext: false, tag: "none" };
    const h = el as HTMLElement & { editContext?: unknown };
    const editContext = (h.editContext ?? null) !== null;
    const editable = h.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "INPUT" || editContext;
    return { editable, inputmode: el.getAttribute("inputmode"), editContext, tag: el.tagName };
  });

async function expectNoSystemKeyboard(page: Page, where: string): Promise<void> {
  await page.waitForTimeout(100); // the apps focus their editor in a microtask after showing
  const f = await focused(page);
  if (!f.editable) return;
  expect(f.editContext, `${where}: ${f.tag} uses EditContext`).toBe(false);
  expect(f.inputmode, `${where}: ${f.tag} inputmode`).toBe("none");
}

test("switching apps never focuses an element that opens the system keyboard", async ({ page }) => {
  await expectNoSystemKeyboard(page, "Home");
  await tap(page, ["symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expectNoSystemKeyboard(page, "Function Symb");
  await tap(page, ["apps", "d3"]);
  await expect(page.locator('[data-app="python"]')).toBeVisible();
  await expect(page.getByTestId("python")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await tap(page, ["symb"]);
  await expectNoSystemKeyboard(page, "Python editor");
  await tap(page, ["num"]);
  await expectNoSystemKeyboard(page, "Python shell");
  await tap(page, ["apps", "d2"]);
  await expectNoSystemKeyboard(page, "Solve");
  await tap(page, ["apps", "d3", "symb"]);
  await expectNoSystemKeyboard(page, "Python editor again");
});

/** The deepest focused element is editable (the entry field's input, or an editor). */
const editableFocused = (page: Page) => focused(page).then((f) => f.editable);

/** Leave the app as Android does on a swipe or the app switcher: the window loses focus, then the page is hidden. */
async function leaveAndReturn(page: Page, via: "hidden" | "blur"): Promise<void> {
  await page.evaluate((how) => {
    if (how === "blur") return void window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, via);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
}

// Regression (user, 2026-10-13): returning to the app with the entry field focused opened the system keyboard.
// Android restores focus to the focused element when the app comes back and ignores its inputmode=none then, so
// nothing may stay focused while the app is away; the next key press focuses the entry again.
for (const via of ["hidden", "blur"] as const) {
  test(`leaving the app (${via}) drops the focus, and keys work again after returning`, async ({ page }) => {
    await tap(page, ["d1"]);
    expect(await editableFocused(page), "the entry is focused while typing").toBe(true);
    await leaveAndReturn(page, via);
    expect(await editableFocused(page), "nothing editable is focused after returning").toBe(false);
    await tap(page, ["d2"]);
    await expect.poll(() => entryValue(page)).toBe("12");
  });
}
