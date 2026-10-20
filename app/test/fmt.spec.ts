// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt) and the key vibration settings. Uses the real engine (GIAC_OUT).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const lastText = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });

const sheet = (page: Page) => page.getByTestId("menu");
const settingsPage = (page: Page) => page.getByTestId("settings");
/** The Mode sheet (format chip, ▲), 5: the Settings page (the last row of Mode). */
async function openSettings(page: Page): Promise<void> {
  await tap(page, ["@mode", "d5"]);
  await expect(settingsPage(page)).toBeVisible();
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");
}
/** The Mode sheet (format chip, ▲; Shift + Apps before R15c2). */
async function openMode(page: Page): Promise<void> {
  await tap(page, ["@mode"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
}
const closeSheet = (page: Page) => tap(page, ["esc"]);
const row = (page: Page, id: string) => settingsPage(page).locator(`[data-id="${id}"]`);
/** Tick (or untick) notations of the Format key cycle: Settings, a tap per notation, Esc. */
async function toggleCycle(page: Page, modes: string[]): Promise<void> {
  await openSettings(page);
  for (const m of modes) await row(page, m).tap();
  await closeSheet(page);
  await expect(settingsPage(page)).toBeHidden();
}
async function pickDigits(page: Page, valueKey: string): Promise<void> {
  await openMode(page);
  await tap(page, ["d3", valueKey]);
  await expect(sheet(page)).toBeHidden();
}

test("fmt shows 1/3 in Standard, Scientific, Engineering and back, for that result only", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "d2", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "12");
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "3.33333333333E-1");
  await expect(lastText(page).locator(".math")).toHaveAttribute("data-latex", "3.33333333333\\times10^{-1}");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "333.333333333E-3");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  // the earlier result and the global setting did not move
  await expect(page.locator('[data-testid="result"] .result').first()).toHaveAttribute("data-text", "12");
  expect(await page.evaluate(() => window.pascaline.session.settings.format)).toBe("std");
});

test("a b/c (R10): 7/3 shows as 7/3, then the decimal again; never a mixed number, needs no setting", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d7", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.33333333333");
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "7/3");
  await expect(lastText(page).locator(".math")).toHaveAttribute("data-latex", "\\frac{7}{3}");
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.33333333333");
});

test("the Format key cycle and the vibration settings persist across a reload", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await toggleCycle(page, ["eng", "fix"]);
  // key vibration: a tap switches it on, ▶ ×5 sets the length from 15 to 40 ms
  await openSettings(page);
  await row(page, "haptics").tap();
  for (let i = 0; i < 5; i++) await row(page, "ms").getByTestId("step-up").tap();
  await closeSheet(page);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.waitForFunction(() => window.pascaline.session.settings.haptics.on === true);
  await openSettings(page);
  await expect(row(page, "haptics").getByTestId("settings-value")).toHaveText("On");
  await expect(row(page, "ms").getByTestId("settings-value")).toHaveText("40 ms");
  // the web build cannot set the strength, and the row says why
  await expect(row(page, "strength")).toHaveAttribute("aria-disabled", "true");
  await expect(row(page, "strength").getByTestId("settings-reason")).toHaveText(/browser/);
  const marked = await settingsPage(page).locator('[aria-checked="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(marked).toEqual(["std", "sci", "fix"]);
  expect(await page.evaluate(() => window.pascaline.session.settings.haptics)).toEqual({ on: true, strength: 50, ms: 40 });
});

test("key vibration: off by default, and on it calls navigator.vibrate on key-down", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vib: unknown[] }).__vib = calls;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (calls.push(p), true) });
  });
  const vib = () => page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib);
  await open(page);
  await tap(page, ["d1", "d2"]);
  expect(await vib()).toEqual([]);
  await openSettings(page);
  await row(page, "haptics").tap();
  expect(await vib()).toEqual([]); // switched on from the page, where no key goes down
  await closeSheet(page);
  expect(await vib()).toEqual([]); // Esc is under the page: a hardware-style press, no touch
  await tap(page, ["d3"]);
  expect(await vib()).toEqual([15]); // the default length, one call per key
  await page.locator('[data-key="d4"]').dispatchEvent("pointerdown");
  expect(await vib()).toEqual([15, 15]);
});

const markOfLast = (page: Page) => page.getByTestId("mark").last();

test("marks: = for an exact value shown in full, ≈ for digits of an irrational or a third; none for a non-number", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d2", "add", "d2", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "4");
  await expect(markOfLast(page)).toHaveText("=");
  await tap(page, ["d1", "div", "d4", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.25");
  await expect(markOfLast(page)).toHaveText("=");
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  await expect(markOfLast(page)).toHaveText("≈");
  // the old "approximate" note is gone
  await expect(page.getByText("approximate", { exact: true })).toHaveCount(0);
  // a b/c shows the third as an exact fraction: =
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1/3");
  await expect(markOfLast(page)).toHaveText("=");
});

test("30 digits: the setting takes 30, Home draws 30 digits and 1/3 stays ≈", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await pickDigits(page, "d9"); // 4 6 8 10 12 15 20 25 30
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(30);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", `0.${"3".repeat(30)}`);
  await expect(markOfLast(page)).toHaveText("≈");
});

test("PFX: 2500 draws as 2.500 k with a thin space and an accented prefix, from Settings and from the Format key", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await pickDigits(page, "d1");
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(4);
  await toggleCycle(page, ["pfx"]);
  await tap(page, ["d2", "d5", "d0", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2500");
  await expect(markOfLast(page)).toHaveText("=");
  // std -> sci -> eng -> pfx
  await tap(page, ["fmt", "fmt", "fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.500 k");
  await expect(lastText(page).locator(".pfx")).toHaveText("k");
  await expect(markOfLast(page)).toHaveText("=");
  // as the global format too
  await page.getByTestId("chip-format").tap(); // the Mode sheet on its Format row; ▶ ×3: Standard → … → Prefixes
  await tap(page, ["right", "right", "right", "enter"]);
  expect(await page.evaluate(() => window.pascaline.session.settings.format)).toBe("pfx");
  await tap(page, ["d1", "d2", "d0", "d0", "d0", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "120.0 k");
  // tapping the result puts a chip with the full value on the line, never the prefix text
  await lastText(page).click();
  const chips = await page.evaluate(() => Object.values(window.pascaline.entry.chips).map((c) => c.value));
  expect(chips).toEqual(["120000"]);
});

test("marks: an un-audited float is ⚠ with no count and shows only the confirmed digits (M4-5)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await page.evaluate(() => window.pascaline.session.setDigits(30));
  // oracle: besselj(1,2) = 0.576724807756873387202448242269…; the engine falls back to a double here
  await page.evaluate(() => window.pascaline.session.submit("\\operatorname{BesselJ}\\left(1,2\\right)"));
  await expect(lastText(page)).toHaveAttribute("data-text", "0.57672480775687");
  await expect(markOfLast(page)).toHaveText("⚠");
});
