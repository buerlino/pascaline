// SPDX-License-Identifier: GPL-3.0-or-later
// R71: ± on Shift + `,` (decisions.md "M4-2" point 5; the G2's Eval, which we omit). The key types \pm on the entry line
// of Home and CAS, the line the unit view reads (units mode, R28); in an app, with the unit view open or in a sheet the
// cell is dimmed and types nothing. The hardware keyboard is unchanged. Expected: G18, ± is pasupm(value, σ).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const key = (page: Page, id: string) => page.locator(`[data-key="${id}"]`);

test.describe("± on Shift + ,", () => {
  test("the legend is ± and the line gets \\pm; the tap on `,` is unchanged", async ({ page }) => {
    await open(page, "engine=fake");
    await tap(page, ["d2", "dot", "d5", "shift"]);
    await expect(key(page, "comma").locator(".main")).toHaveText("±");
    await tap(page, ["comma"]);
    expect(await entryValue(page)).toBe("2.5\\pm");
    await tap(page, ["d0", "dot", "d1", "comma"]);
    expect(await entryValue(page)).toBe("2.5\\pm0.1,");
  });

  test("a flick up on `,` types ±, in Home and in CAS", async ({ page }) => {
    await open(page, "engine=fake");
    await tap(page, ["d2"]);
    await flick(page, "comma", "up");
    expect(await entryValue(page)).toBe("2\\pm");
    await page.evaluate(() => (window.n62.session.view = "cas"));
    await tap(page, ["esc"]);
    await tap(page, ["d3"]);
    await flick(page, "comma", "up");
    expect(await entryValue(page)).toBe("3\\pm");
  });

  test("dimmed and silent where nothing reads it: in an app and in the unit view", async ({ page }) => {
    await open(page, "engine=fake");
    await expect(key(page, "comma")).not.toHaveAttribute("data-dead", "true");
    await tap(page, ["shift"]);
    await expect(key(page, "comma")).not.toHaveAttribute("data-dead", "true"); // Home: live
    await tap(page, ["shift"]);
    await page.evaluate(async () => window.n62.shell.open("solve", "symb"));
    await page.waitForFunction(() => window.n62.shell.loading === null);
    await tap(page, ["shift"]);
    await expect(key(page, "comma")).toHaveAttribute("data-dead", "true");
    await tap(page, ["comma"]);
    expect(await entryValue(page)).toBe("");
    await page.evaluate(() => window.n62.shell.close());
    await tap(page, ["d2"]);
    await flick(page, "tmpl", "up");
    await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
    await flick(page, "comma", "up"); // no pad cell: dead in the unit view, the line is not touched
    await page.evaluate(() => window.n62.unitView?.close());
    expect(await entryValue(page)).toBe("2");
  });

  test("2.5 ± 0.1 m, then the units key: the value with σ 0.1 (G18)", async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await tap(page, ["d2", "dot", "d5", "shift", "comma", "d0", "dot", "d1"]);
    expect(await entryValue(page)).toBe("2.5\\pm0.1");
    await flick(page, "tmpl", "up");
    await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
    await tap(page, ["d9"]); // m
    await flick(page, "enter", "up");
    const result = page.getByTestId("unit-result");
    await expect(result).toHaveAttribute("data-unit", "m");
    await expect(result).toContainText("2.5");
    await expect(result).toContainText("± 0.1");
  });

  test("Enter on 2.5 ± 0.1 in Home says where ± is read, and adds no result", async ({ page }) => {
    await open(page, "engine=fake");
    await tap(page, ["d2", "dot", "d5", "shift", "comma", "d0", "dot", "d1", "enter"]);
    const row = page.getByTestId("result").last();
    await expect(row.locator(".error")).toHaveText("± is read in the unit view: press the units key");
    await expect(row.locator(".result")).toHaveCount(0);
  });
});
