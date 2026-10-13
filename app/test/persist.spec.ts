// SPDX-License-Identifier: GPL-3.0-or-later
// History persistence and the lazy-loaded entry line.
import { expect, test } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const lastResult = (page: import("@playwright/test").Page) => page.locator('[data-testid="result"]').last();

test("history survives a reload and is drawn without calling the engine", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  await tap(page, ["app", "shift", "sq", "d8", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  // the view that was open (CAS) comes back with its entry and its 2D result
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  expect(await lastResult(page).locator(".math").getAttribute("data-latex")).toBe("2\\sqrt{2}");
  await tap(page, ["app"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "0.333333333333");
});

test("keys pressed before MathLive has loaded are queued and replayed", async ({ page }) => {
  await page.goto("/?engine=fake");
  await page.locator('[data-key="d1"]').waitFor();
  await tap(page, ["d1", "div", "d3"]);
  await page.waitForFunction(() => window.pascaline.entry.field !== undefined, undefined, { timeout: 20_000 });
  expect(await entryValue(page)).toBe("\\frac13");
});

test("a definition survives a reload (docs/04 6.2: the defs log is stored and replayed at engine start)", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]); // 5▶A
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(800); // the history and the defs log are written asynchronously
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.entry.ready);
  await tap(page, ["alpha", "vars", "mul", "d2", "enter"]); // A×2
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "10"); // derived: 5·2
  // Vars and Find read the user's names from the session (docs/04 3.4)
  expect(await page.evaluate(() => window.pascaline.session.userNames.map((u) => `${u.name}:${u.kind}`))).toEqual(["A:var"]);
});
