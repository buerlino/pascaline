// SPDX-License-Identifier: GPL-3.0-or-later
// R18: the Shift palettes, on the real engine. Shift + 6 is the G2's relations and logic grid (4 × 3, each cell picked
// by the key at its place, shown on the cell); Shift + 9 its symbols and Greek grid (8 × 3, no key labels, G2 item 37).
// Both open on the last pick, Esc and Cancel close them, and the digits pick inside them, so Shift + 6 cannot toggle.
// Every cell is picked here by key or by tap and evaluated; the entry strings are what MathLive writes (the parser
// cases of tests/golden/parser.yaml group "palettes" use them). Expected values derived by hand.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const sheet = (page: Page) => page.getByTestId("menu");
const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const lastRow = (page: Page) => page.locator('[data-testid="result"]').last();
const lastResult = (page: Page) => lastRow(page).locator(".result");

/** Shift + the key, then a tap on the cell. */
async function tapCell(page: Page, opener: "d6" | "d9", id: string): Promise<void> {
  await tap(page, ["shift", opener]);
  await sheet(page).locator(`[data-id="${id}"]`).tap();
  await expect(sheet(page)).toBeHidden();
}

test("Shift + 6: the 4 × 3 grid shows 7 8 9 ÷ / 4 5 6 × / 1 2 3; that key picks its cell; Esc, Cancel close; 6 picks AND", async ({ page }) => {
  await tap(page, ["shift", "d6"]);
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(11);
  await expect(page.getByTestId("sheet-title")).toHaveText("Relations and logic");
  await expect(sheet(page).getByTestId("cell-key")).toHaveText(["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3"]);
  await expect(active(page)).toHaveAttribute("data-id", "lt");
  await tap(page, ["down", "right"]);
  await expect(active(page)).toHaveAttribute("data-id", "ne");
  await expect(page.getByTestId("sheet-hint")).toHaveText("Not equal");
  await tap(page, ["d8"]); // the key at ≤'s place picks it, wherever the highlight is
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\le");
  // it opens on the last pick, so Shift + 6, Enter repeats it
  await tap(page, ["shift", "d6"]);
  await expect(active(page)).toHaveAttribute("data-id", "le");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["shift", "d6", "cancel"]);
  await expect(sheet(page)).toBeHidden();
  // Shift + 6 inside the palette is the key 6: it picks AND, it does not close
  await tap(page, ["shift", "d6", "shift", "d6"]);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\le\\operatorname{\\mathrm{AND}}");
});

// [keys, the entry MathLive writes, the Home result]; "S6" = Shift + 6 (the next key picks by its place)
const S6 = ["shift", "d6"];
const BY_KEY: [string, string[], string, string][] = [
  ["2 ≤ 3", ["d2", ...S6, "d8", "d3"], "2\\le3", "true"],
  ["3 ≥ 4", ["d3", ...S6, "div", "d4"], "3\\ge4", "false"],
  ["2 < 1", ["d2", ...S6, "d7", "d1"], "2<1", "false"],
  ["2 > 1", ["d2", ...S6, "d9", "d1"], "2>1", "true"],
  ["2 == 2", ["d2", ...S6, "d4", "d2"], "2==2", "true"],
  ["1 ≠ 2", ["d1", ...S6, "d5", "d2"], "1\\ne2", "true"],
  ["2>1 AND 1<2", ["d2", ...S6, "d9", "d1", ...S6, "d6", "d1", ...S6, "d7", "d2"], "2>1\\operatorname{\\mathrm{AND}}1<2", "true"],
  ["2<1 OR 1<2", ["d2", ...S6, "d7", "d1", ...S6, "mul", "d1", ...S6, "d7", "d2"], "2<1\\operatorname{\\mathrm{OR}}1<2", "true"],
  ["2>1 XOR 1<2", ["d2", ...S6, "d9", "d1", ...S6, "d2", "d1", ...S6, "d7", "d2"], "2>1\\operatorname{\\mathrm{XOR}}1<2", "false"],
  ["2<1 XOR 1<2", ["d2", ...S6, "d7", "d1", ...S6, "d2", "d1", ...S6, "d7", "d2"], "2<1\\operatorname{\\mathrm{XOR}}1<2", "true"],
  ["NOT(2<1)", [...S6, "d1", "d2", ...S6, "d7", "d1"], "\\operatorname{\\mathrm{NOT}}\\left(2<1\\right)", "true"],
  ["EQ(2,2)", [...S6, "d3", "d2", "right", "d2"], "\\operatorname{\\mathrm{EQ}}\\left(2,2\\right)", "true"],
  ["EQ(2,3)", [...S6, "d3", "d2", "right", "d3"], "\\operatorname{\\mathrm{EQ}}\\left(2,3\\right)", "false"],
];

