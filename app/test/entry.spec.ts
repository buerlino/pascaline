// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop key-sequence tests for the entry line (fake engine: results echo the Giac text).
import { expect, test } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("probe", async ({ page }) => {
  await tap(page, ["d1", "d2", "div", "d5"]);
  console.log("12 div 5 ->", await entryValue(page));
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d1", "add", "d2", "div", "d5"]);
  console.log("1+2 div 5 ->", await entryValue(page));
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["div", "d5"]);
  console.log("div 5 ->", await entryValue(page));
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["lpar", "d1", "add", "d2", "rpar", "div", "d5"]);
  console.log("(1+2) div 5 ->", await entryValue(page));
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["x", "pow", "d2", "right", "div", "d3"]);
  console.log("x^2 div 3 ->", await entryValue(page));
  expect(true).toBe(true);
});
