// SPDX-License-Identifier: GPL-3.0-or-later
// G119 (F108): Home shows Giac's sequence answer as its value or a list. fMin picked in Find by keys (f m i n are xʸ, (−),
// tan and ( ) under Find's letters), its arguments typed: x²−x has its minimum at x = 1/2, shown 0.5 with "=" (it showed
// Giac's seq[1/2]); Ans·2 reads the value back, 1. The real engine; the full generated index (`npm run index`).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const lastRow = (page: Page) => page.locator('[data-testid="result"]').last();
const find = (page: Page) => page.getByTestId("find");
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("fMin(x²−x, x) by keys shows = 0.5, and Ans·2 = 1", async ({ page }) => {
  await tap(page, ["math", "pow", "neg", "tan", "paren"]);
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("fmin");
  await expect(active(page)).toHaveAttribute("data-id", "fn:fMin");
  await tap(page, ["enter"]);
  await expect(find(page)).toBeHidden();
  await tap(page, ["x", "sq", "sub", "x", "comma", "x"]);
  expect(await entryValue(page)).toMatch(/fMin\}?\}?\\left\(x\^2-x,x\\right\)$/);
  await tap(page, ["enter"]);
  await expect(lastRow(page).locator(".result")).toHaveText("0.5");
  await expect(lastRow(page).locator('[data-testid="mark"]')).toHaveAttribute("data-mark", "=");
  // Ans holds Giac's 1/2, never its sequence
  await tap(page, ["mul", "d2", "enter"]);
  await expect(lastRow(page).locator(".result")).toHaveText("1");
  await expect(lastRow(page).locator('[data-testid="mark"]')).toHaveAttribute("data-mark", "=");
});
