// SPDX-License-Identifier: GPL-3.0-or-later
// R4a (docs/04 3.3): Find's index is fetched only when the browser is idle after the engine is ready, never at start.
// requestIdleCallback is held here: its callbacks wait until the test lets them run.
import { expect, test } from "@playwright/test";

test("no request for the Find index or Find's code before the engine is ready and the browser idle", async ({ page }) => {
  await page.addInitScript(() => {
    const held: (() => void)[] = [];
    const w = window as unknown as { requestIdleCallback: (f: () => void) => number; __idle: () => void };
    w.requestIdleCallback = (f) => held.push(f);
    w.__idle = () => held.splice(0).forEach((f) => f());
  });
  const asked: { url: string; ready: boolean }[] = [];
  let ready = false;
  page.on("request", (r) => {
    if (/find-index|\/src\/find\//.test(r.url())) asked.push({ url: r.url(), ready });
  });
  await page.goto("/?engine=fake");
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready");
  ready = true;
  await page.waitForTimeout(1000);
  expect(asked).toEqual([]);
  await page.evaluate(() => (window as unknown as { __idle: () => void }).__idle());
  await expect.poll(() => asked.some((a) => /find-index/.test(a.url))).toBe(true);
  expect(asked.every((a) => a.ready)).toBe(true);
});
