// SPDX-License-Identifier: GPL-3.0-or-later
// R8: the status line (docs/05 3.2), the Mode sheet (Shift + CAS) and Settings (Shift + Home/CAS) (3.4). The real
// engine for the angle test (GIAC_OUT); the fake one for the rest.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const lastText = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
const sheet = (page: Page) => page.getByTestId("menu");
const angle = (page: Page) => page.evaluate(() => window.pascaline.session.settings.angle);
const active = (page: Page) => sheet(page).locator('[role="menuitem"][data-active="true"]');

/** The share of the window the calculation viewport (history or view, and the entry line) gets, docs/03 rule 9. */
/** Measured after R8 (Pixel 7, 412 × 915): 0.3540 with the 28 px status line. A package may not go below it. */
const FLOOR = 0.35;

test("the status line is at most 28 px, and the viewport keeps its share of the screen (the floor of docs/03 rule 9)", async ({ page }) => {
  await open(page);
  const m = await page.evaluate(() => {
    const h = document.querySelector("header")?.getBoundingClientRect();
    const v = document.querySelector(".screen")?.getBoundingClientRect();
    return { header: h?.height ?? 0, screen: v?.height ?? 0, window: window.innerHeight, tabs: document.querySelectorAll('[role="tab"]').length };
  });
  expect(m.tabs).toBe(0);
  expect(m.header).toBeLessThanOrEqual(28);
  const share = m.screen / m.window;
  console.log(`viewport share ${share.toFixed(4)} (screen ${m.screen} of ${m.window} px, status line ${m.header} px)`);
  expect(share).toBeGreaterThanOrEqual(FLOOR);
});

test("the status line shows the place, the angle unit, the format and digits", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("place")).toHaveText("Home");
  await expect(page.getByTestId("chip-angle")).toHaveText("RAD");
  await expect(page.getByTestId("chip-format")).toHaveText("STD");
  await expect(page.getByTestId("chip-digits")).toHaveText("12");
  await tap(page, ["cas"]);
  await expect(page.getByTestId("place")).toHaveText("CAS");
  await tap(page, ["plot"]);
  await expect(page.getByTestId("place")).toHaveText("Function › Plot");
  await expect(page.getByTestId("place")).toHaveAttribute("data-app", "function");
  await tap(page, ["app"]);
  await expect(page.getByTestId("place")).toHaveText("CAS");
});

test("a tap on the place name opens the Apps sheet", async ({ page }) => {
  await open(page);
  await page.getByTestId("place").tap();
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["apps"]);
  await expect(page.getByTestId("apps")).toBeHidden();
});

test("Shift and Alpha show in the status line: one tap each, twice for the lock", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("mod-shift")).toHaveCount(0);
  await tap(page, ["shift"]);
  await expect(page.getByTestId("mod-shift")).toHaveText("⇧");
  await tap(page, ["alpha"]);
  await expect(page.getByTestId("mod-alpha")).toHaveText("α");
  await tap(page, ["alpha"]);
  await expect(page.getByTestId("mod-alpha")).toHaveText("α🔒");
  await tap(page, ["alpha"]);
  await expect(page.getByTestId("mod-alpha")).toHaveCount(0);
});

