// SPDX-License-Identifier: GPL-3.0-or-later
// R38a (decisions.md S6, archive/r11-files.md): Settings › Data › Save a backup downloads one JSON file holding every
// stored key that is present, each as stored with its stamp. The real engine (a definition needs the defs log).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const DATA_VERSION = 3; // storage.ts; the test also compares it with the app's own value below

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
  expect(b.dataVersion).toBe(DATA_VERSION);
  expect(Number.isNaN(Date.parse(b.made))).toBe(false);
  const present = Object.keys(b.parts);
  for (const k of ["settings", "view", "history", "defs", "userKeys"]) expect(present, k).toContain(k);
  expect(present).not.toContain("defsStarts");
  expect(present).not.toContain("backup.undo");
  for (const [k, rec] of Object.entries(b.parts)) {
    expect(rec["@pascaline"], k).toBe(DATA_VERSION);
    expect(rec, k).toHaveProperty("value");
  }
  expect((b.parts["settings"]?.value as { digits: number }).digits).toBe(9);
  expect(JSON.stringify(b.parts["defs"]?.value)).toContain("A");
  expect((b.parts["history"]?.value as { home: unknown[] }).home.length).toBe(2);
  expect(b.parts["userKeys"]?.value).toHaveProperty("u1");
});
