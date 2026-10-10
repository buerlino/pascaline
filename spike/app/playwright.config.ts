// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "bench",
  testMatch: "*.bench.ts",
  timeout: 15 * 60_000,
  workers: 1, // one browser at a time so runs don't compete for CPU
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173" },
  webServer: { command: "npm run preview", url: "http://localhost:4173", reuseExistingServer: true },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
