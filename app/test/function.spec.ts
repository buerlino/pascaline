// SPDX-License-Identifier: GPL-3.0-or-later
// Function app key-sequence tests on the real engine (docs/shifts/brief.md section 8, item 2).
// Expected numbers: oracle = mpmath 1.3.0 at 30 digits, rounded to 12 significant digits.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Enter sin(x) in F1 and x^3-2x in F2 from Home, by keys. */
async function defineTwo(page: Page): Promise<void> {
  await tap(page, ["symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expect(page.locator('[data-view="symb"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["sin", "x", "enter"]);
  await tap(page, ["down"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F2(x)=");
  await tap(page, ["x", "pow", "d3", "right", "sub", "d2", "x", "enter"]);
  expect(await entryValue(page)).toBe("x^3-2x");
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "\\sin\\left(x\\right)");
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "x^3-2x");
}

const engineHome = (page: Page, giac: string): Promise<string> =>
  page.evaluate(async (g) => (await window.pascaline.calc.home(g, { digits: 12, angle: "rad", format: "std" })).display, giac);

test("Function: sin(x) and x^3-2x are drawn; the trace y comes from the engine", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["plot"]);
  await expect(page.locator(".board svg")).toBeVisible();
  // two curves (JSXGraph draws each function graph as one path)
  await expect(page.locator(".board svg path[stroke='#e8743b']")).toHaveCount(1);
  await expect(page.locator(".board svg path[stroke='#3fa7d6']")).toHaveCount(1);
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "0");
  await tap(page, ["right", "right", "right"]);
  await expect(page.getByTestId("trace-x")).toHaveText("0.6");
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "0.564642473395"); // oracle
  expect(await engineHome(page, "sin(0.6)")).toBe("0.564642473395");
  // ▼ traces F2: 0.6^3 - 1.2 = -0.984 (derived)
  await tap(page, ["down"]);
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "-0.984");
});

test("Function: Num shows a table whose values match the engine", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["num"]);
  const row = page.locator('[data-testid="num-table"] tr:has(td[data-x="1"])');
  await expect(row.locator("td").nth(1)).toHaveAttribute("data-text", "0.841470984808"); // oracle sin(1)
  await expect(row.locator("td").nth(2)).toHaveAttribute("data-text", "-1");
  expect(await engineHome(page, "sin(1)")).toBe("0.841470984808");
  // start 0.5 through the entry line, step 0.25 through the menu
  await tap(page, ["d0", "dot", "d5", "enter"]);
  await expect(page.locator('[data-testid="num-table"] td.x').first()).toHaveText("0.5");
  await tap(page, ["menu", "d2", "d0", "dot", "d2", "d5", "enter"]);
  await expect(page.locator('[data-testid="num-table"] td.x').nth(1)).toHaveText("0.75");
  // ▼ scrolls by a row
  await tap(page, ["down"]);
  await expect(page.locator('[data-testid="num-table"] td.x').first()).toHaveText("0.75");
});

test("Function: root, extremum and intersection from the Plot menu (oracle)", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["plot"]);
  await expect(page.locator(".board svg")).toBeVisible();
  await tap(page, ["down"]); // trace F2
  await tap(page, ["right", "right", "right", "right", "right"]); // x = 1
  await expect(page.getByTestId("trace-x")).toHaveText("1");
  await tap(page, ["menu", "d1"]); // Root
  await expect(page.getByTestId("readout-x")).toHaveText("1.41421356237"); // oracle sqrt(2)
  await expect(page.getByTestId("readout-info")).not.toHaveText(/⚠/);
  await tap(page, ["menu", "d2"]); // Extremum near 1.414
  await expect(page.getByTestId("readout-x")).toHaveText("0.816496580928"); // oracle sqrt(2/3)
  await expect(page.getByTestId("readout-y")).toHaveText("-1.0886621079"); // oracle
  await tap(page, ["right", "right", "right", "right"]); // 0.8 → 1.6
  await expect(page.getByTestId("trace-x")).toHaveText("1.6");
  await tap(page, ["menu", "d3"]); // Intersection of F2 with F1
  await expect(page.getByTestId("readout-x")).toHaveText("1.61784493243"); // oracle findroot
  await expect(page.getByTestId("readout-y")).toHaveText("0.998893418501");
});

test("Function: definitions, window and view survive a reload", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["plot"]);
  await expect(page.locator(".board svg")).toBeVisible();
  await page.evaluate(() => window.pascaline.shell.flush());
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.shell?.current !== undefined, undefined, { timeout: 20_000 });
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expect(page.locator('[data-view="plot"]')).toHaveAttribute("aria-selected", "true");
  await tap(page, ["symb"]);
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "x^3-2x");
});

test("keys typed while the app's code is still loading are kept (regression)", async ({ page }) => {
  await tap(page, ["symb", "sin", "x", "enter", "down", "d1", "div", "x", "enter"]);
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "\\sin\\left(x\\right)");
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "\\frac{1}{x}");
});

test("Apps key lists the apps; Home/CAS key goes back to Home", async ({ page }) => {
  await tap(page, ["apps"]);
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["d2"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["app"]);
  await expect(page.locator('[data-view="home"]')).toHaveAttribute("aria-selected", "true");
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "2");
});
