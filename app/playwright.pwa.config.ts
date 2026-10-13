// SPDX-License-Identifier: GPL-3.0-or-later
// Offline (service worker) tests run against the production build served by `vite preview`: the dev server does not
// register the worker. Run: GIAC_OUT=<abs dir> npm run test:pwa
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PW_PWA_PORT"] ?? 4183);

export default defineConfig({
  testDir: "test-pwa",
  timeout: 60_000,
  webServer: {
    command: `npm run engine:copy && npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
