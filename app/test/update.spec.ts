// SPDX-License-Identifier: GPL-3.0-or-later
// A43: an app update keeps the user's data. tests/fixtures/update-from-ef857a6.json is the IndexedDB store that the
// 0.0.0 build (commit ef857a6, DATA_VERSION 1) wrote after: 5▶A, p(x):=x², 1+2 on Home, the angle mode set to degrees,
// and h(x):=sin(x), d/dx x³ in CAS (made once by tools/make-update-snapshot.mjs). Today's app opens it as an update would.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { DATA_VERSION } from "../src/state/storage.ts";
import { tap } from "./helpers.ts";

interface Snapshot {
  build: string;
  records: Record<string, unknown>;
}
const snapshot = JSON.parse(readFileSync(new URL("../../tests/fixtures/update-from-ef857a6.json", import.meta.url), "utf8")) as Snapshot;

/** Writes the old build's records into this origin's IndexedDB before the app has opened it (a static page of the origin, so
 *  the app's own code never runs first). */
async function seed(page: Page): Promise<void> {
  await page.route("**/__seed", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>seed</title>" }));
  await page.goto("/__seed");
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("pascaline", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("kv");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction("kv", "readwrite");
          for (const [k, v] of Object.entries(records)) tx.objectStore("kv").put(v, k);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
    snapshot.records,
  );
}

const stored = (page: Page, key: string): Promise<unknown> =>
  page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("pascaline", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const r = req.result.transaction("kv", "readonly").objectStore("kv").get(key);
          r.onsuccess = () => resolve(r.result);
        };
      }),
    key,
  );

const results = (page: Page): Promise<string[]> =>
  page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text") ?? ""));
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");

test.describe("an older build's data (ef857a6) in today's app", () => {
  test.beforeEach(async ({ page }) => {
    expect(snapshot.build).toBe("ef857a6");
    await seed(page);
    await page.goto("/");
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await page.evaluate(() => window.pascaline.entry.ready);
    await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
  });

  test("the view, the angle mode and the CAS history are back", async ({ page }) => {
    expect(await page.evaluate(() => window.pascaline.shell.app)).toBeNull();
    expect(await page.evaluate(() => window.pascaline.session.settings.angle)).toBe("deg");
    expect(await page.evaluate(() => window.pascaline.session.view)).toBe("cas");
    await expect(page.locator('[data-status="done"]')).toHaveCount(2);
    expect(await results(page)).toEqual([expect.stringContaining("sin"), "3*x^2"]); // derived: d/dx x³
  });

  test("the Home history, the stored value and the function are back", async ({ page }) => {
    await tap(page, ["@home"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(3);
    expect((await results(page)).at(-1)).toBe("3"); // derived: 1+2
    expect(await page.evaluate(() => window.pascaline.session.userNames.map((u) => `${u.name}:${u.kind}`).sort())).toEqual(["A:var", "h:fn", "p:fn"]);
    await tap(page, ["alpha", "vars", "mul", "d2", "enter"]); // A×2
    await expect(page.locator('[data-status="done"]')).toHaveCount(4);
    await expect(lastResult(page)).toHaveAttribute("data-text", "10"); // derived: 5·2
    await tap(page, ["shift", "alpha", "emark", "paren", "d3", "enter"]); // p(3)
    await expect(page.locator('[data-status="done"]')).toHaveCount(5);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9"); // derived: 3²
  });

  test("the CAS definition follows the stored angle mode", async ({ page }) => {
    await tap(page, ["@home"]);
    await page.evaluate(() => window.pascaline.entry.field?.setValue("h\\left(30\\right)"));
    await tap(page, ["enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(4);
    await expect(lastResult(page)).toHaveAttribute("data-text", "0.5"); // derived: sin 30° = 1/2
  });

  test("every record is written back in today's version", async ({ page }) => {
    await page.waitForTimeout(1000); // kvGet writes an upgraded record back, not awaited
    for (const key of ["defs", "history", "settings", "view"]) {
      expect((await stored(page, key)) as { "@pascaline": number }, key).toMatchObject({ "@pascaline": DATA_VERSION });
    }
  });
});
