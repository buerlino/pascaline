#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// A43: what an older build wrote. Builds the app of commit ef857a6 (the 0.0.0 build, DATA_VERSION 1) in a scratch tree,
// keys a history, a stored value, a function, the angle mode and a CAS definition into it, and writes the IndexedDB
// store ("pascaline" / "kv") as JSON to tests/fixtures/update-from-ef857a6.json. The result is checked in; app/test/
// update.spec.ts loads it into today's app. Run once (or to redo it): GIAC_OUT=<abs dir> node tools/make-update-snapshot.mjs
// Needs the app's node_modules (hard-linked into the scratch tree) and the Giac dev engine ($GIAC_OUT).
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REV = "ef857a6";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = join(repo, ".tasks", `snapshot-${REV}`); // .tasks/ is gitignored and on the repo's filesystem (hard links)
const out = join(repo, "tests/fixtures", `update-from-${REV}.json`);
const port = Number(process.env["SNAPSHOT_PORT"] ?? 5291);
const engine = process.env["GIAC_OUT"];
if (!engine || !existsSync(join(engine, "giac.wasm"))) {
  console.error("make-update-snapshot: set GIAC_OUT to the dir with giac.mjs and giac.wasm");
  process.exit(2);
}

rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
execFileSync("sh", ["-c", `git -C "${repo}" archive ${REV} | tar -x -C "${scratch}"`]);
execFileSync("cp", ["-al", join(repo, "app/node_modules"), join(scratch, "app/node_modules")]);
const app = join(scratch, "app");
execFileSync("node", ["scripts/copy-engine.mjs"], { cwd: app, env: { ...process.env, GIAC_OUT: engine }, stdio: "inherit" });

const server = spawn("npx", ["vite", "--port", String(port), "--strictPort"], { cwd: app, stdio: "ignore" });
const { chromium, devices } = createRequire(join(repo, "app/package.json"))("@playwright/test");
const base = `http://localhost:${port}`;
let browser;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 120) throw new Error("vite did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: base });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 60_000 });
  const tap = async (ids) => {
    for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
  };
  const done = (n) => page.waitForFunction((n) => document.querySelectorAll('[data-status="done"]').length === n, n, { timeout: 30_000 });
  const enter = async (latex, n) => {
    await page.evaluate((l) => window.pascaline.entry.field.setValue(l), latex);
    await tap(["enter"]);
    await done(n);
  };
  // Home: a stored value (5▶A), a function (p(x):=x²), a sum
  await tap(["d5", "shift", "emark", "alpha", "vars", "enter"]);
  await done(1);
  await enter("p\\left(x\\right):=x^2", 2);
  await enter("1+2", 3);
  await page.evaluate(() => window.pascaline.session.setAngle("deg"));
  // CAS: a definition that depends on the angle mode, and a use of it
  await tap(["app"]);
  await enter("h\\left(x\\right):=\\sin\\left(x\\right)", 1);
  await enter("\\frac{d}{dx}x^3", 2);
  await page.waitForTimeout(1500); // the store writes are debounced (400 ms) and asynchronous
  const dump = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("pascaline", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const store = req.result.transaction("kv", "readonly").objectStore("kv");
          const keys = store.getAllKeys();
          const vals = store.getAll();
          vals.onsuccess = () => resolve(Object.fromEntries(keys.result.map((k, i) => [k, vals.result[i]])));
        };
      }),
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ build: REV, records: dump }, null, 2) + "\n");
  console.log(`wrote ${out}: ${Object.keys(dump).join(", ")}`);
} finally {
  await browser?.close();
  server.kill();
}
