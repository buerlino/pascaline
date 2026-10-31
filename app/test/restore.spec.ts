// SPDX-License-Identifier: GPL-3.0-or-later
// R38b (decisions.md S6, archive/r11-files.md section 3.4, 3.5): Settings › Data › Restore from a file. A backup saved in
// one browser restores into an empty store (a new context) as the same history, definitions (a variable's value after
// the replay), settings and user keys; Undo the restore gives back the state from before; a file with a part from a
// newer version is refused with its message and nothing changes. The real engine (the definitions replay).
import { readFileSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

interface State {
  home: string[];
  settings: string;
  u1: string | undefined;
}
const state = (page: Page): Promise<State> =>
  page.evaluate(() => {
    const p = window.pascaline;
    return { home: p.session.home.map((i) => i.latex), settings: JSON.stringify(p.session.settings), u1: p.userKeys.labelOf("u1", "primary") };
  });
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 30_000 });

async function dataSection(page: Page): Promise<void> {
  await tap(page, ["@mode", "d5"]);
  await page.getByTestId("menu").locator('[data-id="data"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Data");
}
/** Settings › Data › Restore from a file, with the file given to the picker. */
async function pick(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await dataSection(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("menu").locator('[data-id="restore"]').tap();
  await (await chooser).setFiles(file);
}
/** Tap a row of the open sheet that reloads the page, and wait for the app to be back with its engine. */
async function reloadingTap(page: Page, id: string): Promise<void> {
  const load = page.waitForEvent("load");
  await page.getByTestId("menu").locator(`[data-id="${id}"]`).tap();
  await load;
  await page.waitForFunction(() => window.pascaline !== undefined);
  await ready(page);
}

test("a backup restores into an empty store as the same state, and Undo gives back the state from before", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]); // 5▶A
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await page.evaluate(() => window.pascaline.session.setDigits(9));
  await page.evaluate(() => window.pascaline.userKeys.set("u1", "primary", { label: "Home", action: { special: "home" } }));
  await page.waitForTimeout(900); // the writes are debounced and asynchronous
  const saved = await state(page);
  await dataSection(page);
  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  const path = (await (await download).path()) as string;

  // a new context: an empty store, with a state of its own (digits 7, one row)
  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: new URL(page.url()).origin });
  const other = await ctx.newPage();
  await open(other, "");
  await ready(other);
  await tap(other, ["d2", "add", "d2", "enter"]);
  await expect(other.locator('[data-status="done"]')).toHaveCount(1);
  await other.evaluate(() => window.pascaline.session.setDigits(7));
  await other.waitForTimeout(900);
  const before = await state(other);
  expect(before.u1).toBeUndefined();

  const focus = (): Promise<string> =>
    other.evaluate(() => {
      const out: string[] = [];
      for (let e = document.activeElement; e; e = e.shadowRoot?.activeElement ?? null) out.push(e.tagName);
      return out.join(">");
    });
  const focusBefore = await focus();
  await pick(other, path);
  await expect(other.getByTestId("sheet-title")).toHaveText("Restore from a file");
  // R22: the hidden input never takes the focus, and the pick moves it nowhere (the return from Android's picker is
  // annabell's device check, A11)
  expect(await focus()).toBe(focusBefore);
  expect(await focus()).not.toContain("INPUT");
  const menu = other.getByTestId("menu");
  for (const id of ["settings", "history", "defs", "userKeys"]) await expect(menu.locator(`[data-id="${id}"]`)).toBeVisible();
  await expect(menu.locator('[data-id="history"]')).toContainText("Home 2 · CAS 0 rows");
  await reloadingTap(other, "restore");

  await expect(other.locator('[data-status="done"]')).toHaveCount(2);
  expect(await state(other)).toEqual(saved);
  await tap(other, ["alpha", "vars", "enter"]); // A after the replay of the restored log
  await expect(other.locator('[data-status="done"]')).toHaveCount(3);
  expect(await other.evaluate(() => window.pascaline.session.home.at(-1)?.resultLatex)).toBe("5");

  await other.waitForTimeout(900);
  await dataSection(other);
  await expect(other.getByTestId("menu").locator('[data-id="undo"]')).toContainText(/^.*Undo the restore \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)/);
  await reloadingTap(other, "undo");
  await expect(other.locator('[data-status="done"]')).toHaveCount(1);
  expect(await state(other)).toEqual(before);
  await dataSection(other);
  await expect(other.getByTestId("menu").locator('[data-id="undo"]')).toHaveCount(0); // the kept copy is gone
  await ctx.close();
});

test("a file with a part from a newer version is refused with its message, and nothing changes", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "engine=fake");
  await page.evaluate(() => window.pascaline.session.setDigits(8));
  await page.waitForTimeout(900);
  await dataSection(page);
  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  const b = JSON.parse(readFileSync((await (await download).path()) as string, "utf8")) as { dataVersion: number; parts: Record<string, { value: unknown }> };
  const v = b.dataVersion;
  b.parts["settings"] = { "@pascaline": v, value: { ...(b.parts["settings"]?.value as object), digits: 4 } } as { value: unknown };
  b.parts["defs"] = { "@pascaline": v + 1, value: [] } as { value: unknown };
  const before = await state(page);

  await pick(page, { name: "newer.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(b)) });
  await expect(page.getByTestId("notice")).toHaveText(`Definitions: made by a newer Pascaline (version ${v + 1}; this one reads up to ${v})`);
  await expect(page.getByTestId("sheet-title")).toHaveCount(0); // no restore sheet
  expect(await state(page)).toEqual(before);
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(8);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.pascaline.session.settings.digits)).toBe(8); // nothing was written
  await dataSection(page);
  await expect(page.getByTestId("menu").locator('[data-id="undo"]')).toHaveCount(0);
});
