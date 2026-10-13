// SPDX-License-Identifier: GPL-3.0-or-later
// The UI gallery (U0, docs/05 section 4): `npm run gallery` renders every view, sheet and layer in light and dark
// at phone size into test/gallery/ (not committed) and writes test/gallery/index.html for the owner to review.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PW_PORT"] ?? 5181);

export default defineConfig({
  testDir: "gallery",
  timeout: 120_000,
  workers: 1,
  webServer: {
    command: `npm run engine:copy && npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
});
