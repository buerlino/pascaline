// SPDX-License-Identifier: GPL-3.0-or-later
// A32: the core list (tests/core/core.yaml) on a device's WebView, attached over adb. The same replay and check as
// test/core.spec.ts (R74); only the page differs. Needs the test build (build.sh --test: WebView debugging on) installed;
// tools/core-device.sh holds the device lock and keeps the screen awake around it.
import { _android as android, test, type AndroidDevice, type Page } from "@playwright/test";
import { check, engineReady, loadCore, replay } from "../test/core-lib.ts";
import { planDevice } from "./core-plan.ts";
import { installTouchTap } from "./touch-tap.ts";

const PKG = "io.github.buerlino.pascaline"; // our app only (docs/shifts/rules.md section 3)
const plan = planDevice(loadCore());

let device: AndroidDevice;

/** The app's WebView page once it is up: a force-stop and a start, or a start after `pm clear`. */
async function launch(): Promise<Page> {
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const view = await device.webView({ pkg: PKG }, { timeout: 30_000 });
  const page = await view.page();
  installTouchTap(page);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined, undefined, { timeout: 30_000 });
  await engineReady(page);
  return page;
}

/** A fresh state: our app's data cleared (pm clear stops the app too), then a cold start. */
async function fresh(): Promise<Page> {
  await device.shell(`pm clear ${PKG}`);
  return launch();
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
        await check(page, c.expect);
      } catch (e) {
        // what the screen showed, for the report (a failing case is read from the log, not from a screenshot)
        const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400)).catch(() => "(page gone)");
        console.log(`${c.id} screen: ${seen}`);
        throw e;
      }
    });
  }
});
