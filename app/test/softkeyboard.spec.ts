// SPDX-License-Identifier: GPL-3.0-or-later
// Regression (user, 2026-10-12): the Android system keyboard opened when switching apps. Our keypad is the only
// keyboard, so whatever element has focus after a switch must keep the system keyboard closed: inputmode=none
// and no EditContext (Chrome's EditContext on Android ignores inputmode).
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, tap } from "./helpers.ts";

// The full Chromium headless (not the headless shell): only it moves the window's real focus between pages (F99's shade).
test.use({ channel: "chromium" });

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
// that can raise the system keyboard (an input, a textarea, a contenteditable, the field's own sink) has focus, and the
// next key focuses the entry and types. The events come as a device sends them: the window's blur is real (the full
// Chromium headless, focus emulation off, a second page brought to front), so document.hasFocus() is false as on
// Android; the page hides before its pagehide (backlog F99), and a pagehide is not a bfcache entry (persisted false:
// an app switch in a WebView navigates nowhere). document.hidden is set by hand, as Playwright has no app switch.
type Way = "visibility" | "shade" | "pagehide" | "frozen";
const others = new WeakMap<Page, Page>();
/** Move the window's real focus to another page (the shade, another app) or back to ours. */
async function windowFocus(page: Page, ours: boolean): Promise<void> {
  let other = others.get(page);
  if (!other) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await cdp.detach();
    other = await page.context().newPage();
    const cdp2 = await page.context().newCDPSession(other);
    await cdp2.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await cdp2.detach();
    others.set(page, other);
  }
  await (ours ? page : other).bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus()), `window focus ${ours ? "back" : "away"}`).toBe(ours);
}
async function wayBack(page: Page, way: Way, awayMs = 0): Promise<void> {
  const ev = (steps: string[]): Promise<void> =>
    page.evaluate((steps) => {
      for (const s of steps) {
        if (s === "pagehide" || s === "pageshow") window.dispatchEvent(new PageTransitionEvent(s, { persisted: false }));
        else {
          Object.defineProperty(document, "hidden", { value: s === "hidden", configurable: true });
          Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        }
      }
    }, steps);
  const away = (): Promise<void> => (awayMs > 0 ? page.waitForTimeout(awayMs) : Promise.resolve());
  if (way === "visibility") {
    await ev(["hidden"]);
    await away();
    return ev(["visible"]);
  }
  if (way === "pagehide") {
    await ev(["hidden", "pagehide"]);
    await away();
    return ev(["pageshow", "visible"]);
  }
  await windowFocus(page, false);
  if (way === "shade") {
    await away();
    return windowFocus(page, true);
  }
  // a swipe away on Android: the window blurs, the page hides and is frozen (its timers wait), then all of it backwards
  const cdp = await page.context().newCDPSession(page);
  await ev(["hidden"]);
  await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
  await away();
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
  await ev(["visible"]);
  await cdp.detach();
  await windowFocus(page, true);
}

/** The entry has the focus (the state a typed or template cell must leave from), in the view it names. */
async function typing(page: Page, view: "home" | "cas"): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.pascaline.session.view)).toBe(view);
  await expect.poll(() => editableFocused(page), `the ${view} entry is focused before leaving`).toBe(true);
}
const sheet = (page: Page, title: string | RegExp) => expect(page.getByTestId("sheet-title")).toHaveText(title);

