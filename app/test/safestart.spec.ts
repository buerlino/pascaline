// SPDX-License-Identifier: GPL-3.0-or-later
// G19 (F31): the safe-start line is a history row the keys must not pick (it is never drawn as picked).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const bar = (page: Page) => page.getByTestId("row-actions");

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  // what a safe start adds: the note, in both views
  await page.evaluate(() => (window.pascaline.session as unknown as { note(text: string): void }).note("safe start"));
  await expect(page.getByTestId("safe-start")).toHaveCount(1);
});

test("with only the note in the history, Up picks nothing", async ({ page }) => {
  await tap(page, ["up"]);
  await expect(bar(page)).toHaveCount(0);
});

test("Up picks the last real row and stays on it; the note is never picked", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveCount(5);
  await tap(page, ["up"]); // the row above is the note: the pick stays
  await expect(bar(page).getByRole("button")).toHaveCount(5);
  await tap(page, ["enter"]); // Enter puts the picked result on the line
  await expect(bar(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.pascaline.entry.value)).toContain("\\res");
});
