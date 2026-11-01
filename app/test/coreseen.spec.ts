// SPDX-License-Identifier: GPL-3.0-or-later
// R105: seen() of the core harness looks at every match when asked to (an array expect), not at the first only.
// A static page, no engine.
import { expect, test } from "@playwright/test";
import { seen } from "./core-lib.ts";

const list = (second: string): string =>
  `<body style="margin:0"><ul style="margin:0;padding:0;list-style:none">
     <li style="height:20px">x = 2</li><li style="height:20px;${second}">x = 3</li></ul></body>`;

test.describe("seen() on several matches", () => {
  test("every match visible: passes, with or without `every`", async ({ page }) => {
    await page.setContent(list(""));
    expect(await seen(page, "li")).toBe("");
    expect(await seen(page, "li", true)).toBe("");
  });

  test("a hidden second match fails `every`; a single check keeps looking at the first", async ({ page }) => {
    await page.setContent(list("visibility:hidden"));
    expect(await seen(page, "li")).toBe("");
    expect(await seen(page, "li", true)).toMatch(/^match 2 of 2: hidden/);
  });

  test("a second match clipped off screen fails `every`", async ({ page }) => {
    await page.setContent(list("position:absolute;top:5000px"));
    expect(await seen(page, "li")).toBe("");
    expect(await seen(page, "li", true)).toMatch(/^match 2 of 2: outside the viewport/);
  });

  test("a second match covered by another element fails `every`", async ({ page }) => {
    await page.setContent(list("") + `<div style="position:fixed;left:0;top:20px;width:100%;height:20px;background:red"></div>`);
    expect(await seen(page, "li")).toBe("");
    expect(await seen(page, "li", true)).toMatch(/^match 2 of 2: covered/);
  });

  test("no match is still reported", async ({ page }) => {
    await page.setContent(list(""));
    expect(await seen(page, "ol li", true)).toBe("no match");
    expect(await seen(page, "ol li")).toBe("no match");
  });

  test("a single match keeps today's message, without a prefix", async ({ page }) => {
    await page.setContent(`<body><p style="visibility:hidden">a</p></body>`);
    expect(await seen(page, "p", true)).toMatch(/^hidden, box/);
  });
});
