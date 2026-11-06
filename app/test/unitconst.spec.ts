// SPDX-License-Identifier: GPL-3.0-or-later
// R92: the units menu's Constants and Tools (spec/units-menu.yaml), on the engine. A constant from Math › Constants goes
// on Home's line at its cursor as Find puts it there (R61's chip), and the unit view comes back on the new line with the
// slots it had; the Tools rows run the view's own places, or say why they cannot yet.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const find = (page: Page) => page.getByTestId("find");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const result = (page: Page) => page.getByTestId("unit-result");
const slot = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => (window.n62.unitView?.view.model(id)?.slot.tokens ?? []).map((t) => `${t.prefix ?? ""}${t.unit}`).join(" "), id);
/** Math, then the menu's rows by touch (the digits pick only rows 1 to 10). */
async function menu(page: Page, ...ids: string[]): Promise<void> {
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
  for (const id of ids) await row(page, id).tap();
}

test.describe("the units menu's Constants and Tools (R92)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("5 kg, then Math › Constants › Physics › g₀: the view is back on 5 kg · g₀ with kg in its slot; Enter gives 49.03325 N", async ({ page }) => {
    await tap(page, ["d5"]);
    await unitsKey(page);
    await tap(page, ["d4", "d6"]); // k, g
    expect(await slot(page, "u1")).toBe("kg");
    await menu(page, "ucat:const");
    await expect(page.getByTestId("sheet-title")).toHaveText("Find › Constants");
    await expect(find(page).getByRole("menuitem")).toHaveCount(5);
    await row(page, "uconst:Physics").tap();
    await row(page, "const:g_0").tap();
    await expect(find(page)).toBeHidden();
    await page.waitForFunction(() => /\\const\{g_0\}/.test(window.n62.unitView?.view.line ?? ""));
    await up(page);
    expect(await entryValue(page)).toMatch(/^5.*\\const\{g_0\}/); // the chip after Home's cursor
    expect(await slot(page, "u1")).toBe("kg"); // the slot went with the line
    expect(await page.evaluate(() => window.n62.unitView?.view.ids)).toEqual(["u1", "end"]); // a chip adds no slot
    await tap(page, ["enter", "enter"]); // the end slot, then evaluate there
    await expect(result(page)).toHaveAttribute("data-text", "49.03325"); // derived: 5 × 9.80665
    await expect(result(page)).toHaveAttribute("data-unit", "N");
  });

  test("Math › Constants › Math › π goes on the line as Home's π; the slots stay", async ({ page }) => {
    await tap(page, ["d2"]);
    await unitsKey(page);
    await tap(page, ["d6"]); // g
    await menu(page, "ucat:const", "uconst:Math", "math:pi");
    await page.waitForFunction(() => /\\pi/.test(window.n62.unitView?.view.line ?? ""));
    await up(page);
    expect(await entryValue(page)).toMatch(/^2.*\\pi$/);
    expect(await slot(page, "u1")).toBe("g");
  });

  test("Tools: before a result only the end slot runs; after one the SI form and the number into Home do", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9"]); // k, m
    await menu(page, "ucat:tools");
    await expect(row(page, "utool:si")).toHaveAttribute("aria-disabled", "true");
    await expect(find(page)).toContainText("needs a result first");
    await row(page, "utool:end").tap();
    await expect(find(page)).toBeHidden();
    expect(await page.evaluate(() => window.n62.unitView?.view.activeId)).toBe("end");
    await flick(page, "enter", "up"); // evaluate: 72 km
    await expect(result(page)).toHaveAttribute("data-unit", "km");
    await menu(page, "ucat:tools", "utool:si");
    await expect(result(page)).toHaveAttribute("data-unit", "m");
    await expect(result(page)).toHaveAttribute("data-text", "72000");
    expect(await slot(page, "end")).toBe("m");
    await menu(page, "ucat:tools", "utool:number");
    await expect(page.getByTestId("unit-view")).toBeHidden();
    expect(await entryValue(page)).toMatch(/\\res\{/); // the result as Home's chip
  });
});
