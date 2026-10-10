// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  timeout: 30_000,
  webServer: {
    command: "node scripts/copy-fonts.mjs && npx vite --port 5180 --strictPort",
    url: "http://localhost:5180",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5180" },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
