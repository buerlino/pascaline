// SPDX-License-Identifier: GPL-3.0-or-later
// R49 (docs/05 3.4, decisions.md "Settings in the Mode sheet, and presets"): Settings is the next level of the pick sheet
// over the keypad's maths rows, opened by Mode's last row and by every ☰ menu's last row, with its path in the title.
// By touch, by keys and by Android back (`history.back()`); the history never grows. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, recordVibrations, tap, vibrations } from "./helpers.ts";

const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const rowIds = (page: Page) => sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
const historyLength = (page: Page) => page.evaluate(() => history.length);
const back = (page: Page) => page.evaluate(() => history.back());
/** The sections built so far, in the fixed order (Data comes later; Appearance is R50e, Your keys R4b). */
const SECTIONS = ["appearance", "numbers", "vibration", "keys", "counters", "help"];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordVibrations(page);
  await open(page);
});

test.describe("by keys", () => {
  test("Mode, 5: Settings as a level of the sheet, with its path; digits pick, ▶ or Enter opens, ◀ or Esc goes back onto the same row", async ({ page }) => {
    await tap(page, ["@mode", "d5"]);
    await expect(title(page)).toHaveText("Mode › Settings");
    await expect(page.getByTestId("settings")).toHaveCount(0); // no page over everything
    expect(await rowIds(page)).toEqual(SECTIONS);
    await expect(active(page)).toHaveAttribute("data-id", "appearance");
    await tap(page, ["d3"]);
    await expect(title(page)).toHaveText("Mode › Settings › Key vibration");
    await tap(page, ["esc"]);
    await expect(title(page)).toHaveText("Mode › Settings");
    await expect(active(page)).toHaveAttribute("data-id", "vibration");
    await tap(page, ["right"]);
    await expect(title(page)).toHaveText("Mode › Settings › Key vibration");
    await tap(page, ["left"]);
    await expect(title(page)).toHaveText("Mode › Settings");
    await expect(active(page)).toHaveAttribute("data-id", "vibration");
    await tap(page, ["down", "enter"]);
    await expect(title(page)).toHaveText("Mode › Settings › Your keys");
    await tap(page, ["esc", "esc"]);
    await expect(title(page)).toHaveText("Mode");
    await expect(active(page)).toHaveAttribute("data-id", "settings");
    await tap(page, ["esc"]);
    await expect(sheet(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe(""); // no key reached the line
  });

  test("the pill, 5, 2: Numbers holds the Decimal mark, the Fmt cycle's five ticks and Decimals in Fixed; the hint is a second line under Standard", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await tap(page, ["d5", "d2"]);
    await expect(title(page)).toHaveText("Mode › Settings › Numbers");
    expect(await rowIds(page)).toEqual(["mark", "std", "sci", "eng", "pfx", "fix", "decimals"]);
    await expect(row(page, "std").getByTestId("row-hint")).toBeVisible();
    await expect(sheet(page).getByTestId("row-hint")).toHaveCount(1);
    await expect(row(page, "pfx")).toHaveAttribute("data-selected", "false");
    await tap(page, ["d5"]); // a tick toggles and the sheet stays
    await expect(row(page, "pfx")).toHaveAttribute("data-selected", "true");
    expect(await page.evaluate(() => window.pascaline.session.settings.fmtCycle)).toContain("pfx");
    await tap(page, ["enter"]); // Enter on a tick toggles it too, and stays
    await expect(row(page, "pfx")).toHaveAttribute("data-selected", "false");
    // the top cluster's pad moves the highlight: ▲ from Prefixes to Standard, then round to Decimals; ▶ ◀ step it
    await tap(page, ["up", "up", "up"]);
    await expect(active(page)).toHaveAttribute("data-id", "std");
    await tap(page, ["up"]);
    await expect(active(page)).toHaveAttribute("data-id", "mark"); // R57: the level's first row, a value row (Point, Comma)
    await expect(row(page, "mark").getByTestId("sheet-value")).toHaveText("Point");
    await tap(page, ["right"]);
    await expect(row(page, "mark").getByTestId("sheet-value")).toHaveText("Comma");
    expect(await page.evaluate(() => window.pascaline.session.settings.decimalMark)).toBe("comma");
    await tap(page, ["left", "up"]);
    expect(await page.evaluate(() => window.pascaline.session.settings.decimalMark)).toBe("point");
    await expect(active(page)).toHaveAttribute("data-id", "decimals");
    await tap(page, ["right", "right", "left"]);
    expect(await page.evaluate(() => window.pascaline.session.settings.fixDecimals)).toBe(5);
    await expect(row(page, "decimals").getByTestId("sheet-value")).toHaveText("5");
    await expect(title(page)).toHaveText("Mode › Settings › Numbers");
  });

  test("a hardware keyboard: digits pick, arrows move, Escape goes back one level", async ({ page }) => {
    await tap(page, ["@mode"]);
    await page.keyboard.press("5");
    await expect(title(page)).toHaveText("Mode › Settings");
    await page.keyboard.press("5");
    await expect(title(page)).toHaveText("Mode › Settings › Counters");
    await page.keyboard.press("ArrowDown");
    await expect(active(page)).toHaveAttribute("data-id", "alpha");
    await page.keyboard.press("Escape");
    await expect(title(page)).toHaveText("Mode › Settings");
    await expect(active(page)).toHaveAttribute("data-id", "counters");
    expect(await entryValue(page)).toBe("");
  });
});

test.describe("by touch", () => {
  test("Mode's Settings row shows ›; a tap opens it, a section's tap opens it, ‹ goes back, a tap above the sheet closes it", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await expect(row(page, "settings").locator(".more")).toHaveText("›");
    await row(page, "settings").tap();
    await expect(title(page)).toHaveText("Mode › Settings");
    await row(page, "counters").tap();
    await expect(title(page)).toHaveText("Mode › Settings › Counters");
    await sheet(page).getByRole("button", { name: "Back" }).tap();
    await expect(title(page)).toHaveText("Mode › Settings");
    await page.locator(".screen").click({ position: { x: 20, y: 20 } });
    await expect(sheet(page)).toHaveCount(0);
  });

  test("every ☰ menu's last row opens the same level, with that menu in the path; ◀ goes back to the menu", async ({ page }) => {
    await tap(page, ["@menu"]);
    await expect(sheet(page).getByRole("menuitem").last()).toHaveAttribute("data-id", "settings");
    await tap(page, ["d0"]);
    await expect(title(page)).toHaveText("Home menu › Settings");
    expect(await rowIds(page)).toEqual(SECTIONS);
    await tap(page, ["left"]);
    await expect(title(page)).toHaveText("Home menu");
    await expect(active(page)).toHaveAttribute("data-id", "settings");
    await tap(page, ["esc"]);
    await tap(page, ["@plot"]);
    await page.waitForFunction(() => window.pascaline.shell.app === "function" && window.pascaline.shell.loading === null);
    await tap(page, ["@menu"]);
    await sheet(page).getByRole("menuitem").last().tap();
    await expect(title(page)).toHaveText("Plot menu › Settings");
    await row(page, "numbers").tap();
    await expect(title(page)).toHaveText("Plot menu › Settings › Numbers");
  });

  test("Key vibration: the switch, Strength, Length and Try it; switches keep the sheet open; Try it gives one pulse", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d3"]);
    expect(await rowIds(page)).toEqual(["haptics", "strength", "ms", "try"]);
    await expect(row(page, "try")).toHaveAttribute("aria-disabled", "true"); // off: nothing to try
    await row(page, "haptics").tap();
    await expect(row(page, "haptics")).toHaveAttribute("data-selected", "true");
    expect(await page.evaluate(() => window.pascaline.session.settings.haptics.on)).toBe(true);
    await expect(row(page, "strength")).toHaveAttribute("aria-disabled", "true"); // the web build cannot set it, and says why
    await expect(row(page, "strength").locator(".reason")).toHaveText("The Android app only");
    await row(page, "ms").getByTestId("step-up").tap();
    expect(await page.evaluate(() => window.pascaline.session.settings.haptics.ms)).toBe(20);
    const before = (await vibrations(page)).length;
    await row(page, "try").tap();
    await expect.poll(async () => (await vibrations(page)).slice(before)).toEqual([20]);
    await expect(title(page)).toHaveText("Mode › Settings › Key vibration");
  });

  test("Counters: the Shift and Alpha counts, since when, and Reset, which keeps the sheet open", async ({ page }) => {
    await tap(page, ["shift", "shift", "alpha", "alpha"]);
    await tap(page, ["@mode", "d5", "d5"]);
    expect(await rowIds(page)).toEqual(["shift", "alpha", "since", "reset"]);
    await expect(row(page, "shift").getByTestId("sheet-value")).toHaveText("2");
    await expect(row(page, "alpha").getByTestId("sheet-value")).toHaveText("2");
    await expect(row(page, "since").getByTestId("sheet-value")).toHaveText(/^\d{4}-\d\d-\d\d$/);
    await row(page, "reset").tap();
    await expect(row(page, "shift").getByTestId("sheet-value")).toHaveText("0");
    await expect(title(page)).toHaveText("Mode › Settings › Counters");
  });
});

