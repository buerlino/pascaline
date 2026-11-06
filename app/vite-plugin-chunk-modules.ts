// SPDX-License-Identifier: GPL-3.0-or-later
// G163: Vite's manifest lists no modules, so a src/units/ module that Rollup hoists into a shared chunk (no src, no
// entry) is invisible to the size test's unit-view rule. This plugin writes dist/.vite/chunk-modules.json: for each
// emitted chunk file, the app's own modules (paths from app/, e.g. `src/units/row.ts`) it holds. Sorted, so two builds
// of one tree give the same bytes. `.vite/` is outside the precache (vite-plugin-pwa-lite.ts precacheFiles).
import { relative, resolve } from "node:path";
import type { Plugin } from "vite";

const APP = import.meta.dirname;

export function chunkModulesPlugin(): Plugin {
  return {
    name: "n62-chunk-modules",
    apply: "build",
    generateBundle(_options, bundle) {
      const out: Record<string, string[]> = {};
      for (const [file, item] of Object.entries(bundle)) {
        if (item.type !== "chunk") continue;
        out[file] = item.moduleIds
          .filter((id) => !id.includes("\0") && !id.includes("node_modules"))
          .map((id) => relative(APP, resolve(id.split("?")[0] ?? id)).split("\\").join("/"))
          .filter((rel) => rel.startsWith("src/"))
          .sort();
      }
      this.emitFile({ type: "asset", fileName: ".vite/chunk-modules.json", source: `${JSON.stringify(out, null, 1)}\n` });
    },
  };
}
