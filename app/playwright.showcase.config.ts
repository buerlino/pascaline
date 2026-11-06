// SPDX-License-Identifier: GPL-3.0-or-later
// The showcase recorder (tests/core/SHOWCASE.md "Next"): the clips pressed on a phone's WebView over adb while the phone
// records its screen. A config of its own, so tools/core-device.sh (playwright.device.config.ts) never runs it.
// Started by tools/showcase/record.sh, which holds the device lock and sets up the phone.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test-device",
  testMatch: "showcase.rec.ts",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
});