test.describe("Android back (history.back())", () => {
  test("back goes back one level, then closes; the next key works as before", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d2"]);
    await expect(title(page)).toHaveText("Mode › Settings › Numbers");
    await back(page);
    await expect(title(page)).toHaveText("Mode › Settings");
    await expect(active(page)).toHaveAttribute("data-id", "numbers");
    await back(page);
    await expect(title(page)).toHaveText("Mode");
    await back(page);
    await expect(sheet(page)).toHaveCount(0);
    await tap(page, ["d4", "d2"]);
    expect(await entryValue(page)).toBe("42");
  });

  test("back closes an open pick sheet, and the next key works as before", async ({ page }) => {
    await tap(page, ["@place"]);
    await expect(page.getByTestId("apps")).toBeVisible();
    await back(page);
    await expect(page.getByTestId("apps")).toHaveCount(0);
    await tap(page, ["d7"]);
    expect(await entryValue(page)).toBe("7");
  });

  test("opening Settings and closing it five ways leaves the history as it was", async ({ page }) => {
    const before = await historyLength(page);
    const closes = [
      () => tap(page, ["esc", "esc", "esc"]),
      () => page.locator(".screen").click({ position: { x: 20, y: 20 } }),
      async () => {
        await back(page);
        await expect(title(page)).toHaveText("Mode › Settings");
        await back(page);
        await expect(title(page)).toHaveText("Mode");
        await back(page);
      },
      () => sheet(page).getByRole("button", { name: "Close" }).tap(),
      () => page.keyboard.press("Escape").then(() => page.keyboard.press("Escape")).then(() => page.keyboard.press("Escape")),
    ];
    for (const close of closes) {
      await tap(page, ["@mode", "d5", "d2"]);
      await expect(title(page)).toHaveText("Mode › Settings › Numbers");
      await close();
      await expect(sheet(page)).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(() => history.state?.pascalineLayer)).toBeUndefined();
    await page.waitForTimeout(100);
    expect(await historyLength(page)).toBeLessThanOrEqual(before + 1);
    expect(await page.evaluate(() => history.state)).toBeNull();
  });
});

