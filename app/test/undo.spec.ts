// SPDX-License-Identifier: GPL-3.0-or-later
// Undo on Shift + Cancel (P13, R16): the entry line's own MathLive history, and the rule that undo never brings a
// chip back with a value other than its own. Expected values are derived.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const results = (page: Page) => page.locator('[data-testid="result"] .result');
const ready = (page: Page) =>
  page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
const undo = (page: Page) => page.evaluate(() => window.pascaline.entry.field?.executeCommand("undo"));

/** 1/3 = 0.333…, then `1 + <chip of that result>` on the line. */
async function lineWithChip(page: Page): Promise<void> {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(results(page).last()).toHaveAttribute("data-text", "0.333333333333");
  await results(page).last().tap();
  await tap(page, ["mul", "d3"]);
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}\\times3");
}

test("Esc then undo brings the chip back with its own value", async ({ page }) => {
  await lineWithChip(page);
  await page.evaluate(() => window.pascaline.entry.clear());
  await undo(page);
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}\\times3");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(results(page).last()).toHaveAttribute("data-text", "1");
});

test("Enter then undo brings the chip back with its own value", async ({ page }) => {
  await lineWithChip(page);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await undo(page);
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}\\times3");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await expect(results(page).last()).toHaveAttribute("data-text", "1");
});

test("a recalled entry whose chip key is taken keeps both values apart, also after undo", async ({ page }) => {
  await open(page, "");
  await ready(page);
  // row 1: 1/3; row 2: 2 (its result is chip 1 on a fresh line only if the table was cleared)
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(results(page).last()).toHaveAttribute("data-text", "0.333333333333");
  await results(page).last().tap(); // chip res:1 = 1/3
  await tap(page, ["mul", "d3"]);
  // recall an entry that carries res:1 with ANOTHER value, then undo back to the first line
  await page.evaluate(() => window.pascaline.entry.set("\\res{1}{7}+1", { "res:1": { value: "7", exact: true } }));
  await undo(page);
  const v = await entryValue(page);
  const chips = await page.evaluate(() => window.pascaline.entry.chips);
  // whatever key the 1/3 chip has now, its value must still be 1/3
  const m = /\\res\{(\d+)\}\{0\.333333333333\}/.exec(v);
  expect(m).not.toBeNull();
  if (m) expect(chips[`res:${m[1]}`]?.value).toMatch(/^(1\/3|0\.3{12,})/);
});
