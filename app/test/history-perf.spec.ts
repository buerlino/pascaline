// SPDX-License-Identifier: GPL-3.0-or-later
// A full history (200 entries, the limit) must not slow Enter: only the newest entries are drawn, and Enter
// draws only the new entry (MathLive markup is counted by renderStats).
import { expect, test } from "@playwright/test";
import { tap } from "./helpers.ts";

const N = 200;

test("200 stored entries: only the newest are drawn, Enter renders just the new one, earlier ones load on scroll", async ({ page }) => {
  await page.goto("/?engine=fake");
  await page.waitForFunction(() => window.pascaline !== undefined);
  // Seed the store directly (the same shape Session writes), then reload so the app restores it.
  await page.evaluate(async (n) => {
    const items = Array.from({ length: n }, (_, k) => ({
      id: k + 1,
      view: "home",
      latex: `${k}+1`,
      status: "done",
      resultLatex: String(k + 1),
      text: String(k + 1),
      approximate: false,
      startedAt: 0,
    }));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("pascaline", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => {
        const tx = req.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put({ home: items, cas: [] }, "history");
        tx.objectStore("kv").put("home", "view");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, N);
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.entry.field !== undefined);
  await page.waitForFunction((n) => window.pascaline.session.home.length === n, N);
  await expect(page.locator(".item").last()).toContainText(String(N));
  await page.waitForTimeout(300);

  const drawn = await page.locator(".item").count();
  expect(drawn).toBeLessThanOrEqual(21);
  expect(drawn).toBeGreaterThanOrEqual(20);

  const before = await page.evaluate(() => window.pascaline.renderStats.count);
  await tap(page, ["d7", "enter"]);
  await expect(page.locator('[data-status="done"]').last()).toContainText("7");
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.pascaline.renderStats.count);
  // the new entry: its input and its result; nothing else is re-rendered
  expect(after - before).toBe(2);

  // scrolling to the top draws earlier entries
  await page.locator(".history").evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => page.locator(".item").count()).toBeGreaterThan(drawn + 10);
});
