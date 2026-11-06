// SPDX-License-Identifier: GPL-3.0-or-later
// A32: the core list (tests/core/core.yaml) on a device's WebView, attached over adb. The same replay and check as
// test/core.spec.ts (R74); only the page differs. Needs the test build (build.sh --test: WebView debugging on) installed;
// tools/core-device.sh holds the device lock and keeps the screen awake around it.
import { _android as android, test, type AndroidDevice, type Page } from "@playwright/test";
import { check, engineReady, loadCore, replay } from "../test/core-lib.ts";
import { NATIVE_PLUGINS, pluginProblem, planDevice } from "./core-plan.ts";
import { installTouchTap } from "./touch-tap.ts";

const PKG = "dev.n62.calc"; // our app only (docs/shifts/rules.md section 3)
const plan = planDevice(loadCore());

let device: AndroidDevice;

/** The app's WebView page once it is up: a force-stop and a start, or a start after `pm clear`. */
async function launch(): Promise<Page> {
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const view = await device.webView({ pkg: PKG }, { timeout: 30_000 });
  const page = await view.page();
  installTouchTap(page);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined, undefined, { timeout: 30_000 });
  await engineReady(page);
  // R139: a plugin name that differs between the JS and the APK is a silent fallback; failing here turns every case red, which the
  // night's CORE DEVICE count and case list report (a test with a non-case title would not reach them)
  const problem = pluginProblem(await page.evaluate((names) => {
    const cap = (window as unknown as { Capacitor?: { isPluginAvailable(n: string): boolean } }).Capacitor;
    return names.map((n) => [n, cap?.isPluginAvailable(n) ?? false] as const);
  }, NATIVE_PLUGINS));
  if (problem !== null) throw new Error(problem);
  return page;
}

/**
 * A fresh state: our app's data cleared (pm clear stops the app too), then a cold start. A fresh profile has not seen the
 * first-start tips (R15c4), so the overlay is due and takes the case's first key or tap; close it with "Got it" first.
 * Only here: a relaunch calls launch() alone, the flag is stored by then.
 */
async function fresh(): Promise<Page> {
  await device.shell(`pm clear ${PKG}`);
  const page = await launch();
  const tips = page.getByTestId("tips");
  await tips.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("tips-got-it").tap();
  await tips.waitFor({ state: "detached", timeout: 10_000 });
  return page;
}

test.beforeAll(async () => {
  const serial = process.env["ANDROID_SERIAL"];
  if (!serial) throw new Error("ANDROID_SERIAL is not set");
  const all = await android.devices();
  const found = all.find((d) => d.serial() === serial);
  if (!found) throw new Error(`device ${serial} not attached (seen: ${all.map((d) => d.serial()).join(", ") || "none"})`);
  device = found;
});
test.afterAll(async () => {
  await device?.shell(`am force-stop ${PKG}`).catch(() => undefined);
  await device?.close().catch(() => undefined);
});

const title = (c: { id: string; title: string; known?: string; needs?: string }): string =>
  `${c.id} ${c.title}${c.known ? ` [known ${c.known}]` : ""}${c.needs ? ` [needs ${c.needs}]` : ""}`;

test.describe("core list on the device", () => {
  for (const c of [...plan.active, ...plan.known, ...plan.needs].sort((a, b) => a.id.localeCompare(b.id))) {
    test(title(c), async () => {
      test.skip(c.needs !== undefined, `needs ${c.needs}`);
      if (c.known !== undefined) test.fail(true, `known ${c.known}`);
      let page = await fresh();
      try {
        page = await replay(page, c.keys, {
          back: async () => void (await device.shell("input keyevent KEYCODE_BACK")), // the real KEYCODE_BACK
          relaunch: async () => {
            await device.shell(`am force-stop ${PKG}`); // the real stop and start; the data stays
            page = await launch();
            return page;
          },
        });
        await check(page, c.expect, c.id);
      } catch (e) {
        // what the screen showed, for the report (a failing case is read from the log, not from a screenshot)
        const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400)).catch(() => "(page gone)");
        console.log(`${c.id} screen: ${seen}`);
        throw e;
      }
    });
  }
});
