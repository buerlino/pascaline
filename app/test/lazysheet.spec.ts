// SPDX-License-Identifier: GPL-3.0-or-later
// R46: the sheet's view is its own chunk, fetched when idle. A key that opens a sheet before the chunk is in waits in the
// queue (decisions.md R8), so none is lost or run twice. The chunk's request is held back here until `release()`.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

/** Hold the Sheet chunk's requests back; returns the function that lets them through. */
async function hold(page: Page): Promise<() => void> {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/views\/(Sheet\.svelte|sheetFit\.ts)/, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

const sheet = (page: Page) => page.getByTestId("menu");

test("Apps, then 2, typed before the sheet's chunk is in, opens the second app once it is", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["d1", "apps", "d2"]);
  await expect(page.locator('[data-app="solve"]')).toHaveCount(0);
  expect(await entryValue(page)).toBe("1"); // the 2 was not typed into the line
  release();
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await expect(page.getByTestId("apps")).toHaveCount(0);
});

test("Tmpl, then Enter, typed before the chunk is in, inserts the fraction once it is", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["tmpl", "enter"]);
  expect(await entryValue(page)).toBe("");
  release();
  await expect.poll(() => entryValue(page)).toContain("frac");
  await expect(sheet(page)).toBeHidden();
});

test("Cancel while the chunk waits closes nothing that is not open and leaves the line as it was", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["d1", "menu", "cancel"]);
  expect(await entryValue(page)).toBe("1");
  release();
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("1");
  await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
});
