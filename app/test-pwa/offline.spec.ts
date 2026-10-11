// SPDX-License-Identifier: GPL-3.0-or-later
// R1: after one online visit the web build works offline (start, Home, lazy Python chunk + MicroPython wasm).
// Production build only (npm run test:pwa). Expected values: derived.
import { expect, test } from "@playwright/test";
import { open, tap } from "../test/helpers.ts";

test("after one online visit: reload offline, 1+1 in Home, print(1) in Python", async ({ page, context }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
  // The worker registers once the engine is up; "ready" resolves when its install (the whole precache) is done.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await (await caches.open(keys[0] as string)).keys()).map((r) => new URL(r.url).pathname);
    return { n: keys.length, urls };
  });
  expect(cached.n).toBe(1);
  expect(cached.urls.some((u) => u.endsWith("/engine/giac.wasm"))).toBe(true);
  expect(cached.urls.some((u) => u.endsWith("/python/micropython.wasm"))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Home: 1+1 =
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "2");

  // Python (lazy chunk and micropython.wasm were never fetched online in this test): print(1)
  await tap(page, ["apps", "d3"]);
  await expect(page.locator('[data-app="python"]')).toBeVisible();
  await tap(page, ["num"]);
  await expect(page.getByTestId("python")).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
  await tap(page, ["shift", "alpha", "alpha", "eex", "d8", "tan", "paren", "div", "alpha", "paren", "d1", "shift", "paren", "enter"]);
  await expect(page.getByTestId("py-transcript").locator('pre[data-kind="out"]').last()).toHaveText("1");
});
