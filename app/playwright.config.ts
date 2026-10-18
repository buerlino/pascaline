// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

// PW_PORT: use a different port per checkout, so parallel runs never reuse each other's dev server.
const port = Number(process.env["PW_PORT"] ?? 5181);

export default defineConfig({
  testDir: "test",
  timeout: 30_000,
  webServer: {
    // GIAC_OUT=<dir with giac.mjs/giac.wasm> when the engine is not built in this checkout
    command: `npm run engine:copy && npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false, // a server on this port is another checkout's code: fail at once ("port in use")
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
