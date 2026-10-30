// SPDX-License-Identifier: GPL-3.0-or-later
// R46: the sheet's view is its own chunk, fetched when idle. A key that opens a sheet before the chunk is in waits in the
// queue (decisions.md R8), so none is lost or run twice. The chunk's request is held back here until `release()`.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

/** Hold the Sheet chunk's requests back (or those of `what`); returns the function that lets them through. */
async function hold(page: Page, what: RegExp = /\/src\/views\/(Sheet\.svelte|sheetFit\.ts)/): Promise<() => void> {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(what, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

const sheet = (page: Page) => page.getByTestId("menu");

test("Apps, then 2, typed before the sheet's chunk is in, opens the second app once it is", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["d1", "@place", "d4"]);
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

test("Menu, then 9, typed before the chunk is in, picks the ninth row (Clear history) once it is", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d1", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  await tap(page, ["@menu", "d9"]);
  expect(await entryValue(page)).toBe(""); // the 9 was not typed into the line
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  release();
  await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("");
});

test("Shift + 6, then a cell's key, typed before the chunk is in, picks that cell once it is: 2 ≤ 3", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["d2", "shift", "d6", "d8", "d3"]);
  expect(await entryValue(page)).toBe("2");
  release();
  await expect.poll(() => entryValue(page)).toBe("2\\le3");
  await expect(sheet(page)).toBeHidden();
});

test("Esc while the chunk waits closes nothing that is not open and leaves the line as it was", async ({ page }) => {
  const release = await hold(page);
  await open(page);
  await tap(page, ["d1", "@menu", "esc"]);
  expect(await entryValue(page)).toBe("1");
  release();
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("1");
  await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
});

/** A finger held on the first history row for 700 ms (the long press is 500 ms), then lifted. */
async function longPressFirstRow(page: Page): Promise<void> {
  const box = await page.locator('[data-testid="result"] .result').first().boundingBox();
  if (!box) throw new Error("no result row");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

async function twoRows(page: Page): Promise<void> {
  await open(page);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d1", "enter", "d2", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
}
const texts = (page: Page) => page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));

test("F42: a long press on a row before the chunk is in, then 5, picks nothing of the hidden list; the 5 runs once it is", async ({ page }) => {
  const release = await hold(page);
  await twoRows(page);
  await tap(page, ["d3"]); // a line to keep
  await longPressFirstRow(page);
  await tap(page, ["d5"]);
  await expect(sheet(page)).toHaveCount(0); // nothing is drawn yet
  expect(await texts(page)).toEqual(["1", "2"]); // Delete did not run on the hidden list
  expect(await entryValue(page)).toBe("3"); // and the 5 was not typed into the line
  release();
  await expect.poll(() => texts(page)).toEqual(["2"]); // the queued 5 is Delete on the pressed row, once
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("3");
});

test("F42: a long press on a row before the chunk is in shows the menu once it is", async ({ page }) => {
  const release = await hold(page);
  await twoRows(page);
  await longPressFirstRow(page);
  await expect(sheet(page)).toHaveCount(0);
  expect(await texts(page)).toEqual(["1", "2"]);
  release();
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(9);
  expect(await texts(page)).toEqual(["1", "2"]);
});

// R91: the sheet's keys and the palette cells, the palettes with their names (Tmpl too) and the result tidy-up are chunks
// of their own; a key pressed before one of them is in waits in the same queue.
test("Tmpl, then Enter, typed before the palette cells' and the sheet keys' code is in, inserts the fraction once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/views\/(tmplSheet|sheetKeys)\.ts/);
  await open(page);
  await tap(page, ["tmpl", "enter"]);
  expect(await entryValue(page)).toBe("");
  release();
  await expect.poll(() => entryValue(page)).toContain("frac");
  await expect(sheet(page)).toBeHidden();
});

test("Tmpl, then Enter, typed before the palettes' chunk is in, inserts the fraction once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/keyboard\/shiftPalettes\.ts/);
  await open(page);
  await tap(page, ["tmpl", "enter"]);
  expect(await entryValue(page)).toBe("");
  release();
  await expect.poll(() => entryValue(page)).toContain("frac");
  await expect(sheet(page)).toBeHidden();
});

// (CAS: its result is always drawn from Giac's latex, so it needs the tidy-up; a Home number is drawn by our formatter and does not wait for it)
test("an Enter typed before the result tidy-up's chunk is in finishes its job once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/render\/tidy\.ts/);
  await open(page);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.session.setView("cas"));
  await tap(page, ["d1", "add", "d2", "enter"]);
  expect(await entryValue(page)).toBe("");
  await expect(page.locator("article.item")).toHaveAttribute("data-status", "pending");
  release();
  await expect(page.locator("article.item")).toHaveAttribute("data-status", "done");
});

// R91f1: a first Settings open that fails only on the sheet view chunk (the keys' code) leaves the Mode and Settings code
// loaded; the next open tries the chunk again and Settings (a level of the sheet since R49) answers its keys.
test("Settings opened again after the sheet chunk failed once answers Down and Esc", async ({ page }) => {
  let fail = true;
  await page.route(/\/src\/views\/sheetKeys\.ts/, (route) => (fail ? route.abort() : route.continue()));
  await open(page);
  await page.evaluate(() => window.pascaline.shell.openSettings?.()); // Promise.all fails on the sheet chunk alone
  await page.waitForTimeout(500);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  fail = false;
  await page.evaluate(() => window.pascaline.shell.openSettings?.());
  const settings = page.getByTestId("menu");
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  const active = settings.locator('[data-active="true"]');
  await expect(active).toHaveAttribute("data-id", "appearance");
  await tap(page, ["down"]); // the keypad's keys go through sheetPress, which reads them with the sheet chunk's keys
  await expect(active).toHaveAttribute("data-id", "numbers");
  await tap(page, ["esc", "esc"]);
  await expect(settings).toBeHidden();
});