// at 360 × 740, 372 × 767 (the Fairphone 6: 380 px over the maths rows) and 412 × 915 no level cuts a row
const LEVELS: Record<string, string[]> = {
  "Mode › Settings": ["@mode", "d5"],
  "Mode › Settings › Appearance": ["@mode", "d5", "d1"],
  "Settings › Appearance › Theme": ["@mode", "d5", "d1", "enter"],
  "Mode › Settings › Numbers": ["@mode", "d5", "d2"],
  "Mode › Settings › Key vibration": ["@mode", "d5", "d3"],
  "Mode › Settings › Counters": ["@mode", "d5", "d5"],
};
for (const [w, h] of [[360, 740], [372, 767], [412, 915]] as const)
  test(`fit at ${w} × ${h}: every Settings level shows all its rows, the top cluster uncovered`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    for (const [path, keys] of Object.entries(LEVELS)) {
      await tap(page, keys);
      await expect(title(page)).toHaveText(path);
      if (path.endsWith("Key vibration")) await row(page, "haptics").tap(); // on: no reason line, but ◀ ▶ rows
      const m = await sheet(page).locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll, path).toBeLessThanOrEqual(m.client);
      await expect(page.getByTestId("sheet-count")).toHaveCount(0);
      const hits = await page.evaluate((ids) =>
        ids.map((id) => {
          const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
          return r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest<HTMLElement>("[data-key]")?.dataset["key"] : undefined;
        }), ["up", "down", "left", "right", "esc"]);
      expect(hits).toEqual(["up", "down", "left", "right", "esc"]);
      await page.locator(".screen").click({ position: { x: 20, y: 20 } });
      await expect(sheet(page)).toHaveCount(0);
    }
  });
