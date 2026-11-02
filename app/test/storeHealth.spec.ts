// SPDX-License-Identifier: GPL-3.0-or-later
// R96: Settings › Data's last row tells whether the data is kept: kept (on this device when the browser keeps the store
// out of its eviction, else "may delete it"), or not saved when the store fails; the last backup's date under it.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

async function dataLevel(page: Page): Promise<void> {
  await tap(page, ["@mode", "d6"]);
  await page.getByTestId("menu").locator('[data-id="data"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Data");
}
const line = (page: Page) => page.getByTestId("menu").locator('[data-id="store"] .label');
const hint = (page: Page) => page.getByTestId("menu").locator('[data-id="store"] [data-testid="row-hint"]');

test("Settings › Data says the data is kept, and the date of the last backup once one is saved", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await page.evaluate(() => window.pascaline.session.setDigits(9)); // a write
  await page.waitForTimeout(900); // the writes are debounced and asynchronous
  const persisted = await page.evaluate(() => navigator.storage.persisted());
  await dataLevel(page);
  await expect(line(page)).toHaveText(persisted ? "Kept on this device" : "Kept, but the browser may delete it: save a backup");
  await expect(hint(page)).toHaveCount(0); // no backup saved yet

  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  await download;
  await expect(page.getByTestId("notice")).toHaveText("Backup saved");
  await dataLevel(page);
  await expect(hint(page)).toHaveText(/^Last backup: \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test("Settings › Data says nothing is saved when the store cannot be opened", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.addInitScript(() => {
    const blocked = {
      open() {
        const r: { error: Error | null; onerror: (() => void) | null; onsuccess: null; onupgradeneeded: null } = { error: null, onerror: null, onsuccess: null, onupgradeneeded: null };
        setTimeout(() => {
          r.error = new Error("UnknownError (blocked by the test)");
          r.onerror?.();
        }, 0);
        return r;
      },
    };
    Object.defineProperty(window, "indexedDB", { value: blocked, configurable: true });
  });
  await open(page);
  await page.evaluate(() => window.pascaline.session.setDigits(9));
  await page.waitForTimeout(900);
  await dataLevel(page);
  await expect(line(page)).toHaveText("Not saved: changes are lost when the app closes");
});
