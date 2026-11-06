// SPDX-License-Identifier: GPL-3.0-or-later
import type { CapacitorConfig } from '@capacitor/cli';

// PASCALINE_MEASURE=1 builds a measurement variant: console.log reaches logcat and MainActivity logs timing marks.
const measure = process.env.PASCALINE_MEASURE === '1';

// PASCALINE_WEBVIEW_DEBUG=1 (build.sh --test, the A32 device test build only) turns the WebView's remote debugging on, so
// Playwright can attach over adb. Every other build, F-Droid's included, leaves it off (app/scripts/core-device.test.ts).
export const webviewDebug = process.env.PASCALINE_WEBVIEW_DEBUG === '1';

const config: CapacitorConfig = {
  appId: 'dev.n62.calc',
  appName: 'N62',
  webDir: 'dist',
  loggingBehavior: measure ? 'production' : 'none',
  // A72: the WebView's first frame, before the page paints, is the Dark --bg (app/src/style.css), not the default white
  android: { path: '../android', backgroundColor: '#0b1020', webContentsDebuggingEnabled: webviewDebug }
};

export default config;
