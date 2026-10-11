// SPDX-License-Identifier: GPL-3.0-or-later
// After `vite build`: list every file in the output folder (hashed chunks, public/ engine and Python wasm, icons),
// fingerprint the list and write dist/sw.js from pwa/sw.js. About 40 lines instead of a Workbox dependency
// (no runtime caching rules are needed: the app is entirely static and fully precached).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function pwaLite(): Plugin {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "pascaline-pwa-lite",
    apply: "build",
    configResolved(c) {
      outDir = join(c.root, c.build.outDir);
      root = c.root;
    },
    closeBundle() {
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split(sep).join("/"))
        .filter((f) => f !== "sw.js" && !f.endsWith(".map"))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(createHash("sha256").update(readFileSync(join(outDir, f))).digest());
      const version = hash.digest("hex").slice(0, 12);
      // "./" is the app's start URL; index.html is also listed so offline navigations to either find a page.
      const list = ["./", ...files];
      const sw = readFileSync(join(root, "pwa/sw.js"), "utf8").replace("__CACHE__", `pascaline-${version}`).replace("__PRECACHE__", JSON.stringify(list));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}
