// SPDX-License-Identifier: GPL-3.0-or-later
// A43: an app update keeps the user's data, on a real device. Run through tools/update-device.sh (device lock, stay-awake).
//   OLD_APK=<apk of ef857a6, WebView debugging on> NEW_APK=<today's --test APK> ANDROID_SERIAL=<s> SHOTS=<dir> node tools/update-device.ts
// 1. `pm clear` our app (its data only), `adb install -r` the old APK, key the data of tests/fixtures/update-from-ef857a6.json
//    (5▶A, p(x):=x², 1+2, degrees; in CAS h(x):=sin(x) and d/dx x³) with real touches, force-stop.
// 2. `adb install -r` the new APK over it (never an uninstall), cold start, check each item (one `ITEM` line each), force-stop,
//    start again and check the records were written back in today's version. Screenshots go to $SHOTS.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pw = createRequire(join(repo, "app/package.json"))("@playwright/test") as typeof import("@playwright/test");
const { installTouchTap } = (await import(join(repo, "app/test-device/touch-tap.ts"))) as typeof import("../app/test-device/touch-tap.ts");

const PKG = "io.github.buerlino.pascaline"; // our app only (docs/shifts/rules.md section 3)
const need = (n: string): string => process.env[n] ?? ((): never => { throw new Error(`${n} is not set`); })();
const serial = need("ANDROID_SERIAL");
const oldApk = need("OLD_APK");
const newApk = need("NEW_APK");
const shots = need("SHOTS");
mkdirSync(shots, { recursive: true });

const adb = (...a: string[]): string => execFileSync("adb", ["-s", serial, ...a], { encoding: "utf8", timeout: 120_000 }).trim();
const version = (): string => adb("shell", "dumpsys", "package", PKG).match(/versionName=(\S+)/)?.[1] ?? "?";

const device = (await pw._android.devices()).find((d) => d.serial() === serial);
if (!device) throw new Error(`device ${serial} not attached`);

type Page = import("@playwright/test").Page;
async function launch(): Promise<Page> {
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const page = await (await device.webView({ pkg: PKG }, { timeout: 30_000 })).page();
  installTouchTap(page);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined, undefined, { timeout: 30_000 });
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 60_000 });
  return page;
}
const shot = (name: string): Promise<unknown> => device.screenshot({ path: join(shots, `${name}.png`) });
const done = (page: Page, n: number): Promise<unknown> =>
  page.waitForFunction((n) => document.querySelectorAll('[data-status="done"]').length === n, n, { timeout: 30_000 });
const results = (page: Page): Promise<string[]> =>
  page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text") ?? ""));
const keys = async (page: Page, ids: string[]): Promise<void> => {
  for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
};
const enter = async (page: Page, latex: string, n: number): Promise<void> => {
  await page.evaluate((l) => window.pascaline.entry.field?.setValue(l), latex);
  await keys(page, ["enter"]);
  await done(page, n);
};

let failed = 0;
const item = (name: string, got: unknown, want: unknown): void => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`ITEM ${name}: ${ok ? "ok" : "FAIL"} (${JSON.stringify(got)}${ok ? "" : `, wanted ${JSON.stringify(want)}`})`);
};
const attr = (p: Page): Promise<string | null> => p.locator('[data-testid="result"]').last().locator(".result").getAttribute("data-text");
const second = process.env["SECOND_START_ONLY"] === "1";
// ---- 1. the old build writes the data (SECOND_START_ONLY=1: skip 1 and 2, the data is on the device already)
let page: Page;
if (!second) {
console.log(`ITEM device ${serial}: ${adb("shell", "getprop", "ro.product.model")}, Android ${adb("shell", "getprop", "ro.build.version.release")}`);
adb("shell", "pm", "clear", PKG);
console.log(`ITEM install old: ${adb("install", "-r", oldApk).split("\n").pop()}; version ${version()}`);
page = await launch();
await keys(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]); // 5▶A
await done(page, 1);
await enter(page, "p\\left(x\\right):=x^2", 2);
await enter(page, "1+2", 3);
await page.evaluate(() => window.pascaline.session.setAngle("deg"));
await keys(page, ["app"]); // CAS
await enter(page, "h\\left(x\\right):=\\sin\\left(x\\right)", 1);
await enter(page, "\\frac{d}{dx}x^3", 2);
await page.waitForTimeout(1500); // the store writes are debounced (400 ms) and asynchronous
await shot("1-old-build-keyed");
adb("shell", "am", "force-stop", PKG);

