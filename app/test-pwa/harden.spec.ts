// SPDX-License-Identifier: GPL-3.0-or-later
// A49: the web version survives updates and bad deploys. Production build only (npm run test:pwa). Expected values: derived
// (the rules in the package: manifest id, update line, hashed engine files, kill switch, missing chunk, persist).
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "../test/helpers.ts";
import { writeServiceWorker } from "../vite-plugin-pwa-lite.ts";
import { serve, type Site } from "./site.ts";

const APP = process.cwd();
const DIST = join(APP, "dist");
const copyOf = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "pwa-site-"));
  cpSync(DIST, dir, { recursive: true });
  return dir;
};
/** A second deploy: one changed file, the worker rewritten from it. */
function secondBuild(marker = "v2-marker"): string {
  const dir = copyOf();
  writeFileSync(join(dir, "index.html"), `${readFileSync(join(dir, "index.html"), "utf8")}<!-- ${marker} -->`);
  writeServiceWorker(APP, dir);
  return dir;
}
const precache = (sw: string): string[] => JSON.parse(/const PRECACHE = (\[.*\]);/.exec(sw)?.[1] ?? "[]") as string[];
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
const swReady = (page: Page): Promise<unknown> => page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

test("the manifest's id is /", async ({ request }) => {
  const m = (await (await request.get("/manifest.webmanifest")).json()) as { id?: string };
  expect(m.id).toBe("/");
});

test("every engine file in the precache list carries its content hash", async ({ request }) => {
  const sw = await (await request.get("/sw.js")).text();
  const engine = precache(sw).filter((u) => u.startsWith("engine/"));
  expect(engine.length).toBe(2);
  for (const u of engine) {
    const m = /^engine\/giac\.([0-9a-f]{16})\.(mjs|wasm)$/.exec(u);
    expect(m, u).not.toBeNull();
    const body = await (await request.get(`/${u}`)).body();
    expect(createHash("sha256").update(body).digest("hex").slice(0, 16)).toBe(m?.[1]);
  }
});

test("the worker's install fails when an engine file is missing or its hash differs", async ({ page }) => {
  const site = await serve(copyOf());
  try {
    const engine = precache(readFileSync(join(site.root, "sw.js"), "utf8")).filter((u) => u.startsWith("engine/"));
    const wasm = engine.find((u) => u.endsWith(".wasm")) as string;
    const mjs = engine.find((u) => u.endsWith(".mjs")) as string;
    writeFileSync(join(site.root, "probe.html"), "<!doctype html><title>probe</title>");
    const install = async (): Promise<{ state: string; caches: string[] }> => {
      await page.goto(`${site.url}/probe.html`);
      return page.evaluate(async () => {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const worker = (reg.installing ?? reg.waiting ?? reg.active) as ServiceWorker;
        await new Promise<void>((done) => {
          const check = (): void => (worker.state === "activated" || worker.state === "redundant" ? done() : undefined);
          worker.addEventListener("statechange", check);
          check();
        });
        const state = worker.state;
        await reg.unregister();
        return { state, caches: await caches.keys() };
      });
    };
    site.tamper.set(`/${wasm}`, Buffer.from("not the engine"));
    expect(await install()).toEqual({ state: "redundant", caches: [] });
    site.tamper.set(`/${wasm}`, null);
    expect((await install()).state).toBe("redundant");
    site.tamper.delete(`/${wasm}`);
    site.tamper.set(`/${mjs}`, null);
    expect((await install()).state).toBe("redundant");
    site.tamper.clear();
    const ok = await install(); // untouched files: it installs
    expect(ok.state).toBe("activated");
    expect(ok.caches.length).toBe(1);
  } finally {
    await site.close();
  }
});

