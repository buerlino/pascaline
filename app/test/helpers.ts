// SPDX-License-Identifier: GPL-3.0-or-later
import type { Page } from "@playwright/test";

/** Tap keys by their id in spec/keyboard.yaml (d0..d9, div, frac, shift, enter, ...). */
export async function tap(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
}

export const entryValue = (page: Page): Promise<string> => page.evaluate(() => window.pascaline.entry.value);

export async function open(page: Page, query = "engine=fake"): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForTimeout(150);
}
