// SPDX-License-Identifier: GPL-3.0-or-later
import type { CapacitorConfig } from '@capacitor/cli';

// PASCALINE_MEASURE=1 builds a measurement variant: console.log reaches logcat and MainActivity logs timing marks.
const measure = process.env.PASCALINE_MEASURE === '1';

const config: CapacitorConfig = {
  appId: 'io.github.buerlino.pascaline',
  appName: 'Pascaline',
  webDir: 'dist',
  loggingBehavior: measure ? 'production' : 'none',
  android: { path: '../android' }
};

export default config;
