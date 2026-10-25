// SPDX-License-Identifier: GPL-3.0-or-later
// Regression (user, 2026-10-12): the Android system keyboard opened when switching apps. Our keypad is the only
// keyboard, so whatever element has focus after a switch must keep the system keyboard closed: inputmode=none
// and no EditContext (Chrome's EditContext on Android ignores inputmode).
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, tap } from "./helpers.ts";

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
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expectNoSystemKeyboard(page, "Function Symb");
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await expectNoSystemKeyboard(page, "Solve");
  await tap(page, ["@place", "d3", "@symb"]);
  await expectNoSystemKeyboard(page, "Function Symb again");
});

/** The deepest focused element is editable (the entry field's input, or an editor). */
const editableFocused = (page: Page) => focused(page).then((f) => f.editable);

type Leave = "hidden" | "blur" | "blur-hidden" | "hidden-blur" | "blur-focus";

/**
 * Leave the app and come back. Android blurs the window and hides the page on a swipe or the app switcher, in
 * either order ("blur-hidden", "hidden-blur"); the notification shade, the share sheet or a permission prompt only
 * blur and refocus the window ("blur-focus"). "hidden" and "blur" are one event alone.
 */
async function leaveAndReturn(page: Page, via: Leave): Promise<void> {
  await page.evaluate((how) => {
    const blur = (): boolean => window.dispatchEvent(new Event("blur"));
    const hide = (): void => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    for (const step of how.split("-")) {
      if (step === "blur") blur();
      else if (step === "hidden") hide();
    }
  }, via);
  await page.evaluate((how) => {
    if (how !== "blur-focus") {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }
    window.dispatchEvent(new Event("focus"));
  }, via);
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

// Regression (user, 2026-10-14, F9): MathLive's own focus restore (restoreFocusWhenDocumentFocused) refocused the
// entry on the second return, or on every return when the page hid before the window blurred, and the system
// keyboard opened again. Three cycles in a row, after a tap and after a trackpad drag, in both event orders, and
// the notification shade (window blur and focus, no hide). MathLive focuses 60 ms late, so wait before reading.
const starts = {
  tap: (page: Page) => tap(page, ["d1"]),
  drag: async (page: Page) => {
    await tap(page, ["d1"]);
    await drag(page, "left", -30, 0);
  },
};
const cycles: [keyof typeof starts, Leave][] = [
  ["tap", "blur-hidden"],
  ["tap", "hidden-blur"],
  ["drag", "blur-hidden"],
  ["drag", "hidden-blur"],
  ["tap", "blur-focus"],
];
for (const [start, via] of cycles) {
  test(`three returns (${via}) after a ${start} leave nothing focused, and keys still type`, async ({ page }) => {
    await starts[start](page);
    expect(await editableFocused(page), "the entry is focused while typing").toBe(true);
    for (let i = 1; i <= 3; i++) {
      await leaveAndReturn(page, via);
      await page.waitForTimeout(150);
      expect(await editableFocused(page), `nothing editable is focused after return ${i}`).toBe(false);
    }
    await tap(page, ["d2"]);
    await expect.poll(() => entryValue(page)).toContain("2");
  });
}

// Regression (F13, R25c): MathLive focuses its keyboard sink 60 ms after mf.focus() on a blurred field, in a timer
// dropFocus cannot cancel. A key pressed just before the app is left therefore focused the field while away, and
// Android opened the system keyboard on return. A focus event that arrives while the app is away must be dropped.
test("a key pressed just before leaving does not focus the entry while away", async ({ page }) => {
  await tap(page, ["d1"]);
  await leaveAndReturn(page, "blur-hidden");
  await page.waitForTimeout(150);
  expect(await editableFocused(page), "blurred after the first leave").toBe(false);
  await page.evaluate(() => {
    void window.pascaline.entry.run({ kind: "type", text: "2" });
    window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(200);
  expect(await editableFocused(page), "nothing editable is focused 200 ms after the hide").toBe(false);
});

// F99 (R81, the owner's morning check 2026-10-25, Fairphone 6): the system keyboard opened again on some returns. The
// matrix: what was on screen when leaving × the way back × one, two or five quick returns. After each return nothing
// that can raise the system keyboard (an input, a textarea, a contenteditable, the field's own sink) has focus.
type Way = "visibility" | "shade" | "pagehide" | "frozen";
async function wayBack(page: Page, way: Way, awayMs = 0): Promise<void> {
  const ev = (steps: string[]): Promise<void> =>
    page.evaluate((steps) => {
      for (const s of steps) {
        if (s === "blur" || s === "focus") window.dispatchEvent(new Event(s));
        else if (s === "pagehide" || s === "pageshow") window.dispatchEvent(new PageTransitionEvent(s, { persisted: true }));
        else {
          const hidden = s === "hidden";
          Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
          Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        }
      }
    }, steps);
  const away = (): Promise<void> => (awayMs > 0 ? page.waitForTimeout(awayMs) : Promise.resolve());
  const pair: Record<Exclude<Way, "frozen">, [string, string]> = {
    visibility: ["hidden", "visible"],
    shade: ["blur", "focus"],
    pagehide: ["pagehide", "pageshow"],
  };
  if (way !== "frozen") {
    await ev([pair[way][0]]);
    await away();
    return ev([pair[way][1]]);
  }
  // a swipe away on Android: the window blurs, the page hides and is frozen (its timers wait), then all of it backwards
  const cdp = await page.context().newCDPSession(page);
  await ev(["blur", "hidden", "pagehide"]);
  await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
  await away();
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
  await ev(["pageshow", "visible", "focus"]);
  await cdp.detach();
}

const screens: Record<string, (page: Page) => Promise<void>> = {
  "Home, empty line": async (page) => {
    await tap(page, ["d1", "esc"]);
  },
  "Home, typed line": (page) => tap(page, ["d1", "add", "d2"]),
  "Home, result just entered": (page) => tap(page, ["d1", "add", "d2", "enter"]),
  "Home, cursor moved by a drag": async (page) => {
    await tap(page, ["d1", "add", "d2"]);
    await drag(page, "left", -30, 0);
  },
  "Home, inside a template box": (page) => tap(page, ["d1", "frac"]),
  "CAS, typed line": (page) => tap(page, ["@cas", "d1", "add", "d2"]),
  "CAS, result just entered": (page) => tap(page, ["@cas", "d1", "add", "d2", "enter"]),
  "CAS, inside a template box": (page) => tap(page, ["@cas", "d1", "frac"]),
  "Tmpl sheet open": (page) => tap(page, ["d1", "tmpl"]),
  "Menu sheet open": (page) => tap(page, ["d1", "add", "d2", "enter", "@menu"]),
  "Mode sheet open": (page) => tap(page, ["d1", "@mode"]),
  "Settings page": (page) => tap(page, ["d1", "@mode", "d5"]),
  "Solve Num after an edit (c44)": async (page) => {
    await tap(page, ["@place", "d4", "@symb", "x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "@num"]);
    await page.locator('[data-testid="solve-table"] tr[data-name="x"] th button').tap();
    await tap(page, ["esc", "d1", "enter"]);
  },
  "Function Plot": (page) => tap(page, ["@symb", "x", "sq", "enter", "@plot"]),
};

for (const [screen, go] of Object.entries(screens)) {
  for (const way of ["visibility", "shade", "pagehide", "frozen"] as const) {
    test(`F99: ${screen}, back by ${way}, 1/2/5 quick returns leave nothing editable focused`, async ({ page }) => {
      await go(page);
      await page.waitForTimeout(100);
      const failed: string[] = [];
      for (const n of [1, 2, 5]) {
        for (let i = 0; i < n; i++) await wayBack(page, way);
        await page.waitForTimeout(150); // MathLive's sink focus comes 60 ms late
        const f = await focused(page);
        if (f.editable) failed.push(`${n}×: ${f.tag} inputmode=${f.inputmode}`);
      }
      expect(failed, `${screen} by ${way}`).toEqual([]);
    });
  }
}

// F99 with R25c's timing: a key pressed just before leaving makes MathLive focus its sink 60 ms later, which may land
// while away or, after a freeze, only once the page is back.
for (const way of ["visibility", "shade", "pagehide", "frozen"] as const) {
  test(`F99: a key pressed just before leaving by ${way} leaves nothing editable focused`, async ({ page }) => {
    await tap(page, ["d1"]);
    await wayBack(page, "visibility");
    await page.waitForTimeout(150);
    await page.evaluate(() => window.pascaline.entry.run({ kind: "type", text: "2" }));
    await wayBack(page, way, 200); // away longer than MathLive's 60 ms (a frozen page runs its timer only on return)
    await page.waitForTimeout(200);
    const f = await focused(page);
    expect(f.editable, `${f.tag} inputmode=${f.inputmode}`).toBe(false);
  });
}
