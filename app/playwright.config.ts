// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  timeout: 30_000,
  webServer: {
    // GIAC_OUT=<dir with giac.mjs/giac.wasm> when the engine is not built in this checkout
    command: "npm run engine:copy && npx vite --port 5181 --strictPort",
    url: "http://localhost:5181",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5181" },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
