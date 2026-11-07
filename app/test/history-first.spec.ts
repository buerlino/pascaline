// SPDX-License-Identifier: GPL-3.0-or-later
// R133 (F172): until the engine is ready History draws the newest 5 rows (10 MathLive renders: input and result each);
// a frame after it, 20 (40). The newest row recalls and inserts in both states; a picked row above the five is drawn.
import { expect, test, type Page } from "@playwright/test";
import { tap, tapTwice } from "./helpers.ts";

const N = 200;

async function seed(page: Page): Promise<void> {
  await page.goto("/?engine=fake&tips=off");
  await page.waitForFunction(() => window.n62 !== undefined);
  await page.evaluate(async (n) => {
    const items = Array.from({ length: n }, (_, k) => ({
      id: k + 1, view: "home", latex: `${k}+1`, status: "done", resultLatex: String(k + 1), text: String(k + 1), approximate: false, startedAt: 0,
    }));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("n62", 1);
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
}

/** A launch whose engine is ready after 2.5 s: the history is read and drawn first. */
async function held(page: Page): Promise<void> {
  await seed(page);
  await page.goto("/?engine=fake&tips=off&readydelay=2500");
  await page.waitForFunction((n) => window.n62?.session.home.length === n, N);
  await page.waitForFunction(() => window.n62.renderStats.count >= 10);
}

test("engine not ready: the newest five rows (10 renders); a frame after ready, twenty (about 40)", async ({ page }) => {
  await held(page);
  expect(await page.evaluate(() => window.n62.session.engineState)).toBe("starting");
  await expect(page.locator("article.item")).toHaveCount(5);
  // 5 rows, input and result each: 10 renders (a re-format of the five by the settings read may add 5)
  const before = await page.evaluate(() => window.n62.renderStats.count);
  expect(before).toBeGreaterThanOrEqual(10);
  expect(before).toBeLessThanOrEqual(15);
  await expect(page.locator("article.item").last()).toContainText(String(N));
  await expect.poll(() => page.evaluate(() => window.n62.session.engineState)).toBe("ready");
  await expect(page.locator("article.item")).toHaveCount(20);
  // 15 rows more, 2 renders each
  const after = await page.evaluate(() => window.n62.renderStats.count);
  expect(after - before).toBeGreaterThanOrEqual(30);
  expect(after - before).toBeLessThanOrEqual(40);
});

test("the newest row recalls and inserts before and after ready", async ({ page }) => {
  await held(page);
  await tapTwice(page.locator("article.item").last().locator(".in"), "click");
  expect(await page.evaluate(() => window.n62.entry.value)).toBe(`${N - 1}+1`);
  await page.evaluate(() => window.n62.entry.clear());
  await tapTwice(page.locator("article.item").last().locator(".result"), "click");
  await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toContain(String(N));
  await page.evaluate(() => window.n62.entry.clear());
  await expect.poll(() => page.evaluate(() => window.n62.session.engineState)).toBe("ready");
  await expect(page.locator("article.item")).toHaveCount(20);
  await tapTwice(page.locator("article.item").last().locator(".in"), "click");
  expect(await page.evaluate(() => window.n62.entry.value)).toBe(`${N - 1}+1`);
});

test("scrolling to the top after ready adds 20; a row picked above the five is drawn while starting", async ({ page }) => {
  await held(page);
  for (let i = 0; i < 8; i++) await tap(page, ["up"]); // the picked row is the 8th from the bottom
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  expect(await page.locator("article.item").count()).toBeGreaterThanOrEqual(8);
  await expect.poll(() => page.evaluate(() => window.n62.session.engineState)).toBe("ready");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  const drawn = await page.locator("article.item").count();
  await page.locator(".history").evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => page.locator("article.item").count()).toBeGreaterThanOrEqual(drawn + 15);
});
