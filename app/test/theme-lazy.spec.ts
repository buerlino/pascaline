// SPDX-License-Identifier: GPL-3.0-or-later
// R50c: no theme family file is fetched at start, and with no setting changed the screen is Pascaline's own. (R50e loads
// theme/apply.ts and lookApply.ts when the settings are read, as lazy chunks; they fetch no CSS for the default look.)
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("start fetches no family file; the page keeps Pascaline's tokens", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await page.waitForTimeout(500);
  expect(urls.filter((u) => /\/theme\/(pascaline|graphite|solarized|gruvbox|nord)\.css|theme\/modes\.css/.test(u))).toEqual([]);
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-family", "pascaline");
  await expect(root).not.toHaveAttribute("data-contrast", /.*/);
  await expect(root).not.toHaveAttribute("data-keys", /.*/);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(11, 16, 32)");
});
