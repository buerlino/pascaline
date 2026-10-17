// SPDX-License-Identifier: GPL-3.0-or-later
// R10: the Tmpl palette (spec/keyboard.yaml `templates:`) and the a b/c key, on the real engine. Every template is
// filled from the keys and must give exactly its `sample` (so the parser cases are what MathLive really writes),
// then its value. Expected values derived by hand (parser.yaml `tmpl-*`); 2.5 ↔ 5/2 is G2 item 29 (device).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const sheet = (page: Page) => page.getByTestId("menu");
const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");

/** Tmpl, then a tap on the cell. */
async function insert(page: Page, id: string): Promise<void> {
  await tap(page, ["tmpl"]);
  await sheet(page).locator(`[data-id="${id}"]`).tap();
  await expect(sheet(page)).toBeHidden();
}

test("Tmpl opens the 6 × 3 grid on the fraction; arrows move in two dimensions; Enter inserts; Tmpl and Esc close", async ({ page }) => {
  await tap(page, ["tmpl"]);
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(18);
  await expect(active(page)).toHaveAttribute("data-id", "frac");
  await expect(page.getByTestId("sheet-hint")).toHaveText("Fraction");
  await tap(page, ["down"]);
  await expect(active(page)).toHaveAttribute("data-id", "sqrt");
  await tap(page, ["right"]);
  await expect(active(page)).toHaveAttribute("data-id", "nthroot");
  await tap(page, ["up", "up"]); // round the column: power, then mixed
  await expect(active(page)).toHaveAttribute("data-id", "mixed");
  await tap(page, ["left"]);
  await expect(active(page)).toHaveAttribute("data-id", "abs");
  await tap(page, ["d1", "sin"]); // digits and letters do nothing in the grid, nothing goes through
  await expect(active(page)).toHaveAttribute("data-id", "abs");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["enter", "neg", "d3"]);
  expect(await entryValue(page)).toBe("\\left|-3\\right|");
  // the last pick is remembered: Tmpl, Enter repeats it
  await tap(page, ["esc", "tmpl"]);
  await expect(active(page)).toHaveAttribute("data-id", "abs");
  await tap(page, ["tmpl"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["tmpl", "esc"]);
  await expect(sheet(page)).toBeHidden();
});

// [cell, keys after the insert, the yaml sample, the Home result]
const FILLS: [string, string[], string, string | undefined][] = [
  ["evalat", ["x", "sq", "right", "x", "right", "d3"], "\\left.x^2\\right|_{x=3}", "9"],
  ["deriv", ["x", "sq", "right", "x"], "\\frac{\\partial x^2}{\\partial x}", undefined],
  ["cases", ["x", "right", "x", "shift", "dot", "d0", "right", "d1", "right", "x", "shift", "dot", "d1"], "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}", undefined],
  ["matrix22", ["d1", "right", "d2", "right", "d3", "right", "d4"], "\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}", undefined],
  // (R43, F34: ▶ out of sin's bracket stops at the end of the numerator; the next ▶ goes to the denominator)
  ["limit", ["x", "right", "d0", "right", "div", "sin", "x", "right", "right", "x"], "\\lim_{x\\to0}\\left(\\frac{\\sin\\left(x\\right)}{x}\\right)", "1"],
  ["integral", ["neg", "d1", "right", "d1", "d0", "right", "x", "sq", "right", "x"], "\\int_{-1}^{10}x^2\\,\\mathrm{d}x", "333.666666667"],
  ["rowvec", ["d1", "right", "d2"], "\\begin{pmatrix}1 & 2\\end{pmatrix}", undefined],
  ["colvec", ["d1", "right", "d2"], "\\begin{pmatrix}1\\\\ 2\\end{pmatrix}", undefined],
  ["sum", ["shift", "alpha", "log", "right", "d1", "right", "d1", "d0", "right", "shift", "alpha", "log", "sq"], "\\sum_{k=1}^{10}\\left(k^2\\right)", "385"],
  ["product", ["shift", "alpha", "log", "right", "d1", "right", "d1", "d0", "right", "shift", "alpha", "log"], "\\prod_{k=1}^{10}\\left(k\\right)", "3628800"],
  ["logbase", ["d1", "d6", "right", "d2", "d5", "d6"], "\\log_{16}\\left(256\\right)", "2"],
];

for (const [id, keys, sample, result] of FILLS)
  test(`${id}: filled from the keys it is ${sample}${result ? ` = ${result}` : ""}`, async ({ page }) => {
    await insert(page, id);
    await tap(page, keys);
    expect(await entryValue(page)).toBe(sample);
    if (result === undefined) return;
    await tap(page, ["enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", result);
  });

test("mixed number: 2, then the template takes the 2 as its whole part: 2 11/13 = 37/13", async ({ page }) => {
  await tap(page, ["d2"]);
  await insert(page, "mixed");
  await tap(page, ["d1", "d1", "right", "d1", "d3"]);
  expect(await entryValue(page)).toBe("2\\tfrac{11}{13}");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "2.84615384615");
});

test("DMS: 30°15′36″ is 30.26 in DEG and sin(30°0′0″) = 0.5 in RAD and DEG (degrees in every angle mode)", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  await insert(page, "dms");
  await tap(page, ["d3", "d0", "right", "d1", "d5", "right", "d3", "d6"]);
  expect(await entryValue(page)).toBe("30\\degree15\\prime36\\doubleprime");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "30.26");
  for (const angle of ["deg", "rad"] as const) {
    await page.evaluate((a) => window.pascaline.session.setAngle(a), angle);
    await tap(page, ["sin"]);
    await insert(page, "dms");
    // the key takes sin's selected □ as its degrees, in brackets (R17): `(30)`. R43: ▶ out of the bracket stops at the
    // end of the degrees box, the next ▶ goes to the minutes
    await tap(page, ["d3", "d0", "right", "right", "d0", "right", "d0", "enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", "0.5");
  }
});

test("a key's template from the palette: the root and the power, as their keys insert them", async ({ page }) => {
  await insert(page, "sqrt");
  await tap(page, ["d9", "right", "add"]);
  await insert(page, "power");
  await tap(page, ["d2", "right", "d3"]);
  expect(await entryValue(page)).toBe("\\sqrt9+2^3"); // MathLive writes one-digit arguments without braces
});

test("a b/c on an empty line: 2.5 ↔ 5/2 (as on the G2), a+bi ↔ polar; while typing it is the fraction", async ({ page }) => {
  await tap(page, ["d5", "div", "d2", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "2.5");
  await tap(page, ["frac"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "5/2");
  await tap(page, ["frac"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "2.5");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["d3", "add", "d4", "shift", "d2", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3+4*i");
  await tap(page, ["frac"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "5∡0.927295218002"); // atan(4/3), oracle
  await tap(page, ["frac"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3+4*i");
  await tap(page, ["d1", "frac", "d4"]);
  expect(await entryValue(page)).toBe("\\frac14");
});

test("a b/c in CAS: exact 5/2 ↔ 2.5", async ({ page }) => {
  await tap(page, ["u3", "d5", "div", "d2", "enter"]);
  const last = page.locator('[data-testid="result"]').last().locator(".math");
  await expect(last).toHaveAttribute("data-latex", "\\frac{5}{2}");
  await tap(page, ["frac"]);
  await expect(last).toHaveAttribute("data-latex", "2.5");
  await tap(page, ["frac"]);
  await expect(last).toHaveAttribute("data-latex", "\\frac{5}{2}");
});
