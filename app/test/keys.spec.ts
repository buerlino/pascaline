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

// Found in R1 (decisions M4-2): an operator typed right after an exponent went into the exponent, silently
// (2.2E-9 × 4.7E3 = 2.2E-42300). An operator key ends the exponent; (−) and an empty exponent keep the sign.
test("E notation: × after an exponent ends it, so 2.2E-9 × 4.7E3 = 1.034E-5", async ({ page }) => {
  await tap(page, ["d2", "dot", "d2", "eex", "neg", "d9", "mul", "d4", "dot", "d7", "eex", "d3"]);
  expect(await entryValue(page)).toBe("2.2\\times10^{-9}\\times4.7\\times10^3");
  await tap(page, ["enter"]);
  await resultIs(page, "1.034E-5", 1);
});

test("E notation: + − ÷ also end the exponent; a sign right after EEX stays in it", async ({ page }) => {
  await tap(page, ["d2", "eex", "d3", "add", "d1", "enter"]);
  await resultIs(page, "2001", 1);
  await tap(page, ["d2", "eex", "d3", "sub", "d1", "enter"]);
  await resultIs(page, "1999", 2);
  await tap(page, ["d4", "eex", "d3", "div", "d8", "enter"]);
  await resultIs(page, "500", 3);
  await tap(page, ["d5", "eex", "sub", "d1", "enter"]); // 5E−1: the sign belongs to the exponent
  await resultIs(page, "0.5", 4);
  await tap(page, ["d5", "eex", "add", "d2", "enter"]); // 5E+2
  await resultIs(page, "500", 5);
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
  expect(await entryValue(page)).toBe("\\res{1}{15}"); // a chip carrying the result (docs/04 2.8)
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

// L8 (user, 2026-10-12): after a fraction, root, power or mixed number, x² (and the other #@^ keys: xʸ, x⁻¹) wraps
// the whole term in brackets. Inside a numerator or denominator it squares the last term there (user, 2026-10-12);
// ▶ leaves the part first. Inside a mixed number it squares the whole number (its parts are whole numbers).
test("x² after a fraction squares the whole fraction; inside it squares the part", async ({ page }) => {
  await tap(page, ["d1", "frac", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(\\frac12\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "0.25", 1); // derived: (1/2)² = 1/4
  await tap(page, ["d3", "frac", "d2", "sq"]);
  expect(await entryValue(page)).toBe("\\frac{3}{2^2}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.75", 2); // derived: 3/2² = 3/4
  await tap(page, ["d1", "div", "x", "sq"]);
  expect(await entryValue(page)).toBe("\\frac{1}{x^2}");
  await tap(page, ["esc", "d3", "frac", "d2", "right", "sq", "enter"]);
  await resultIs(page, "2.25", 3); // derived: (3/2)² = 9/4
});

test("x² after a sum still squares only the last term", async ({ page }) => {
  await tap(page, ["d1", "add", "d3", "sq"]);
  expect(await entryValue(page)).toBe("1+3^2");
  await tap(page, ["enter"]);
  await resultIs(page, "10", 1);
});

test("x² after a root, a power or a mixed number squares the whole term", async ({ page }) => {
  await tap(page, ["shift", "sq", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(\\sqrt2\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "2", 1); // derived: (√2)² = 2
  await tap(page, ["shift", "pow", "d3", "right", "d8", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(\\sqrt[3]{8}\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "4", 2); // derived: (∛8)² = 4
  // ▶ leaves the exponent; without the brackets MathLive would merge the 2 into it (2^{32})
  await tap(page, ["d2", "pow", "d3", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(2^3\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "64", 3); // derived: (2³)² = 64
  await tap(page, ["d2", "frac", "frac", "d1", "right", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(2\\tfrac12\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "6.25", 4); // derived: (5/2)² = 25/4
  await tap(page, ["d2", "frac", "frac", "d1", "right", "d2", "sq"]);
  expect(await entryValue(page)).toBe("\\left(2\\tfrac12\\right)^2");
});

test("x² after a function call or a bracket keeps the plain square", async ({ page }) => {
  await tap(page, ["sin", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\sin\\left(2\\right)^2");
  await tap(page, ["esc", "paren", "d1", "add", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(1+2\\right)^2");
  await tap(page, ["enter"]);
  await resultIs(page, "9", 1);
});

test("xʸ and x⁻¹ after a fraction also take the whole fraction", async ({ page }) => {
  await tap(page, ["d1", "frac", "d2", "right", "pow", "d3"]);
  expect(await entryValue(page)).toBe("\\left(\\frac12\\right)^3");
  await tap(page, ["enter"]);
  await resultIs(page, "0.125", 1); // derived: (1/2)³ = 1/8
  await tap(page, ["d1", "frac", "d4", "right", "shift", "div"]);
  expect(await entryValue(page)).toBe("\\left(\\frac14\\right)^{-1}");
  await tap(page, ["enter"]);
  await resultIs(page, "4", 2); // derived: (1/4)⁻¹ = 4
});

// L9 (2026-10-12): ÷ and a/b right after a fraction, root, power or mixed number divide the whole term: the term
// becomes the numerator (\frac{\frac12}{3}), not a new fraction multiplied onto it.
test("÷ after a fraction divides the whole fraction", async ({ page }) => {
  await tap(page, ["d1", "frac", "d2", "right", "div", "d3"]);
  expect(await entryValue(page)).toBe("\\frac{\\frac12}{3}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.166666666667", 1); // derived: (1/2)/3 = 1/6
  await tap(page, ["d1", "frac", "d2", "right", "frac", "d3"]);
  expect(await entryValue(page)).toBe("\\frac{\\frac12}{3}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.166666666667", 2); // a/b behaves like ÷ here
});

test("÷ after a root, a power or a mixed number divides the whole term", async ({ page }) => {
  await tap(page, ["shift", "sq", "d4", "right", "div", "d2"]);
  expect(await entryValue(page)).toBe("\\frac{\\sqrt4}{2}");
  await tap(page, ["enter"]);
  await resultIs(page, "1", 1); // derived: √4 / 2 = 1
  await tap(page, ["d2", "pow", "d3", "right", "div", "d4"]);
  expect(await entryValue(page)).toBe("\\frac{2^3}{4}");
  await tap(page, ["enter"]);
  await resultIs(page, "2", 2); // derived: 2³/4 = 2 (not 2^(3/4))
  await tap(page, ["d2", "frac", "frac", "d1", "right", "d2", "right", "div", "d5"]);
  expect(await entryValue(page)).toBe("\\frac{2\\tfrac12}{5}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.5", 3); // derived: (5/2)/5 = 1/2
});

test("÷ after a plain number or a sum is unchanged", async ({ page }) => {
  await tap(page, ["d1", "add", "d6", "div", "d3"]);
  expect(await entryValue(page)).toBe("1+\\frac63");
  await tap(page, ["enter"]);
  await resultIs(page, "3", 1);
});

// docs/04 2.3 #1: 0 x F F typed with the keys was read as 0·x·F·F = 0 and shown as an exact result.
test("0xFF typed with the keys is an error, not 0", async ({ page }) => {
  await tap(page, ["d0", "x", "alpha", "pow", "alpha", "pow"]);
  expect(await entryValue(page)).toBe("0xFF");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await expect(page.locator('[data-status="error"] .error')).toContainText("0x");
});

// docs/04 2.3 #8: a tapped result carries its full value, so 1/3 tapped and ×3 is 1, not 0.999999999999.
test("1/3, tap the result, ×3 is 1", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await resultIs(page, "0.333333333333", 1);
  await lastResult(page).tap();
  await tap(page, ["mul", "d3", "enter"]);
  await resultIs(page, "1", 2); // derived: (1/3)·3 = 1
});

// docs/04 2.8: Ans on Shift + (the reference's position), read when Enter is pressed.
test("shift + is Ans, the view's last result", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await resultIs(page, "0.333333333333", 1);
  await tap(page, ["d2", "add", "shift", "add"]);
  expect(await entryValue(page)).toBe("2+\\ans");
  await tap(page, ["mul", "d3", "enter"]);
  await resultIs(page, "3", 2); // derived: 2 + (1/3)·3, Ans carries 1/3 exactly
  // CAS has its own Ans
  await tap(page, ["app", "x", "add", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d2", "mul", "shift", "add", "enter"]);
  await expect(page.locator('[data-testid="result"]').last().locator(".math")).toHaveAttribute("data-latex", /2\\left\(x\+1\\right\)|2x\+2/);
});

// docs/04 2.8: + − × ÷ xʸ x² x⁻¹ on an empty line start with Ans; (−) stays negation.
test("an operator on an empty line starts with Ans; (−) stays negation", async ({ page }) => {
  // no result yet: − is just a minus
  await tap(page, ["sub", "d5", "enter"]);
  await resultIs(page, "-5", 1);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await resultIs(page, "0.333333333333", 2);
  await tap(page, ["mul"]);
  expect(await entryValue(page)).toBe("\\ans\\times");
  await tap(page, ["d3", "enter"]);
  await resultIs(page, "1", 3); // derived: (1/3)·3
  await tap(page, ["add", "d1", "enter"]);
  await resultIs(page, "2", 4);
  await tap(page, ["sq"]);
  expect(await entryValue(page)).toBe("\\ans^2");
  await tap(page, ["enter"]);
  await resultIs(page, "4", 5);
  await tap(page, ["div", "d8"]);
  expect(await entryValue(page)).toBe("\\frac{\\ans}{8}");
  await tap(page, ["enter"]);
  await resultIs(page, "0.5", 6);
  await tap(page, ["shift", "div", "enter"]);
  await resultIs(page, "2", 7); // (1/2)⁻¹
  await tap(page, ["pow", "d3", "enter"]);
  await resultIs(page, "8", 8);
  await tap(page, ["sub", "d1", "enter"]);
  await resultIs(page, "7", 9);
  await tap(page, ["neg", "d2", "enter"]);
  await resultIs(page, "-2", 10); // (−) is negation, not Ans−
});
