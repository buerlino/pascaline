// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt) and the key vibration settings. Uses the real engine (GIAC_OUT).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const lastText = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });

async function openSettings(page: Page): Promise<void> {
  await tap(page, ["shift", "app"]);
  await expect(page.getByRole("dialog")).toBeVisible();
}
const closeSettings = (page: Page) => page.getByRole("button", { name: "Close" }).click();

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

test("fmt with Fraction ticked: 7/3 shows as 7/3 and 2 1/3", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await openSettings(page);
  await page.locator('[data-mode="frac"]').check();
  await page.locator('[data-mode="mixed"]').check();
  await closeSettings(page);
  await tap(page, ["d7", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.33333333333");
  // std -> sci -> eng -> frac -> mixed
  await tap(page, ["fmt", "fmt", "fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "7/3");
  await expect(lastText(page).locator(".math")).toHaveAttribute("data-latex", "\\frac{7}{3}");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2 1/3");
});

test("the Format key cycle and the vibration settings persist across a reload", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await openSettings(page);
  await page.locator('[data-mode="eng"]').uncheck();
  await page.locator('[data-mode="fix"]').check();
  await page.getByTestId("haptics-on").check();
  await page.getByTestId("haptics-ms").fill("40");
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.waitForFunction(() => window.pascaline.session.settings.haptics.on === true);
  await openSettings(page);
  await expect(page.locator('[data-mode="eng"]')).not.toBeChecked();
  await expect(page.locator('[data-mode="fix"]')).toBeChecked();
  await expect(page.locator('[data-mode="std"]')).toBeChecked();
  await expect(page.getByTestId("haptics-on")).toBeChecked();
  await expect(page.getByTestId("haptics-ms")).toHaveValue("40");
  // the web build cannot set the strength
  await expect(page.getByTestId("haptics-strength")).toBeDisabled();
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
  await page.getByTestId("haptics-on").check();
  await closeSettings(page);
  expect(await vib()).toEqual([]);
  await tap(page, ["d3"]);
  expect(await vib()).toEqual([15]); // the default length; one call per key
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
  // the Format key shows the third as an exact fraction: =
  await openSettings(page);
  await page.locator('[data-mode="frac"]').check();
  await closeSettings(page);
  await tap(page, ["fmt", "fmt", "fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1/3");
  await expect(markOfLast(page)).toHaveText("=");
});

test("30 digits: the setting takes 30, Home draws 30 digits and 1/3 stays ≈", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await openSettings(page);
  const digits = page.locator('input[type="number"]').first();
  await digits.fill("45");
  await digits.blur();
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(30);
  await closeSettings(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", `0.${"3".repeat(30)}`);
  await expect(markOfLast(page)).toHaveText("≈");
});

test("PFX: 2500 draws as 2.500 k with a thin space and an accented prefix, from Settings and from the Format key", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await openSettings(page);
  const digits = page.locator('input[type="number"]').first();
  await digits.fill("4");
  await digits.blur();
  await page.locator('[data-mode="pfx"]').check();
  await closeSettings(page);
  await tap(page, ["d2", "d5", "d0", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2500");
  await expect(markOfLast(page)).toHaveText("=");
  // std -> sci -> eng -> pfx
  await tap(page, ["fmt", "fmt", "fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.500 k");
  await expect(lastText(page).locator(".pfx")).toHaveText("k");
  await expect(markOfLast(page)).toHaveText("=");
  // as the global format too
  await openSettings(page);
  await page.getByRole("dialog").locator("select").nth(1).selectOption("pfx");
  await closeSettings(page);
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