// ---- 2. today's build over it
console.log(`ITEM install new over old (adb install -r): ${adb("install", "-r", newApk).split("\n").pop()}; version ${version()}`);
page = await launch();
await shot("2-new-build-first-start");
item("view (CAS) restored", await page.evaluate(() => window.pascaline.session.view), "cas");
item("angle mode restored", await page.evaluate(() => window.pascaline.session.settings.angle), "deg");
item("CAS history: 2 entries", await page.locator('[data-status="done"]').count(), 2);
item("CAS history: d/dx x³ result", (await results(page)).at(-1), "3*x^2");
item("names: stored value, function, CAS definition", await page.evaluate(() => window.pascaline.session.userNames.map((u) => `${u.name}:${u.kind}`).sort()), ["A:var", "h:fn", "p:fn"]);
// Home
await page.getByTestId("place").tap();
await page.getByTestId("apps").locator('[role="menuitem"][data-id="home"]').tap();
await page.waitForTimeout(500);
item("Home history: 3 entries", await page.locator('[data-status="done"]').count(), 3);
item("Home history: 1+2 result", (await results(page)).at(-1), "3");
await shot("3-new-build-home");
await keys(page, ["alpha", "vars", "mul", "d2", "enter"]); // A×2
await done(page, 4);
item("stored value: A×2", await attr(page), "10");
await keys(page, ["shift", "alpha", "emark", "paren", "d3", "enter"]); // p(3)
await done(page, 5);
item("function: p(3)", await attr(page), "9");
await page.evaluate(() => window.pascaline.entry.field?.setValue("h\\left(30\\right)"));
await keys(page, ["enter"]);
await done(page, 6);
item("CAS definition under the stored degrees: h(30)", await attr(page), "0.5");
await shot("4-new-build-after-checks");
await page.waitForTimeout(1500);
adb("shell", "am", "force-stop", PKG);

}
// ---- 3. a second start: the records are in today's version and still all there
page = await launch();
const stamps = await page.evaluate(
  () =>
    new Promise<Record<string, number>>((resolve, reject) => {
      const req = indexedDB.open("pascaline", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const s = req.result.transaction("kv", "readonly").objectStore("kv");
        const out: Record<string, number> = {};
        const ks = s.getAllKeys();
        const all = s.getAll();
        all.onsuccess = () => { // issued second, so it ends second: the keys are in
          ks.result.forEach((k, i) => (out[String(k)] = (all.result[i] as Record<string, number>)["@pascaline"] ?? -1));
          resolve(out);
        };
      };
    }),
);
const want = await page.evaluate(() => 3); // DATA_VERSION as of this branch (app/src/state/storage.ts)
for (const k of ["defs", "history", "settings", "view"]) item(`second start: ${k} stored as version ${want}`, stamps[k], want);
item("second start: angle mode", await page.evaluate(() => window.pascaline.session.settings.angle), "deg");
item("second start: user names", await page.evaluate(() => window.pascaline.session.userNames.map((u) => `${u.name}:${u.kind}`).sort()), ["A:var", "h:fn", "p:fn"]);
await shot("5-second-start");
adb("shell", "am", "force-stop", PKG);
await device.close();
console.log(failed === 0 ? "UPDATE DEVICE PASSED" : `UPDATE DEVICE FAILED: ${failed} item(s)`);
process.exit(failed === 0 ? 0 : 1);
