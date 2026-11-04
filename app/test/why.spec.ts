// SPDX-License-Identifier: GPL-3.0-or-later
// R36 (deep-dive item 14): a picked row says in one line why it has its mark. The line sits in the row's action line
// (R11, data-testid "row-why"), is there only while the row is picked, and is worded from the engine's facts
// (G22 why, G38 decided, G39 differ, G50 unaudited complex functions) and the chip table (a constant's σ) through the
// i18n table. The expected texts are the package's own; the digits (9 of 12) are the audit's, normald_icdf(10^-10) at 12.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const why = (page: Page) => page.getByTestId("row-why");

/** Enter `latex` on Home and wait for its row. */
async function run(page: Page, latex: string, rows: number): Promise<void> {
  await page.evaluate((l) => window.pascaline.session.submit(l), latex);
  await done(page, rows);
}

/** Pick the last row (▲ on the empty line) and read its line. */
async function picked(page: Page): Promise<string> {
  await tap(page, ["up"]);
  await expect(why(page)).toBeVisible();
  return (await why(page).innerText()).trim();
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("1/4 is exact, 1/3 is rounded and names its exact value", async ({ page }) => {
  await run(page, "\\frac{1}{4}", 1);
  expect(await picked(page)).toBe("= exact");
  await tap(page, ["esc"]);
  await expect(why(page)).toHaveCount(0); // nowhere but on a picked row
  await run(page, "\\frac{1}{3}", 2);
  expect(await picked(page)).toBe("≈ rounded: the exact value is 1/3");
});

test("an unaudited function names itself (normald_icdf with σ < 0, which the polish refuses)", async ({ page }) => {
  await run(page, "\\operatorname{normald\\_icdf}\\left(2,-1,0.3\\right)", 1);
  expect(await picked(page)).toBe("⚠ normald_icdf is not checked");
});

// The brief's example normald_icdf(10^-10) is not a ⚠ any more: since G44 the home stage polishes the inverse
// distribution functions, so the engine's own line is "≈ rounded" (no exact value to name). The "9 of 12 digits confirmed
// · normald_icdf is not checked" text stays in whyLine.test.ts on hand-built facts.
test("normald_icdf(10^-10): polished by G44, so ≈ with no exact value", async ({ page }) => {
  await run(page, "\\operatorname{normald\\_icdf}\\left(10^{-10}\\right)", 1);
  expect(await picked(page)).toBe("≈ rounded");
  expect(await page.getByTestId("mark").last().innerText()).toBe("≈");
});

// G38: Heaviside of a value that sits on its cut is decided by rounding error (floor(sin(10^100)·10^12) at 12 digits is
// refused since G57, so it has no row to pick); G39: Giac's exact and numeric answers differ.
test("a decision at limited precision (G38)", async ({ page }) => {
  await run(page, "\\operatorname{Heaviside}\\left(\\sin\\left(\\frac{\\pi}{7}\\right)^2+\\cos\\left(\\frac{\\pi}{7}\\right)^2-1\\right)", 1);
  expect(await picked(page)).toBe("⚠ decided at limited precision");
});

test("Giac's exact and numeric answers differ (G39)", async ({ page }) => {
  await run(page, "\\operatorname{int}\\left(\\operatorname{abs}\\left(x-\\sin\\left(10^{50}\\right)\\right),x,-1,1\\right)", 1);
  expect(await picked(page)).toBe("⚠ no digit confirmed · the exact and numeric answers differ");
});

test("a constant with a σ: the result uses G (± 1.5·10⁻¹⁵)", async ({ page }) => {
  await page.evaluate(() => window.pascaline.entry.insertConst("G", "G", { value: "(667430/10^16)", exact: false, unc: "0.00015E-11" }));
  await tap(page, ["mul", "d2", "enter"]);
  await done(page, 1);
  // R40f1: the picked row's why-line ends with the row's own σ line (σ = 1.5ᴇ-15 × 2, derived), so the keys reach it
  expect(await picked(page)).toBe("≈ uses G (± 1.5·10⁻¹⁵) · σ = 3.0ᴇ-15 · U = 2σ = 6.0ᴇ-15 (k = 2)");
});

// R36f1: the stored names behind ≈ are the engine's (why.rounded). Home keeps an exact value exact (docs/04 6.2, 2.8):
// B from 1/3 lends no facts, so B+1 is 4/3 shown rounded (1/3 + 1 = 4/3, derived). √2·1.0 is exact in Home too (1.0
// is an exact decimal; the log holds B:=(sqrt(2))), so the float case stores evalf(√2).
test("Home 1/3 stored to B, then B+1: rounded, the exact value is 4/3", async ({ page }) => {
  await run(page, "\\frac{1}{3}\\blacktriangleright B", 1);
  await run(page, "B+1", 2);
  expect(await picked(page)).toBe("≈ rounded: the exact value is 4/3");
});

test("a stored float: the result uses B, itself rounded", async ({ page }) => {
  await run(page, "\\operatorname{evalf}\\left(\\sqrt{2}\\right)\\blacktriangleright B", 1);
  await run(page, "B+1", 2);
  expect(await picked(page)).toBe("≈ uses B, itself rounded");
});

test("√2·1.0 is exact in Home: B+1 does not say B is rounded", async ({ page }) => {
  await run(page, "\\sqrt{2}\\cdot1.0\\blacktriangleright B", 1);
  await run(page, "B+1", 2);
  const line = await picked(page);
  expect(line).toMatch(/^≈ rounded/);
  expect(line).not.toContain("uses B");
});

test("the row that stores B does not name B, nor does an earlier row after B is overwritten", async ({ page }) => {
  await run(page, "\\frac{1}{3}\\blacktriangleright B", 1);
  await run(page, "B+1", 2);
  await run(page, "\\operatorname{evalf}\\left(\\sqrt{2}\\right)\\blacktriangleright B", 3);
  expect(await picked(page)).not.toContain("uses B");
  await tap(page, ["up"]); // the row before: B+1, run while B held 1/3
  expect((await why(page).innerText()).trim()).toBe("≈ rounded: the exact value is 4/3");
});

test("the line is gone with the pick, and a result with no mark says nothing", async ({ page }) => {
  await run(page, "\\frac{1}{4}", 1);
  await picked(page);
  await tap(page, ["d5"]);
  await expect(why(page)).toHaveCount(0);
});
