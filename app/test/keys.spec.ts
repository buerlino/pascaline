// SPDX-License-Identifier: GPL-3.0-or-later
// P4 (docs/decisions.md): the reference's logical key layout. One test per moved or new key, key sequences on the real
// engine. Expected values are derived (mathematically provable) unless noted.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const resultIs = async (page: Page, text: string | RegExp, count: number) => {
  await expect(page.locator('[data-status="done"]')).toHaveCount(count);
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};

test("shift 3 is π, shift 2 is i", async ({ page }) => {
  await tap(page, ["d2", "shift", "d3"]);
  expect(await entryValue(page)).toBe("2\\pi");
  await tap(page, ["esc", "shift", "d2"]);
  expect(await entryValue(page)).toBe("\\imaginaryI");
  await tap(page, ["mul", "shift", "d2", "enter"]);
  await resultIs(page, "-1", 1); // i·i
});

test("shift ln is e^x, shift log is 10^x", async ({ page }) => {
  await tap(page, ["shift", "ln", "d0"]);
  expect(await entryValue(page)).toBe("\\exponentialE^0");
  await tap(page, ["enter"]);
  await resultIs(page, "1", 1);
  await tap(page, ["shift", "log", "d2", "enter"]);
  await resultIs(page, "100", 2);
});

test("shift ÷ is x⁻¹ of what is before the cursor", async ({ page }) => {
  await tap(page, ["d4", "shift", "div"]);
  expect(await entryValue(page)).toBe("4^{-1}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.25", 1);
});

test("shift . is =, and the ≈ key (shift Enter) wraps approx()", async ({ page }) => {
  await tap(page, ["d1", "shift", "dot"]);
  expect(await entryValue(page)).toBe("1=");
  await tap(page, ["esc", "shift", "enter", "d1", "frac", "d3"]);
  expect(await entryValue(page)).toBe("\\operatorname{\\mathrm{approx}}\\left(\\frac13\\right)");
  await tap(page, ["enter"]);
  await resultIs(page, "0.333333333333", 1);
});

test("inverse trigonometry sits on shift sin, cos, tan", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  await tap(page, ["shift", "sin", "d1", "enter"]);
  await resultIs(page, "90", 1);
  await tap(page, ["shift", "cos", "d1", "enter"]);
  await resultIs(page, "0", 2);
  await tap(page, ["shift", "tan", "d1", "enter"]);
  await resultIs(page, "45", 3);
});

test("(−) negates, shift (−) is |x|", async ({ page }) => {
  await tap(page, ["neg", "d5", "add", "d2", "enter"]);
  await resultIs(page, "-3", 1);
  await tap(page, ["shift", "neg", "neg", "d3"]);
  expect(await entryValue(page)).toBe("\\left|-3\\right|");
  await tap(page, ["enter"]);
  await resultIs(page, "3", 2);
});

test("( ) inserts a pair with the cursor inside", async ({ page }) => {
  await tap(page, ["paren", "d1", "add", "d2"]);
  expect(await entryValue(page)).toBe("\\left(1+2\\right)");
  await tap(page, ["right", "mul", "d3", "enter"]);
  await resultIs(page, "9", 1);
});

test("x^y, shift x^y is the n-th root; x² and shift x² the square root", async ({ page }) => {
  await tap(page, ["d2", "pow", "d1", "d0", "enter"]);
  await resultIs(page, "1024", 1);
  await tap(page, ["shift", "pow", "d3", "right", "d8"]);
  expect(await entryValue(page)).toBe("\\sqrt[3]{8}");
  await tap(page, ["enter"]);
  await resultIs(page, "2", 2);
  await tap(page, ["d3", "sq", "enter"]);
  await resultIs(page, "9", 3);
  await tap(page, ["shift", "sq", "d1", "d6", "enter"]);
  await resultIs(page, "4", 4);
});

test("EEX types ×10^ with the cursor in the exponent", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "eex", "d3"]);
  expect(await entryValue(page)).toBe("1.5\\times10^3");
  await tap(page, ["enter"]);
  await resultIs(page, "1500", 1);
});

test("store: value ▶ name, then the name reads back", async ({ page }) => {
  await tap(page, ["d9", "shift", "eex", "alpha", "d1"]);
  expect(await entryValue(page)).toBe("9\\blacktriangleright Y");
  await tap(page, ["enter"]);
  await resultIs(page, "9", 1);
  await tap(page, ["alpha", "d1", "mul", "d2", "enter"]);
  await resultIs(page, "18", 2);
});

test("∡ polar entry follows the angle mode: 2∡1 rad, 2∡30 deg", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setAngle("rad"));
  await tap(page, ["d2", "shift", "mul", "d1"]);
  expect(await entryValue(page)).toBe("2\\mathbin{\\measuredangle}1");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  // oracle (mpmath): 2cos(1) = 1.08060461174, 2sin(1) = 1.68294196962
  expect(await lastResult(page).getAttribute("data-text")).toMatch(/^1\.08060461174\+1\.68294196962\*?i$/);
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  await tap(page, ["esc", "d2", "shift", "mul", "d3", "d0", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  // derived: 2(cos 30° + i sin 30°) = √3 + i
  expect(await lastResult(page).getAttribute("data-text")).toMatch(/^1\.73205080757\+1?\*?i$/);
  // the angle can be a fraction: ÷ does not take the sign into its numerator; rad: 2∡π/6 is √3 + i too
  await page.evaluate(() => window.pascaline.session.setAngle("rad"));
  await tap(page, ["esc", "d2", "shift", "mul", "shift", "d3", "div", "d6"]);
  expect(await entryValue(page)).toBe("2\\mathbin{\\measuredangle}\\frac{\\pi}{6}");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  expect(await lastResult(page).getAttribute("data-text")).toMatch(/^1\.73205080757\+1?\*?i$/);
});

test("Up on an empty line picks the last history row, Enter inserts it", async ({ page }) => {
  await tap(page, ["d1", "d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d7", "mul", "d2", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await tap(page, ["up"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await expect(page.locator('[data-selected="true"] .result')).toHaveAttribute("data-text", "15");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  expect(await entryValue(page)).toBe("15");
  // with something typed, Up is an ordinary cursor key: no pick
  await tap(page, ["up"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
});

test("tapping inside an entered expression moves the cursor there", async ({ page }) => {
  await tap(page, ["d1", "d2", "d3", "d4"]);
  const mf = page.locator("math-field").first();
  // the second glyph's right edge: between "2" and "3"
  const glyphs = mf.locator(".ML__content .ML__cmr");
  const box = await glyphs.nth(1).boundingBox();
  if (!box) throw new Error("no glyph box");
  await page.touchscreen.tap(box.x + box.width + 1, box.y + box.height / 2);
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("12934");
  // and a tap before the first glyph puts the cursor at the start
  const first = await glyphs.first().boundingBox();
  if (!first) throw new Error("no glyph box");
  await page.touchscreen.tap(first.x - 1, first.y + first.height / 2);
  await tap(page, ["d8"]);
  expect(await entryValue(page)).toBe("812934");
});
