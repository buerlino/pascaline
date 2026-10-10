// SPDX-License-Identifier: GPL-3.0-or-later
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.pascaline.app',
  appName: 'Pascaline',
  webDir: 'dist',
  // spike only: keep console.log in logcat for release builds (timing marks)
  loggingBehavior: 'production'
};

export default config;
