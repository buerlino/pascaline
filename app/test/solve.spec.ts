// SPDX-License-Identifier: GPL-3.0-or-later
// Solve app key-sequence tests on the real engine (docs/shifts/brief.md section 8, item 2).
// Expected numbers come from tests/golden/solve.yaml (oracle = mpmath 1.3.0 at 30 digits, or derived).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Apps → Solve → Symb. */
async function openSolve(page: Page): Promise<void> {
  await tap(page, ["apps", "d2"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
}

const value = (page: Page, name: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${name}"] td`);

/** In Num: select `name` and type a new value (Clear first: the entry holds the current value). */
async function setValue(page: Page, name: string, keys: string[]): Promise<void> {
  await page.locator(`[data-testid="solve-table"] tr[data-name="${name}"] th button`).tap();
  await expect(page.getByTestId("entry-label")).toHaveText(`${name}=`);
  await tap(page, ["shift", "bksp", ...keys, "enter"]);
}

test("Solve: x·e^x=5 with guess 1 gives the oracle root and the info line", async ({ page }) => {
  await openSolve(page);
  // x e^x = 5
  await tap(page, ["x", "shift", "ln", "x", "right", "shift", "enter", "d5", "enter"]);
  await expect(page.locator('[data-name="E1"] .math')).toHaveAttribute("data-latex", /x.*e.*=5/);
  await tap(page, ["num"]);
  await expect(value(page, "x")).toBeVisible();
  await setValue(page, "x", ["d1"]);
  await expect(value(page, "x")).toHaveAttribute("data-value", "1");
  await tap(page, ["menu", "d1"]); // Solve
  await expect(value(page, "x")).toHaveText("1.32672466524"); // oracle lambertw(5), solve.yaml lambert-xexp
  await expect(page.getByTestId("solve-info")).toHaveText("sign change in [1.32, 1.64]");
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-warn", "false");
  expect(await entryValue(page)).toBe("1.32672466524");
});

test("Solve: the 2×2 system x²+y²=4, y=e^x from guesses (-1, 1) gives the oracle roots", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "pow", "d2", "right", "add", "shift", "x", "pow", "d2", "right", "shift", "enter", "d4", "enter"]);
  await tap(page, ["down"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E2:");
  await tap(page, ["shift", "x", "shift", "enter", "shift", "ln", "x", "right", "enter"]);
  await tap(page, ["num"]);
  await expect(value(page, "y")).toBeVisible();
  await setValue(page, "x", ["sub", "d1"]);
  await setValue(page, "y", ["d1"]);
  await page.locator('[data-testid="solve-table"] tr[data-name="x"] th button').tap();
  await tap(page, ["menu", "d1"]); // Solve: two equations on, so x and y
  // oracle findroot from (-1, 1): solve.yaml sys-circle-exp-left
  await expect(value(page, "x")).toHaveText("-1.99537317006");
  await expect(value(page, "y")).toHaveText("0.135962907412");
  await expect(page.getByTestId("solve-info")).toContainText("substituted back");
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-warn", "false");
});

test("Solve: polynomial roots of x⁴+x+1=0, complex included (oracle)", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "pow", "d4", "right", "add", "x", "add", "d1", "shift", "enter", "d0", "enter"]);
  await tap(page, ["num"]);
  await expect(value(page, "x")).toBeVisible();
  await tap(page, ["menu", "d2"]); // Polynomial roots
  // oracle mpmath polyroots, our order: solve.yaml poly-quartic-complex
  await expect(page.locator('[data-testid="solve-roots"] li')).toHaveText([
    "x = -0.727136084491-0.43001428833*i",
    "x = -0.727136084491+0.43001428833*i",
    "x = 0.727136084491-0.934099289461*i",
    "x = 0.727136084491+0.934099289461*i",
  ]);
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-warn", "false");
});

test("Solve: 1/x=0 — the sign change at the pole is not a root; ⚠ and the reason", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["d1", "div", "x", "right", "shift", "enter", "d0", "enter"]);
  await tap(page, ["num"]);
  await setValue(page, "x", ["d1"]);
  await tap(page, ["menu", "d1"]);
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-warn", "true");
  await expect(page.getByTestId("solve-report")).toHaveAttribute("data-ok", "false");
  await expect(page.getByTestId("solve-info")).toContainText("sign change");
  await expect(page.locator('[data-testid="solve-report"] .warn')).toHaveText("⚠");
  await expect(value(page, "x")).toHaveAttribute("data-value", "1"); // the guess stays
});

test("Solve: Cancel stops a long solve; equations and values survive and the engine answers again", async ({ page }) => {
  await openSolve(page);
  // A slow equation with no root (|Σ cos(kx)/k| stays far below 100; about 2.5 s on desktop).
  await page.evaluate(() => {
    const app = window.pascaline.shell.loaded.solve!.instance as unknown as { define(i: number, l: string): void };
    app.define(0, "\\sum_{k=1}^{2000}\\frac{\\cos\\left(kx\\right)}{k}=100");
  });
  await tap(page, ["num"]);
  await setValue(page, "x", ["d1"]);
  await tap(page, ["menu", "d1"]);
  await expect(page.getByTestId("solve-info")).toHaveText("Working…");
  await page.waitForTimeout(300);
  await tap(page, ["cancel"]);
  await expect(page.getByTestId("solve-report")).toHaveCount(0);
  await expect(value(page, "x")).toHaveAttribute("data-value", "1");
  // The engine works again: replace E1 by x^2=2 and solve from 1 (oracle sqrt(2), solve.yaml sqrt2-pos).
  await tap(page, ["symb"]);
  await expect(page.locator('[data-name="E1"] .math')).toHaveAttribute("data-latex", /sum/);
  await tap(page, ["shift", "bksp", "x", "pow", "d2", "right", "shift", "enter", "d2", "enter"]);
  await tap(page, ["num", "menu", "d1"]);
  await expect(value(page, "x")).toHaveText("1.41421356237");
});

test("Solve: equations and values are stored", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "pow", "d2", "right", "shift", "enter", "d2", "enter"]);
  await tap(page, ["num"]);
  await setValue(page, "x", ["sub", "d3"]);
  await page.evaluate(() => window.pascaline.shell.flush());
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined && window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["apps", "d2"]);
  await tap(page, ["num"]);
  await expect(value(page, "x")).toHaveAttribute("data-value", "-3");
  await tap(page, ["menu", "d1"]);
  await expect(value(page, "x")).toHaveText("-1.41421356237"); // oracle -sqrt(2), solve.yaml sqrt2-neg
});