// Each cell ends on the state it names (a visible sheet, page or view, or the focused entry), so that a key sequence
// that lands elsewhere fails here instead of passing with nothing focused to begin with.
const screens: Record<string, (page: Page) => Promise<void>> = {
  "Home, empty line": async (page) => {
    await tap(page, ["d1", "esc"]);
    await expect.poll(() => entryValue(page)).toBe("");
    await typing(page, "home");
  },
  "Home, typed line": async (page) => {
    await tap(page, ["d1", "add", "d2"]);
    await typing(page, "home");
  },
  "Home, result just entered": async (page) => {
    await tap(page, ["d1", "add", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]').last()).toBeVisible();
    await typing(page, "home");
  },
  "Home, cursor moved by a drag": async (page) => {
    await tap(page, ["d1", "add", "d2"]);
    await drag(page, "left", -30, 0);
    await typing(page, "home");
  },
  "Home, inside a template box": async (page) => {
    await tap(page, ["d1", "frac"]);
    await expect.poll(() => entryValue(page)).toContain("frac");
    await typing(page, "home");
  },
  "CAS, typed line": async (page) => {
    await tap(page, ["@cas", "d1", "add", "d2"]);
    await typing(page, "cas");
  },
  "CAS, result just entered": async (page) => {
    await tap(page, ["@cas", "d1", "add", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]').last()).toBeVisible();
    await typing(page, "cas");
  },
  "CAS, inside a template box": async (page) => {
    await tap(page, ["@cas", "d1", "frac"]);
    await expect.poll(() => entryValue(page)).toContain("frac");
    await typing(page, "cas");
  },
  "Tmpl sheet open": async (page) => {
    await tap(page, ["d1", "tmpl"]);
    await sheet(page, "Templates");
  },
  "Menu sheet open": async (page) => {
    await tap(page, ["d1", "add", "d2", "enter", "@menu"]);
    await sheet(page, "Menu");
  },
  "Mode sheet open": async (page) => {
    await tap(page, ["d1", "@mode"]);
    await sheet(page, "Mode");
  },
  "Settings page": async (page) => {
    await tap(page, ["d1", "@mode", "d5"]);
    await expect(page.getByTestId("settings")).toBeVisible();
  },
  "Solve Num after an edit (c44)": async (page) => {
    await tap(page, ["@place", "d4", "@symb", "x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "@num"]);
    await page.locator('[data-testid="solve-table"] tr[data-name="x"] th button').tap();
    await tap(page, ["esc", "d1", "enter"]);
    await expect(page.locator('[data-testid="solve-table"] tr[data-name="x"]')).toBeVisible();
    await expect(page.locator('[data-testid="solve-table"] tr[data-name="x"] td').first()).toContainText("1");
  },
  "Function Plot": async (page) => {
    await tap(page, ["@symb", "x", "sq", "enter", "@plot"]);
    await expect(page.locator(".board canvas")).toBeVisible();
    await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  },
};

/** The keys after the last return: a 3 into the entry. Over a sheet or the Settings page Esc closes it first (a digit
 *  there picks a row); the Plot has no entry line, so Home first. */
const resume: Record<string, string[]> = {
  "Tmpl sheet open": ["esc", "d3"],
  "Menu sheet open": ["esc", "d3"],
  "Mode sheet open": ["esc", "d3"],
  "Settings page": ["esc", "d3"],
  "Function Plot": ["@home", "d3"],
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
      // the other half: a key pressed after the return focuses the entry again and types (the app is not away for good)
      await tap(page, resume[screen] ?? ["d3"]);
      await expect.poll(() => editableFocused(page), "a key after the return focuses the entry").toBe(true);
      await expect.poll(() => entryValue(page)).toContain("3");
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

// F99's path (R81): a focus() called while the window is blurred fires no focusin, so the away guard never saw it; the
// browser handed the element the focus on the return, and Android raised the system keyboard on it. An insert after
// an await, a result that lands, or MathLive's 60 ms timer all call it. Both a shade pull and an app switch (a real
// blur and a hide) leave the window blurred.
for (const hide of [false, true]) {
  test(`F99: a focus while the window is away (${hide ? "app switch" : "shade"}) is not handed back on the return`, async ({ page }) => {
    await tap(page, ["d1"]);
    await windowFocus(page, false);
    const setHidden = (h: boolean): Promise<void> =>
      page.evaluate((h) => {
        Object.defineProperty(document, "hidden", { value: h, configurable: true });
        Object.defineProperty(document, "visibilityState", { value: h ? "hidden" : "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }, h);
    if (hide) await setHidden(true);
    await page.evaluate(() => window.pascaline.entry.insert("2"));
    await page.waitForTimeout(150);
    if (hide) await setHidden(false);
    await windowFocus(page, true);
    await page.waitForTimeout(150);
    const f = await focused(page);
    expect(f.editable, `${f.tag} inputmode=${f.inputmode}`).toBe(false);
    await tap(page, ["d3"]);
    await expect.poll(() => editableFocused(page)).toBe(true);
    await expect.poll(() => entryValue(page)).toBe("123");
  });
}
