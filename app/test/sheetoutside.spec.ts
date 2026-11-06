// SPDX-License-Identifier: GPL-3.0-or-later
// R144 (owner, 2026-11-06, point 9): a tap on the on-screen keypad outside an open pick sheet closes the sheet and does
// nothing else: no step, no template, no Undo, no copy. Esc goes back one level (the root closes). A hardware keyboard
// still drives the sheet (▼, a digit, Enter, Escape); Find and Vars, which take letters, keep typing them from the
// keypad; in Settings › Your keys a free key still goes to its row (R4b); the status line's ☰, place and view tabs
// keep their jobs. Expected values derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, sheet, tap, touch } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d1", "enter", "d7", "d8"]); // one history row, and 78 on the line
  await expect(page.locator("[data-status]")).toHaveCount(1);
  expect(await entryValue(page)).toBe("78");
});

/** The pick sheets of the task: Tmpl, Home's ☰, the Mode sheet (the format chip) and the Shift + 9 grid. */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
  tmpl: (page) => tap(page, ["tmpl"]),
  "home menu": (page) => tap(page, ["@menu"]),
  mode: (page) => page.getByTestId("chip-format").tap(),
  "shift 9": (page) => tap(page, ["shift", "d9"]),
};
/** An on-screen tap on a top-cluster key, or a drag on the trackpad. */
const CLOSERS: Record<string, (page: Page) => Promise<void>> = {
  "▲": (page) => page.locator('[data-key="up"]').tap(),
  "▶": (page) => page.locator('[data-key="right"]').tap(),
  "a trackpad drag": (page) => drag(page, '[data-testid="pad-hub"]', 0, 90),
  Undo: (page) => page.locator('[data-key="undo"]').tap(),
  Copy: (page) => page.locator('[data-key="copy"]').tap(),
  Help: (page) => page.locator('[data-key="help"]').tap(),
  U1: (page) => page.locator('[data-key="u1"]').tap(),
};

/** What a closing tap must leave as it was: the line, the history and every setting. */
const state = (page: Page): Promise<string> =>
  page.evaluate(() => JSON.stringify([window.n62.entry.value, window.n62.session.items.length, window.n62.session.settings]));

for (const [name, openSheet] of Object.entries(OPENERS)) {
  test.describe(`with ${name} open`, () => {
    for (const [what, close] of Object.entries(CLOSERS)) {
      test(`an on-screen ${what} closes the sheet and does nothing else`, async ({ page }) => {
        const before = await state(page);
        await openSheet(page);
        await expect(sheet(page)).toBeVisible();
        await close(page);
        await expect(sheet(page)).toHaveCount(0);
        await page.waitForTimeout(150);
        expect(await state(page)).toBe(before);
        expect(await entryValue(page)).toBe("78"); // no template inserted, no undo done
      });
    }

    test("the on-screen Esc closes the root", async ({ page }) => {
      await openSheet(page);
      await page.locator('[data-key="esc"]').tap();
      await expect(sheet(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe("78");
    });

    test("a hardware ▼ moves the highlight and Escape closes", async ({ page }) => {
      await openSheet(page);
      const active = sheet(page).locator('[data-active="true"]');
      const first = await active.getAttribute("data-id");
      await page.keyboard.press("ArrowDown");
      await expect(sheet(page)).toBeVisible();
      await expect(active).not.toHaveAttribute("data-id", first ?? "");
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe("78");
    });
  });
}

test("the rest of a trackpad drag that closed a sheet steps nothing until the finger lifts", async ({ page }) => {
  await tap(page, ["esc"]); // an empty line: a further ▲ step would pick the history row (P4)
  expect(await entryValue(page)).toBe("");
  await tap(page, ["tmpl"]);
  await drag(page, '[data-testid="pad-hub"]', 0, -90); // seven steps up: the first closes the sheet
  await expect(sheet(page)).toHaveCount(0);
  await page.waitForTimeout(150);
  await expect(page.getByTestId("row-actions")).toHaveCount(0);
  await drag(page, '[data-testid="pad-hub"]', 0, -30); // a new drag steps again: ▲ picks the row
  await expect(page.getByTestId("row-actions")).toBeVisible();
});

test("a held ⌫ that closed a short sheet does not repeat until the finger lifts", async ({ page }) => {
  await tap(page, ["@place"]); // the Apps sheet: four rows, the ⌫ row stays visible above it
  await expect(page.getByTestId("apps")).toBeVisible();
  const f = await touch(page, "bksp");
  await page.waitForTimeout(800); // past the repeat delay (400 ms) and several repeats
  await f.end();
  await expect(page.getByTestId("apps")).toHaveCount(0);
  expect(await entryValue(page)).toBe("78");
});

test("Esc on screen goes back one level from a submenu, then closes the root", async ({ page }) => {
  await tap(page, ["@mode", "d6"]); // Mode › Settings
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await page.locator('[data-key="esc"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await page.locator('[data-key="esc"]').tap();
  await expect(sheet(page)).toHaveCount(0);
});

test("a hardware Enter picks in Tmpl, a hardware digit picks in a menu", async ({ page }) => {
  await tap(page, ["tmpl"]);
  await page.keyboard.press("Enter"); // the highlighted template (the first: a fraction) goes on the line
  await expect(sheet(page)).toHaveCount(0);
  expect(await entryValue(page)).not.toBe("78");
  await tap(page, ["@mode"]); // the Mode sheet on Angle
  await page.keyboard.press("1"); // a digit steps its row's value: RAD → DEG
  await expect(page.getByTestId("chip-angle")).toHaveText("DEG");
});

test("Find and Vars keep typing letters from the keypad (Tmpl is c, Vars is a)", async ({ page }) => {
  await tap(page, ["math", "tmpl"]);
  await expect(page.getByTestId("sheet-filter")).toHaveText("c");
  await tap(page, ["esc", "esc"]);
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["vars", "vars"]);
  await expect(page.getByTestId("sheet-filter")).toHaveText("a");
});

test("Settings › Your keys: an on-screen U1 goes to its row, the sheet stays", async ({ page }) => {
  await tap(page, ["@mode", "d6", "d4"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
  await page.locator('[data-key="u1"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
  await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "u1:primary");
});

test("☰, the place name and a view tab keep their jobs over an open sheet", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toBeVisible();
  await page.getByTestId("menu-button").tap(); // ☰ toggles its menu
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["tmpl"]);
  await page.getByTestId("place").tap(); // the place name opens the Apps sheet in its place
  await expect(page.getByTestId("apps")).toBeVisible();
  await page.locator('[data-testid="apps"] [role="menuitem"][data-id="function"]').tap();
  await expect(page.getByTestId("place")).toHaveAttribute("data-app", "function");
  await tap(page, ["tmpl"]);
  await page.getByTestId("tab-plot").tap(); // a view tab closes the sheet and goes there
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "plot");
});
