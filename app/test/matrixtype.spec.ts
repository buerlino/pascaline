// SPDX-License-Identifier: GPL-3.0-or-later
// G130 (F125): Home shows Giac's matrix type as the rows a plain matrix shows, with one mark. The identity picked in Find by
// keys (i d n are tan, x and ( ) under Find's letters), its argument typed: the 2×2 identity is [[1,0],[0,1]], shown with "="
// (it showed Giac's matrix[[1,0],[0,1]] with no mark); Ans·3 reads the rows back, [[3,0],[0,3]]. The real engine; the full
// generated index (`npm run index`).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const lastRow = (page: Page) => page.locator('[data-testid="result"]').last();
const find = (page: Page) => page.getByTestId("find");
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("idn(2) by keys shows = [[1,0],[0,1]], and Ans·3 = [[3,0],[0,3]]", async ({ page }) => {
  await tap(page, ["math", "tan", "x", "paren"]);
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("idn");
  await expect(active(page)).toHaveAttribute("data-id", "fn:identity");
  await tap(page, ["enter"]);
  await expect(find(page)).toBeHidden();
  await tap(page, ["d2", "enter"]);
  await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "[[1,0],[0,1]]");
  await expect(lastRow(page).locator('[data-testid="mark"]')).toHaveAttribute("data-mark", "=");
  // Ans holds the rows, never Giac's matrix[…]
  await tap(page, ["mul", "d3", "enter"]);
  await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "[[3,0],[0,3]]");
  await expect(lastRow(page).locator('[data-testid="mark"]')).toHaveAttribute("data-mark", "=");
});
