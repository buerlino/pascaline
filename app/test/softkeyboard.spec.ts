// SPDX-License-Identifier: GPL-3.0-or-later
// Regression (user, 2026-10-12): the Android system keyboard opened when switching apps. Our keypad is the only
// keyboard, so whatever element has focus after a switch must keep the system keyboard closed: inputmode=none
// and no EditContext (CodeMirror uses Chrome's EditContext on Android, which ignores inputmode).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

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
