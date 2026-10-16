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

// R34 (F30): Android kills a background app when memory runs short; the half-typed line must survive it. A kill
// fires no pagehide, so the "kill" here is a hide (visibilitychange) followed by a fresh page on the same store,
// with the old page left as it was.
type Page = import("@playwright/test").Page;
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300); // the store write is asynchronous
}
/** A fresh start of the app on the same IndexedDB, as after a kill. */
async function relaunch(page: Page, query: string): Promise<Page> {
  const next = await page.context().newPage();
  await open(next, query);
  return next;
}
const cursorAtEnd = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return mf !== undefined && mf.selectionIsCollapsed && mf.position === mf.lastOffset;
  });
const engineReady = (page: Page) =>
  page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });

test("a half-typed line with a fraction and a result chip survives a kill (F30)", async ({ page }) => {
  await open(page, "");
  await engineReady(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "0.333333333333");
  await lastResult(page).locator(".result").tap();
  await tap(page, ["add", "d1", "div", "d2"]);
  const line = await entryValue(page);
  expect(line).toBe("\\res{1}{0.333333333333}+\\frac{1}{2}");
  const chips = await page.evaluate(() => window.pascaline.entry.chips);
  await hide(page);
  const next = await relaunch(page, "");
  expect(await entryValue(next)).toBe(line);
  expect(await next.evaluate(() => window.pascaline.entry.chips)).toEqual(chips);
  expect(await cursorAtEnd(next)).toBe(true);
  await engineReady(next);
  await tap(next, ["enter"]);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "0.833333333333"); // derived: 1/3 + 1/2 = 5/6
  // Enter cleared the stored line: a kill right after it brings back an empty line
  const third = await relaunch(next, "");
  expect(await entryValue(third)).toBe("");
});

test("Home and CAS each keep their own line, and an empty line stays empty", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await hide(page);
  const home = await relaunch(page, "engine=fake");
  expect(await home.evaluate(() => window.pascaline.session.view)).toBe("home");
  expect(await entryValue(home)).toBe("2+3");
  // Esc empties the line; the kill after it must not bring the old line back
  await tap(home, ["esc"]);
  await hide(home);
  const empty = await relaunch(home, "engine=fake");
  expect(await entryValue(empty)).toBe("");
  // a CAS line comes back in CAS
  await tap(empty, ["app", "d7", "mul", "d8"]);
  expect(await empty.evaluate(() => window.pascaline.session.view)).toBe("cas");
  await hide(empty);
  const cas = await relaunch(empty, "engine=fake");
  expect(await cas.evaluate(() => window.pascaline.session.view)).toBe("cas");
  expect(await entryValue(cas)).toBe("7\\times8");
  // a line kept from CAS never comes back into Home (Home computes it the numeric way)
  await cas.evaluate(() => window.pascaline.session.setView("home"));
  await cas.waitForTimeout(300);
  const other = await relaunch(cas, "engine=fake");
  expect(await other.evaluate(() => window.pascaline.session.view)).toBe("home");
  expect(await entryValue(other)).toBe("");
});

test("keys typed while the kept line loads go after it", async ({ page }) => {
  await open(page);
  await tap(page, ["d2"]);
  await hide(page);
  const next = await page.context().newPage();
  await next.goto("/?engine=fake");
  await next.locator('[data-key="d3"]').waitFor();
  await tap(next, ["d3", "d4"]);
  await next.waitForFunction(() => window.pascaline?.entry.field !== undefined, undefined, { timeout: 20_000 });
  await next.evaluate(() => window.pascaline.entry.ready);
  expect(await entryValue(next)).toBe("234");
});

test("a kept line whose chip entry is missing comes back without that chip, still parseable", async ({ page }) => {
  await open(page, "");
  // the stored record as storage.ts stamps it (DATA_VERSION 1), with the chip's table entry gone
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("pascaline", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction("kv", "readwrite");
          const value = { view: "home", latex: "\\res{7}{0.5}+\\frac{1}{4}\\times\\res{8}{2}", chips: { "res:8": { value: "2", exact: true } } };
          tx.objectStore("kv").put({ "@pascaline": 1, value }, "entry");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  const next = await relaunch(page, "");
  // the chip without a value becomes the digits it showed; the chip with one stays a chip
  expect(await entryValue(next)).toBe("0.5+\\frac{1}{4}\\times\\res{8}{2}");
  await engineReady(next);
  await tap(next, ["enter"]);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "1"); // derived: 0.5 + 2/4
});
