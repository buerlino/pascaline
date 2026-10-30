// SPDX-License-Identifier: GPL-3.0-or-later
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { aboutPlugin } from "./vite-plugin-about.ts";
import { engineFiles, pwaLite } from "./vite-plugin-pwa-lite.ts";
import { themeCssPlugin } from "./vite-plugin-theme-css.ts";
import { yamlPlugin } from "./vite-plugin-yaml.ts";

// The engine worker loads the engine by its hashed name in a production build (A49); the dev server and the tests use the plain one.
export default defineConfig(({ command }) => ({
  define: { __GIAC_MJS__: JSON.stringify((command === "build" && engineFiles("public/engine")?.mjs) || "giac.mjs") },
  base: "./",
  plugins: [yamlPlugin(), aboutPlugin(), svelte(), themeCssPlugin(), pwaLite()],
  build: { target: "es2022", manifest: true },
  worker: { plugins: () => [yamlPlugin()] }, // golden.worker.ts reads the golden YAML files (A20)
  // spec/keyboard.yaml lives one level above app/
  server: { host: true, fs: { allow: [".."] } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
}));
