// SPDX-License-Identifier: GPL-3.0-or-later
// R38a (decisions.md S6, archive/r11-files.md): Settings › Data › Save a backup downloads one JSON file holding every
// stored key that is present, each as stored with its stamp. The real engine (a definition needs the defs log).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test("Settings › Data › Save a backup downloads the envelope with every present key and its stamp", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  // history (two rows), a definition (5▶A), a setting and a user key
  await tap(page, ["d1", "div", "d3", "enter"]);
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await page.evaluate(() => window.pascaline.session.setDigits(9));
  await page.evaluate(() => window.pascaline.userKeys.set("u1", "primary", { label: "Home", action: { special: "home" } }));
  await page.waitForTimeout(900); // the writes are debounced and asynchronous

  await tap(page, ["@mode", "d5"]);
  await page.getByTestId("menu").locator('[data-id="data"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Data");
  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^pascaline-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const text = readFileSync((await file.path()) as string, "utf8");
  console.log(`BACKUP SIZE ${Buffer.byteLength(text)} bytes`);
  await expect(page.getByTestId("notice")).toHaveText("Backup saved");

  const b = JSON.parse(text) as { "pascaline-backup": number; dataVersion: number; made: string; parts: Record<string, { "@pascaline": number; value: unknown }> };
  expect(b["pascaline-backup"]).toBe(1);
  // dataVersion is the app's DATA_VERSION (backup.test.ts compares it with storage.ts); every part carries that stamp
  expect(Number.isInteger(b.dataVersion) && b.dataVersion >= 3).toBe(true);
  expect(Number.isNaN(Date.parse(b.made))).toBe(false);
  const present = Object.keys(b.parts);
  for (const k of ["settings", "history", "defs", "userKeys"]) expect(present, k).toContain(k);
  expect(present).not.toContain("defsStarts");
  expect(present).not.toContain("backup.undo");
  for (const [k, rec] of Object.entries(b.parts)) {
    expect(rec["@pascaline"], k).toBe(b.dataVersion);
    expect(rec, k).toHaveProperty("value");
  }
  expect((b.parts["settings"]?.value as { digits: number }).digits).toBe(9);
  expect(JSON.stringify(b.parts["defs"]?.value)).toContain("A");
  expect((b.parts["history"]?.value as { home: unknown[] }).home.length).toBe(2);
  expect(b.parts["userKeys"]?.value).toHaveProperty("u1");
});

test("Save a backup works when the sheet opened before the clipboard code arrived", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route(/clipboard\/actions\.svelte/, async (route) => {
    await held; // the chunk is late: the sheet opens first
    await route.continue();
  });
  await open(page, "engine=fake");
  await tap(page, ["@mode", "d5"]);
  await page.getByTestId("menu").locator('[data-id="data"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Data");
  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  release();
  expect((await download).suggestedFilename()).toMatch(/^pascaline-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByTestId("notice")).toHaveText("Backup saved");
});
