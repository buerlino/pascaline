// SPDX-License-Identifier: GPL-3.0-or-later
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { pwaLite } from "./vite-plugin-pwa-lite.ts";
import { yamlPlugin } from "./vite-plugin-yaml.ts";

export default defineConfig({
  base: "./",
  plugins: [yamlPlugin(), svelte(), pwaLite()],
  build: { target: "es2022", manifest: true },
  // spec/keyboard.yaml lives one level above app/
  server: { host: true, fs: { allow: [".."] } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
});