test("tap RAD → DEG changes the next result; sin 90 is 1 in degrees", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["sin", "d9", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.893996663601"); // oracle: sin(90 rad) = 0.8939966636005579 (12 digits round up)
  await page.getByTestId("chip-angle").tap();
  await expect(page.getByTestId("chip-angle")).toHaveText("DEG");
  await expect(page.getByTestId("chip-angle")).toHaveAttribute("data-changed", "true");
  expect(await angle(page)).toBe("deg");
  await tap(page, ["sin", "d9", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1");
  await page.getByTestId("chip-angle").tap();
  await expect(page.getByTestId("chip-angle")).toHaveText("RAD");
});

test("DEG → RAD in 3 keys: Shift + CAS, ▶, Enter; the sheet opens on Angle every time", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-angle").tap(); // DEG
  await tap(page, ["shift", "cas"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await expect(active(page)).toHaveAttribute("data-id", "angle");
  await expect(active(page).getByTestId("sheet-value")).toHaveText("Degrees");
  await tap(page, ["right"]);
  await expect(active(page).getByTestId("sheet-value")).toHaveText("Radians");
  await tap(page, ["enter"]);
  await expect(sheet(page)).toBeHidden();
  expect(await angle(page)).toBe("rad");
  // the pick before this one (Digits) does not move the start
  await tap(page, ["shift", "cas", "d3", "cancel", "shift", "cas"]);
  await expect(active(page)).toHaveAttribute("data-id", "angle");
});

test("keys typed while the Mode sheet's code loads wait for it, and are not typed into the line (R35)", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/views\/modeSheet\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await open(page);
  expect(await angle(page)).toBe("rad");
  await tap(page, ["d1", "shift", "cas", "right", "enter"]);
  expect(await entryValue(page)).toBe("1"); // nothing evaluated yet, nothing typed
  release();
  await expect.poll(() => angle(page)).toBe("deg"); // the sheet opened, ▶ stepped Angle, Enter closed it
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("1");
  await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
});

test("digits to 20 in 3 keys: Shift + CAS, 3, 7", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "cas", "d3"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Significant digits");
  await expect(active(page)).toHaveAttribute("data-id", "12"); // the current value is highlighted and marked
  await expect(sheet(page).locator('[data-id="12"]')).toHaveAttribute("data-selected", "true");
  await tap(page, ["d7"]);
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByTestId("chip-digits")).toHaveText("20");
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(20);
});

test("the format and digits chips open the Mode sheet on their row; ◀ ▶ change a value in place, a tap on a row steps it", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await expect(active(page)).toHaveAttribute("data-id", "format");
  await tap(page, ["right"]);
  await expect(page.getByTestId("chip-format")).toHaveText("SCI");
  await tap(page, ["left"]);
  await expect(page.getByTestId("chip-format")).toHaveText("STD");
  await expect(sheet(page)).toBeVisible(); // ◀ on a setting steps it, it does not go back
  await tap(page, ["cancel"]);
  await page.getByTestId("chip-digits").tap();
  await expect(active(page)).toHaveAttribute("data-id", "digits");
  await tap(page, ["right", "right"]);
  await expect(page.getByTestId("chip-digits")).toHaveText("14");
  await sheet(page).locator('[data-id="entry"]').tap(); // a tap steps the row forward and the sheet stays
  expect(await page.evaluate(() => window.pascaline.session.settings.entry)).toBe("line");
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator('[data-id="entry"]').tap();
  expect(await page.evaluate(() => window.pascaline.session.settings.entry)).toBe("textbook");
});

test("Shift and Alpha do nothing while the Mode sheet is open, and Esc goes back one level, then closes", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "cas", "shift"]);
  await expect(active(page)).toHaveAttribute("data-id", "angle");
  await tap(page, ["d3", "esc"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
});

test("the last row of the Mode sheet opens the Settings page; Shift + Home/CAS opens it directly; the Menu key closes it", async ({ page }) => {
  await open(page);
  const settings = page.getByTestId("settings");
  await tap(page, ["shift", "cas", "d5"]);
  await expect(settings).toBeVisible();
  await expect(sheet(page)).toBeHidden(); // the Mode sheet gave way to the page
  await tap(page, ["menu"]);
  await expect(settings).toBeHidden();
  await tap(page, ["shift", "app"]);
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");
  await expect(settings.locator('[data-active="true"]')).toHaveAttribute("data-id", "std");
  await tap(page, ["menu"]);
  await expect(settings).toBeHidden();
});

test("the sheets work inside an app, and the angle unit set there is the one the app uses", async ({ page }) => {
  await open(page);
  await tap(page, ["plot"]);
  await page.waitForFunction(() => window.pascaline.shell.app === "function" && window.pascaline.shell.loading === null); // keys pressed while an app loads wait; a place key does not
  await tap(page, ["shift", "cas", "right", "enter"]);
  expect(await angle(page)).toBe("deg");
  await expect(page.getByTestId("place")).toHaveText("Function › Plot");
  await expect(page.getByTestId("chip-angle")).toHaveText("DEG");
});
