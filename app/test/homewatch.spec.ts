// SPDX-License-Identifier: GPL-3.0-or-later
// G185 (F62): a Home Enter whose Giac call never looks at the interrupt (MPFR reducing sin(cosh(10!))'s argument) is
// stopped by the client's watchdog (HOME_WATCHDOG_MS, 4 s, workerEngine.ts): the row shows the time-limit message within
// the limit + 1 s (it took 11-16 s, F62), the engine restarts with the user's names, and the next Enter works.
// The real engine, in its worker.
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

const LIMIT_MS = 4000; // HOME_WATCHDOG_MS (Opus pass 86, decisions.md "Time limits")

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("Home sin(cosh(10!)) shows Stopped: it took too long within the limit + 1 s; then 1+1 = 2 and a stored A is still there", async ({ page }) => {
  test.setTimeout(60_000);
  const lastRow = page.locator('[data-testid="result"]').last();
  await page.evaluate(() => window.n62.session.submit("A:=7", "A:=7"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    await window.n62.session.submit("\\sin\\left(\\cosh\\left(10!\\right)\\right)", "sin(cosh(10!))");
    return performance.now() - t0;
  });
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await expect(page.locator('[data-status="error"]').last()).toContainText("Stopped: it took too long");
  expect(ms).toBeGreaterThanOrEqual(LIMIT_MS - 50);
  expect(ms).toBeLessThan(LIMIT_MS + 1000);
  await page.evaluate(() => window.n62.session.submit("1+1"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastRow.locator(".result")).toHaveText("2");
  await page.evaluate(() => window.n62.session.submit("A+1", "A+1"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await expect(lastRow.locator(".result")).toHaveText("8");
});
