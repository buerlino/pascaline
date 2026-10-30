// SPDX-License-Identifier: GPL-3.0-or-later
// R87 (docs/05 3.4, mockups/settings.html frame 7): Settings › Help and about holds About Pascaline (version, licence,
// source) and the parts we use with their licences, each licence's full text a level that scrolls. The data is a lazy
// chunk: nothing is fetched at start. By keys and by touch. The fake engine.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const rows = (page: Page) => sheet(page).getByRole("menuitem");
const text = (page: Page) => page.getByTestId("sheet-text");
const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("start fetches no About data; opening Help and about does not either, About Pascaline does", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await open(page);
  await tap(page, ["@mode", "d5", "d4"]);
  await expect(title(page)).toHaveText("Mode › Settings › Help and about");
  expect(urls.filter((u) => /virtual:about|about-[\w-]+\.js/.test(u))).toEqual([]);
  await tap(page, ["d1"]);
  await expect(row(page, "version")).toBeVisible();
  expect(urls.filter((u) => /virtual:about|about-[\w-]+\.js/.test(u)).length).toBeGreaterThan(0);
});

test.describe("by keys", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await tap(page, ["@mode", "d5", "d4"]);
  });

  test("Help and about: About Pascaline and Parts we use; digit 1 shows the name, the version, GPL-3.0-or-later and the source URL", async ({ page }) => {
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, "about")).toContainText("About Pascaline");
    await expect(row(page, "parts")).toContainText("Parts we use and their licences");
    await tap(page, ["d1"]);
    await expect(title(page)).toHaveText("Settings › Help and about › About");
    await expect(row(page, "version")).toContainText(version);
    await expect(row(page, "licence")).toContainText("GPL-3.0-or-later");
    await expect(row(page, "source")).toContainText("https://github.com/buerlino/pascaline");
    for (const r of await rows(page).allInnerTexts()) expect(r).not.toMatch(/\b(HP|Prime)\b/);
    await tap(page, ["esc"]);
    await expect(title(page)).toHaveText("Mode › Settings › Help and about");
  });

  test("About › Licence opens the GPL text as a level that scrolls; ▼ pages down, ◀ goes back onto the same row", async ({ page }) => {
    await tap(page, ["d1", "d2"]);
    await expect(text(page)).toContainText("GNU GENERAL PUBLIC LICENSE");
    await expect(title(page)).toHaveText("Help and about › About › GPL-3.0-or-later");
    await expect(page.getByTestId("sheet-count")).toHaveCount(0); // a text has no item count
    const scrolls = await text(page).evaluate((e) => e.scrollHeight > e.clientHeight * 3);
    expect(scrolls).toBe(true);
    expect(await text(page).evaluate((e) => e.scrollTop)).toBe(0);
    await tap(page, ["down"]);
    await expect.poll(() => text(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(50);
    await tap(page, ["up"]);
    await expect.poll(() => text(page).evaluate((e) => e.scrollTop)).toBe(0);
    await tap(page, ["left"]);
    await expect(row(page, "licence")).toHaveAttribute("data-active", "true");
  });

  test("Parts we use: a row per part with its licence; Enter on MPFR shows the LGPL text, on GMP both of its licences", async ({ page }) => {
    await tap(page, ["d2"]);
    await expect(title(page)).toHaveText("Settings › Help and about › Parts");
    await expect.poll(() => rows(page).count()).toBeGreaterThan(30); // the chunk loads on the first look
    const mpfr = rows(page).filter({ hasText: "MPFR 4.2.2" });
    await expect(mpfr).toContainText("LGPL-3.0-or-later");
    await mpfr.tap();
    await expect(text(page)).toContainText("GNU LESSER GENERAL PUBLIC LICENSE");
    await tap(page, ["esc"]);
    await rows(page).filter({ hasText: "GMP 6.3.0" }).tap();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("LGPL-3.0-or-later");
    await expect(rows(page).last()).toContainText("GPL-2.0-or-later");
  });
});

test.describe("by touch", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await page.getByTestId("chip-format").tap();
    await row(page, "settings").tap();
    await row(page, "help").tap();
  });

  test("Parts we use: the highlighted part's copyright line shows under the list; a tap opens its licence; the text scrolls by touch wheel", async ({ page }) => {
    await row(page, "parts").tap();
    const giac = rows(page).filter({ hasText: "Giac 2.1.0" });
    await expect(giac).toContainText("GPL-3.0-or-later");
    await giac.tap();
    await expect(title(page)).toHaveText("Help and about › Parts › GPL-3.0-or-later");
    await expect(text(page)).toContainText("GNU GENERAL PUBLIC LICENSE");
    await text(page).hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => text(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(100);
    await sheet(page).getByRole("button", { name: "Back" }).tap();
    await expect(title(page)).toHaveText("Settings › Help and about › Parts");
  });

  test("About Pascaline: Credits opens a text; × closes the sheet", async ({ page }) => {
    await row(page, "about").tap();
    await row(page, "credits").tap();
    await expect(text(page)).toContainText("Giac");
    await sheet(page).getByRole("button", { name: "Close" }).tap();
    await expect(sheet(page)).toHaveCount(0);
  });
});
