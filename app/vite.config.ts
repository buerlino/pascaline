// SPDX-License-Identifier: GPL-3.0-or-later
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  build: { target: "es2022" },
  server: { host: true },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
