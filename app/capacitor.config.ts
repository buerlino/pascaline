// SPDX-License-Identifier: GPL-3.0-or-later
import type { CapacitorConfig } from '@capacitor/cli';

// PASCALINE_MEASURE=1 builds a measurement variant: console.log reaches logcat and MainActivity logs timing marks.
const measure = process.env.PASCALINE_MEASURE === '1';

// PASCALINE_WEBVIEW_DEBUG=1 (build.sh --test, the A32 device test build only) turns the WebView's remote debugging on, so
// Playwright can attach over adb. Every other build, F-Droid's included, leaves it off (app/scripts/core-device.test.ts).
export const webviewDebug = process.env.PASCALINE_WEBVIEW_DEBUG === '1';

const config: CapacitorConfig = {
  appId: 'io.github.buerlino.pascaline',
  appName: 'Pascaline',
  webDir: 'dist',
  loggingBehavior: measure ? 'production' : 'none',
  android: { path: '../android', webContentsDebuggingEnabled: webviewDebug }
};

export default config;
