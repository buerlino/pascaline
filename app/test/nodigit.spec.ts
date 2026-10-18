// SPDX-License-Identifier: GPL-3.0-or-later
// G23: a result with no confirmed digit shows "⚠ no digit confirmed" and no number; ⚠ n with n > 0 is unchanged.
// sin(10^2000) is out of reach of every evaluation within the budget (oracle: needs about 2000 digits).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open } from "./helpers.ts";

const submit = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => window.pascaline.session.submit(l), latex);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("no confirmed digit: the mark says so and the row holds no number", async ({ page }) => {
  await submit(page, "\\sin\\left(10^{2000}\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const mark = page.getByTestId("mark");
  await expect(mark).toHaveText("⚠ no digit confirmed");
  await expect(mark).toHaveAttribute("data-mark", "⚠");
  const result = page.locator('[data-testid="result"] .result');
  await expect(result.locator(".math")).toHaveCount(0);
  await expect(result).toHaveText("");
});

test("⚠ n with n > 0 still shows its digits", async ({ page }) => {
  await submit(page, "\\operatorname{romberg}\\left(e^{-x^2},x,0,1\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(page.getByTestId("mark")).toHaveAttribute("data-mark", "⚠");
  await expect(page.getByTestId("mark")).not.toHaveText("⚠ no digit confirmed");
  await expect(page.locator('[data-testid="result"] .result .math')).toHaveCount(1);
});

test("tapping a no-digit row puts no digit on the line (oracle: sin(10^2000) = +0.2678…, not the shown double)", async ({ page }) => {
  await submit(page, "\\sin\\left(10^{2000}\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.locator('[data-testid="result"] .result').dispatchEvent("click"); // empty button: no box to hit
  const line = await entryValue(page);
  expect(line).toContain("{⚠}");
  expect(line).not.toMatch(/\d\./);
});
