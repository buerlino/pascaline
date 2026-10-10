// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "vite";

export default defineConfig({
  worker: { format: "es" },
  build: { target: "es2022" },
});
