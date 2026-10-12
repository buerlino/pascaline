// SPDX-License-Identifier: GPL-3.0-or-later
// L1: subscripted names x_1, x_2 are plain variables (Giac x_1), never units, in Home, CAS, Solve and
// Function, and results draw them as x with a subscript. Subscripts are typed on a physical keyboard
// (`_`); our keypad has no subscript key yet (its position belongs to the key-layout mapping).
// Expected values are derived (simple arithmetic and a linear 2×2 system).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last();

/** Type a subscripted name on the physical keyboard and leave the subscript: x_1 → x_{1}. */
async function name(page: Page, base: string, sub: string): Promise<void> {
  await page.locator("math-field").first().focus();
  await page.keyboard.type(`${base}_${sub}`);
  await page.keyboard.press("ArrowRight");
}

/** Home: x_1 := 5 (Sto), then 2·x_1 → 10 (derived): x_1 is a variable, not a unit. */
async function storeX1(page: Page): Promise<void> {
  await name(page, "x", "1");
  await tap(page, ["alpha", "sub", "shift", "dot", "d5", "enter"]); // ":" then "="
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "5");
}

test("L1 Home: x_1 is a variable, not a unit", async ({ page }) => {
  await storeX1(page);
  await tap(page, ["d2", "mul"]);
  await name(page, "x", "1");
  expect(await entryValue(page)).toBe("2\\times x_1");
  await tap(page, ["enter"]);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "10");
});

test("L1 CAS: x_1÷x_1+x_2·x_1 is drawn as 1+x₂x₁", async ({ page }) => {
  await tap(page, ["app"]);
  await expect(page.locator('[data-view="cas"]')).toHaveAttribute("aria-selected", "true");
  await name(page, "x", "1");
  await tap(page, ["div"]);
  await name(page, "x", "1");
  await tap(page, ["right", "add"]);
  await name(page, "x", "2");
  await tap(page, ["mul"]);
  await name(page, "x", "1");
  expect(await entryValue(page)).toBe("\\frac{x_1}{x_1}+x_2\\times x_1");
  await tap(page, ["enter"]);
  const res = lastResult(page).locator(".math");
  await expect(res).toHaveAttribute("data-latex", "1+x_{2}x_{1}");
  await expect(res.locator(".ML__msubsup")).toHaveCount(2);
});

test("L1 Solve: unknowns x_1, x_2 solve the 2×2 system x_1+x_2=3, x_1-x_2=1", async ({ page }) => {
  await tap(page, ["apps", "d2"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await name(page, "x", "1");
  await tap(page, ["add"]);
  await name(page, "x", "2");
  await tap(page, ["shift", "dot", "d3", "enter", "down"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E2:");
  await name(page, "x", "1");
  await tap(page, ["sub"]);
  await name(page, "x", "2");
  await tap(page, ["shift", "dot", "d1", "enter"]);
  await tap(page, ["num"]);
  const row = (n: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${n}"]`);
  await expect(row("x_1")).toBeVisible();
  await expect(row("x_2")).toBeVisible();
  await expect(row("x_1").locator("th sub")).toHaveText("1");
  await tap(page, ["menu", "d1"]); // Solve
  await expect(row("x_1").locator("td")).toHaveText("2");
  await expect(row("x_2").locator("td")).toHaveText("1");
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-warn", "false");
});

test("L1 Function: F1(x)=x_1·x uses the Home variable x_1 (Num at x=1 is 5)", async ({ page }) => {
  await storeX1(page);
  await tap(page, ["symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await name(page, "x", "1");
  await tap(page, ["mul", "x", "enter"]);
  await tap(page, ["num", "d1", "enter"]); // Num start 1 (the step is 0.1)
  const row = page.locator('[data-testid="num-table"] tr:has(td[data-x="1"])');
  await expect(row.locator("td").nth(1)).toHaveAttribute("data-text", "5");
});
