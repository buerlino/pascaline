// SPDX-License-Identifier: GPL-3.0-or-later
// Entry leftovers L2–L5 (docs/backlog.md), key-sequence tests on the real engine. Expected values are derived.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");

test("a b/c while typing is the stacked fraction; pressed twice it is two fractions, no mixed number (R10)", async ({ page }) => {
  await tap(page, ["d1", "frac", "d4", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.25");
  await tap(page, ["d2", "frac", "frac", "d1", "right", "d2"]);
  expect(await entryValue(page)).not.toContain("tfrac");
});

test("L3: alpha twice locks capitals, alpha again unlocks; shift alpha alpha locks lower case", async ({ page }) => {
  const alpha = page.locator('[data-key="alpha"]');
  await tap(page, ["alpha", "alpha"]);
  await expect(alpha).toHaveAttribute("data-locked", "true");
  await tap(page, ["sin", "cos", "tan"]);
  expect(await entryValue(page)).toBe("GHI");
  await tap(page, ["alpha"]);
  await expect(alpha).not.toHaveAttribute("data-locked", "true");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("GHI7");
  await tap(page, ["esc", "shift", "alpha", "alpha", "sin", "cos", "shift", "tan"]);
  expect(await entryValue(page)).toBe("ghI");
  await tap(page, ["alpha", "alpha", "d7"]); // unlock, then a one-shot alpha
  expect(await entryValue(page)).toBe("ghIQ");
});

test("alpha: one-shot alpha types the capital of the key, shift alpha its lower case", async ({ page }) => {
  await tap(page, ["alpha", "vars", "alpha", "d4", "shift", "alpha", "d4", "shift", "alpha", "sin"]);
  expect(await entryValue(page)).toBe("AUug");
});

test("L4: in one-line mode xʸ and a typed ^ are a literal caret; 2^10 gives 1024", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setEntry("line"));
  await tap(page, ["d2", "pow", "d1", "d0"]);
  expect(await entryValue(page)).toBe('2\\char"5E 10');
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1024");
  await page.locator("math-field").first().focus();
  await page.keyboard.type("3^2+1");
  expect(await entryValue(page)).toBe('3\\char"5E 2+1');
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "10");
});

test("L5: tapping a result puts it on the entry line, in Home and CAS", async ({ page }) => {
  await tap(page, ["d1", "div", "d4", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.25");
  await tap(page, ["d2", "mul"]);
  await lastResult(page).tap();
  expect(await entryValue(page)).toBe("2\\times\\res{1}{0.25}"); // a chip carrying 1/4 (docs/04 2.8)
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.5");
  // CAS: the chip x+1 is one factor, so 2×(x+1) stays a product
  await tap(page, ["app"]);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "cas");
  await tap(page, ["x", "add", "d1", "enter"]);
  await expect(page.locator('[data-testid="result"]').last().locator(".math")).toHaveAttribute("data-latex", "x+1");
  await tap(page, ["d2", "mul"]);
  await lastResult(page).tap();
  expect(await entryValue(page)).toBe("2\\times\\res{2}{x+1}"); // the second chip of the session: the counter no longer restarts at Enter (R16)
  await tap(page, ["enter"]);
  await expect(page.locator('[data-testid="result"]').last().locator(".math")).toHaveAttribute("data-latex", /2\\left\(x\+1\\right\)|2x\+2/);
});

// ---- R27a (bug F22): a template after a digit never joins the number --------------------------------------------------
// 10ˣ put its 10 straight after a typed 5 (`510^{2}`, computed 260 100), and DMS took the 5 as the start of its degrees
// while the cursor went to the degrees' end, so `5 DMS 2` was 52°. The owner's pick (2026-10-15): after a digit or a
// decimal point 10ˣ inserts ×10^□ (5·10²); DMS takes the number before it as its degrees (a key's argument, as the
// mixed number's whole part) and the cursor goes to the minutes. Expected values derived.
const sheet = (page: Page) => page.getByTestId("menu");
/** Tmpl, then a tap on the cell. */
async function cell(page: Page, id: string): Promise<void> {
  await tap(page, ["tmpl"]);
  await sheet(page).locator(`[data-id="${id}"]`).tap();
  await expect(sheet(page)).toBeHidden();
}
const PH = "\\placeholder{}";

test("F22: 5 10ˣ 2 is 5×10² = 500, not 510²", async ({ page }) => {
  await tap(page, ["d5", "shift", "log", "d2"]);
  expect(await entryValue(page)).toBe("5\\times10^2");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "500");
});

test("F22: after a decimal point 10ˣ also multiplies: 1.5 10ˣ 3 is 1500", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "shift", "log", "d3"]);
  expect(await entryValue(page)).toBe("1.5\\times10^3");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1500");
});

test("F22: 10ˣ with no digit before it is the plain template: on an empty line, after +, after x", async ({ page }) => {
  await tap(page, ["shift", "log", "d2"]);
  expect(await entryValue(page)).toBe("10^2");
  await tap(page, ["esc", "d2", "add", "shift", "log", "d3"]);
  expect(await entryValue(page)).toBe("2+10^3");
  await tap(page, ["esc", "x", "shift", "log", "d3"]); // x10³ is read as x·10³
  expect(await entryValue(page)).toBe("x10^3");
});

test("F22: 5 2 with the 2 selected, then 10ˣ: the 2 is the exponent and the 5 stays a factor (5×10²)", async ({ page }) => {
  await tap(page, ["d5", "d2"]);
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.selection = { ranges: [[1, 2]] };
  });
  await tap(page, ["shift", "log"]);
  expect(await entryValue(page)).toBe("5\\times10^2");
});

test("F22: a typed 110² is a power of 110: ⌫ after the 0 deletes the 0, as after any digit of a base (no 10ˣ mark)", async ({ page }) => {
  await tap(page, ["d1", "d1", "d0", "pow", "d2"]);
  expect(await entryValue(page)).toBe("110^2");
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 3;
  });
  await tap(page, ["bksp"]);
  expect(await entryValue(page)).toBe("11^2");
});

test("F22: 5 DMS 2 ▶ 3 is 5°2′3″: the 5 is the degrees, the cursor starts in the minutes", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  await tap(page, ["d5"]);
  await cell(page, "dms");
  await tap(page, ["d2", "right", "d3"]);
  expect(await entryValue(page)).toBe("5\\degree2\\prime3\\doubleprime");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "5.03416666667");
});

test("F22: 5 DMS ⌫ gives 5 back: only the degrees the key took hold something, so the template goes and keeps them", async ({ page }) => {
  await tap(page, ["d5"]);
  await cell(page, "dms");
  expect(await entryValue(page)).toBe(`5\\degree${PH}\\prime${PH}\\doubleprime`);
  await tap(page, ["bksp"]);
  expect(await entryValue(page)).toBe("5");
});
