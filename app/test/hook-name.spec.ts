// SPDX-License-Identifier: GPL-3.0-or-later
// R139: the test hook is window.n62 (it was window.n62 before the name N62).
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("the test hook is window.n62; window.n62 is gone", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => "n62" in window)).toBe(true);
  expect(await page.evaluate(() => "pascaline" in window)).toBe(false);
});
