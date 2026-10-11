// SPDX-License-Identifier: GPL-3.0-or-later
// ?bench=plot hook (measurement builds only): run with VITE_MEASURE=1 in the environment, otherwise skipped.
import { expect, test } from "@playwright/test";

test("?bench=plot&manual=1 opens Plot with three curves and an FPS overlay", async ({ page }) => {
  test.skip(process.env["VITE_MEASURE"] !== "1", "measurement builds only");
  await page.goto("/?bench=plot&manual=1");
  await page.waitForFunction(() => window.pascaline?.plot.curves === 3, undefined, { timeout: 20_000 });
  await expect(page.getByTestId("fps-overlay")).toBeVisible();
});