test.describe("on a site that can change", () => {
  let site: Site;
  test.beforeEach(async () => {
    site = await serve(copyOf());
  });
  test.afterEach(async () => {
    await site.close();
  });
  const visit = async (page: Page): Promise<void> => {
    await page.goto(`${site.url}/`);
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await ready(page);
    await swReady(page);
    // the page is controlled from its second load on: that is the page an update has to reach
    await page.reload();
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await ready(page);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  };

  test("a second build shows the update line; Restart loads the new version once, never by itself", async ({ page }) => {
    await visit(page);
    let loads = 0;
    page.on("load", () => loads++);
    await page.evaluate(() => ((window as unknown as { __old: number }).__old = 1));
    await page.evaluate(() => window.pascaline.entry.set("12+34", {}));
    site.root = secondBuild();
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    const line = page.locator('[data-testid="update-note"]');
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toHaveAttribute("title", /new version/);
    expect(await line.evaluate((el) => el.closest('[data-testid="status"]') !== null)).toBe(true); // in the status line, not over the stage
    await page.waitForTimeout(1500);
    expect(loads).toBe(0); // nothing reloaded on its own; the user's line is still there
    expect(await page.evaluate(() => (window as unknown as { __old?: number }).__old)).toBe(1);
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("12+34");

    await line.click();
    await page.waitForFunction(() => (window as unknown as { __old?: number }).__old === undefined);
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await page.waitForTimeout(1500);
    expect(loads).toBe(1);
    expect(await page.evaluate(() => fetch("/index.html").then((r) => r.text()))).toContain("v2-marker");
    expect(await page.evaluate(() => caches.keys().then((k) => k.length))).toBe(1);
    await expect(line).toHaveCount(0);
  });

  test("two deploys while the tab stays open: Restart acts on the newest worker and loads the second version", async ({ page }) => {
    await visit(page);
    const update = (): Promise<unknown> => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    site.root = secondBuild("v2-marker");
    await update();
    const line = page.locator('[data-testid="update-note"]');
    await expect(line).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => ((window as unknown as { __w1: ServiceWorker }).__w1 = r?.waiting as ServiceWorker)));
    site.root = secondBuild("v3-marker");
    await update();
    // the first waiting worker is gone (redundant); the line stays up and now belongs to the second
    await page.waitForFunction(() => (window as unknown as { __w1: ServiceWorker }).__w1.state === "redundant", undefined, { timeout: 20_000 });
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => r?.waiting?.state === "installed"));
    await expect(line).toBeVisible();
    await Promise.all([page.waitForEvent("load", { timeout: 20_000 }), line.click()]);
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    expect(await page.evaluate(() => fetch("/index.html").then((r) => r.text()))).toContain("v3-marker");
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await expect(line).toHaveCount(0);
  });

  test("the kill-switch worker, served at the same path, unregisters itself, clears our caches and leaves a working page", async ({ page }) => {
    await visit(page);
    expect(await page.evaluate(() => caches.keys().then((k) => k.length))).toBe(1);
    site.tamper.set("/sw.js", readFileSync(join(APP, "pwa/kill/sw.js")));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    await expect
      .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length + (await caches.keys()).length), { timeout: 20_000 })
      .toBe(0);
    await page.reload();
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await page.evaluate(() => window.pascaline.entry.ready);
    await ready(page);
    await tap(page, ["d1", "add", "d1", "enter"]);
    await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "2");
  });
});

test.describe("a lazy chunk that is gone after a deploy", () => {
  test.use({ serviceWorkers: "block" });
  const chunk = (): string => {
    const m = JSON.parse(readFileSync(join(DIST, ".vite/manifest.json"), "utf8")) as Record<string, { file: string }>;
    return (m["src/apps/function/index.ts"] as { file: string }).file;
  };

  test("makes the page reload once and then work", async ({ page }) => {
    let gone = false; // the old deploy's file is gone until the page has reloaded: then the new deploy's index names the new file
    let loads = 0;
    page.on("load", () => {
      if (++loads > 1) gone = false;
    });
    await page.route(`**/${chunk()}`, (route) => (gone ? route.fulfill({ status: 404 }) : route.continue()));
    await open(page, "");
    await ready(page);
    gone = true; // armed after the start, which may fetch the chunk when idle
    const reloaded = page.waitForEvent("load");
    void page.evaluate(() => window.pascaline.shell.open("function")).catch(() => {});
    await reloaded;
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await ready(page);
    await page.evaluate(() => window.pascaline.shell.open("function"));
    await expect(page.locator('[data-app="function"]')).toBeVisible();
    expect(loads).toBe(2);
  });

  test("reloads only once when the chunk stays gone", async ({ page }) => {
    await page.route(`**/${chunk()}`, (route) => route.fulfill({ status: 404 }));
    let loads = 0;
    page.on("load", () => loads++);
    await open(page, "");
    await ready(page);
    void page.evaluate(() => window.pascaline.shell.open("function")).catch(() => {});
    await expect.poll(() => loads, { timeout: 10_000 }).toBe(2);
    await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
    await ready(page);
    void page.evaluate(() => window.pascaline.shell.open("function")).catch(() => {});
    await page.waitForTimeout(2500);
    expect(loads).toBe(2); // the session flag stops the loop
  });
});

test("navigator.storage.persist() is asked once, after the first stored value", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = navigator.storage.persist.bind(navigator.storage);
    navigator.storage.persist = () => {
      sessionStorage.setItem("__persist", String(Number(sessionStorage.getItem("__persist") ?? "0") + 1));
      return orig();
    };
  });
  const asked = (): Promise<number> => page.evaluate(() => Number(sessionStorage.getItem("__persist") ?? "0"));
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect.poll(asked, { timeout: 10_000 }).toBe(1);
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await ready(page);
  await tap(page, ["d2", "add", "d2", "enter"]);
  await page.waitForTimeout(1500);
  expect(await asked()).toBe(1);
});