for (const [name, keys, entry, result] of BY_KEY)
  test(`Shift + 6 by key: ${name} = ${result}`, async ({ page }) => {
    await tap(page, keys);
    expect(await entryValue(page)).toBe(entry);
    await tap(page, ["enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", result);
  });

// MathLive writes \operatorname{AND} on an empty line and \operatorname{\mathrm{AND}} after a term; the parser reads both
test("Shift + 6 by tap: every cell, between 2 and 3", async ({ page }) => {
  const cells: [string, string][] = [
    ["lt", "2<3"], ["le", "2\\le3"], ["gt", "2>3"], ["ge", "2\\ge3"], ["eqeq", "2==3"], ["ne", "2\\ne3"],
    ["and", "2\\operatorname{\\mathrm{AND}}3"], ["or", "2\\operatorname{\\mathrm{OR}}3"], ["xor", "2\\operatorname{\\mathrm{XOR}}3"],
    ["not", "2\\operatorname{\\mathrm{NOT}}\\left(3\\right)"], ["eq", "2\\operatorname{\\mathrm{EQ}}\\left(3,\\placeholder{}\\right)"],
  ];
  for (const [id, latex] of cells) {
    await tap(page, ["esc", "d2"]);
    await tapCell(page, "d6", id);
    await tap(page, ["d3"]);
    expect(await entryValue(page), id).toBe(latex);
  }
});

test("Shift + 9: the 8 × 3 grid has no key labels; digits do nothing; arrows, Enter; the last pick; Esc and Cancel close", async ({ page }) => {
  await tap(page, ["shift", "d9"]);
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(24);
  await expect(page.getByTestId("sheet-title")).toHaveText("Symbols and Greek");
  await expect(sheet(page).getByTestId("cell-key")).toHaveCount(0);
  await expect(active(page)).toHaveAttribute("data-id", "fact");
  await tap(page, ["d1", "d9", "sin"]); // nothing goes through, nothing is picked
  await expect(active(page)).toHaveAttribute("data-id", "fact");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["down", "right"]);
  await expect(active(page)).toHaveAttribute("data-id", "beta");
  await expect(page.getByTestId("sheet-hint")).toHaveText("beta");
  await tap(page, ["enter"]);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\beta");
  await tap(page, ["shift", "d9"]);
  await expect(active(page)).toHaveAttribute("data-id", "beta");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["shift", "d9", "cancel"]);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\beta");
});

test("Shift + 9 by tap: every cell inserts its symbol, in math mode (a digit typed after it stays maths)", async ({ page }) => {
  const cells: [string, string][] = [
    ["fact", "!"], ["arrow", "\\rightarrow"], ["inf", "\\infty"], ["deg", "\\degree"], ["minute", "\\prime"],
    ["second", "\\doubleprime"], ["amp", "\\&"], ["aring", "\\AA"], ["alpha", "\\alpha"], ["beta", "\\beta"],
    ["gamma", "\\gamma"], ["Delta", "\\Delta"], ["delta", "\\delta"], ["epsilon", "\\varepsilon"], ["theta", "\\theta"],
    ["lambda", "\\lambda"], ["mu", "\\mu"], ["rho", "\\rho"], ["Sigma", "\\Sigma"], ["sigma", "\\sigma"], ["tau", "\\tau"],
    ["phi", "\\varphi"], ["chi", "\\chi"], ["Omega", "\\Omega"],
  ];
  for (const [id, latex] of cells) {
    await tap(page, ["esc"]);
    await tapCell(page, "d9", id);
    await tap(page, ["d3"]);
    expect(await entryValue(page), id).toBe(`${latex}3`);
  }
});

test("Shift + 9 values: 5! = 120; ∞; 30° is 30 in DEG; sin(30°) = 0.5 in RAD; 30°15′36″ = 30.26 in DEG", async ({ page }) => {
  await tap(page, ["d5"]);
  await tapCell(page, "d9", "fact");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "120");
  await tapCell(page, "d9", "inf");
  await tap(page, ["enter"]);
  await expect(lastRow(page)).toContainText("+∞");
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  await tap(page, ["d3", "d0"]);
  await tapCell(page, "d9", "deg");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "30");
  await tap(page, ["d3", "d0"]);
  await tapCell(page, "d9", "deg");
  await tap(page, ["d1", "d5"]);
  await tapCell(page, "d9", "minute");
  await tap(page, ["d3", "d6"]);
  await tapCell(page, "d9", "second");
  expect(await entryValue(page)).toBe("30\\degree15\\prime36\\doubleprime");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "30.26");
  await page.evaluate(() => window.pascaline.session.setAngle("rad"));
  await tap(page, ["sin", "d3", "d0"]);
  await tapCell(page, "d9", "deg");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.5");
});

test("Greek letters are variables, β too (Giac's Beta name is kept free): 3 ▶ β, β × 2 = 6; μ and Ω are names, not units", async ({ page }) => {
  await tap(page, ["d3", "shift", "emark"]);
  await tapCell(page, "d9", "beta");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3");
  await tapCell(page, "d9", "beta");
  await tap(page, ["mul", "d2", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "6");
  await tap(page, ["d4", "shift", "emark"]);
  await tapCell(page, "d9", "mu");
  await tap(page, ["enter"]);
  await tap(page, ["d5", "shift", "emark"]);
  await tapCell(page, "d9", "Omega");
  await tap(page, ["enter"]);
  await tapCell(page, "d9", "mu");
  await tap(page, ["mul"]);
  await tapCell(page, "d9", "Omega");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "20");
});

test("CAS draws the stand-in names as their letters: 2γ² is 2\\gamma^{2}, not gamma_", async ({ page }) => {
  await tap(page, ["app"]); // Home → CAS
  await tap(page, ["d2"]);
  await tapCell(page, "d9", "gamma");
  await tap(page, ["sq", "enter"]);
  await expect(lastResult(page).locator("[data-latex]")).toHaveAttribute("data-latex", "2\\gamma^{2}");
});

test("& and Å are refused with a message, never read as something else", async ({ page }) => {
  await tap(page, ["d1"]);
  await tapCell(page, "d9", "amp");
  await tap(page, ["d2", "enter"]);
  await expect(lastRow(page).getByRole("alert")).toContainText("& has no meaning here yet");
  await tap(page, ["d5"]);
  await tapCell(page, "d9", "aring");
  await tap(page, ["enter"]);
  await expect(lastRow(page).getByRole("alert")).toContainText("Å is a unit");
});
