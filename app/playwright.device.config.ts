// SPDX-License-Identifier: GPL-3.0-or-later
// A32: the core list on a phone's or tablet's WebView over adb (tools/core-device.sh runs it under the device lock).
// No web server: the app is the test build (build.sh --test) installed on the device.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test-device",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["./test-device/device-reporter.ts"]],
});
