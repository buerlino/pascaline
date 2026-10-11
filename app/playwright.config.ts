// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  timeout: 30_000,
  webServer: {
    command: "npx vite --port 5181 --strictPort",
    url: "http://localhost:5181",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5181" },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
