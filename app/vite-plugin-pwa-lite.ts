// SPDX-License-Identifier: GPL-3.0-or-later
// After `vite build`: list every file in the output folder (hashed chunks, public/ engine wasm, icons),
// fingerprint the list and write dist/sw.js from pwa/sw.js. About 40 lines instead of a Workbox dependency
// (no runtime caching rules are needed: the app is entirely static and fully precached).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The build output folder; `outDir` may be relative to the project root or absolute (`vite build --outDir /abs`). */
export function buildOutDir(root: string, outDir: string): string {
  return resolve(root, outDir);
}

/** The files the service worker precaches: everything in `outDir` except sw.js, source maps and Vite's own `.vite/` (manifest). Sorted, "/"-separated. */
export function precacheFiles(outDir: string): string[] {
  return walk(outDir)
    .map((p) => relative(outDir, p).split(sep).join("/"))
    .filter((f) => f !== "sw.js" && !f.endsWith(".map") && !f.startsWith(".vite/"))
    .sort();
}

/** List the files in `outDir`, fingerprint them and write `outDir/sw.js` from `root/pwa/sw.js`. */
export function writeServiceWorker(root: string, outDir: string): void {
  const files = precacheFiles(outDir);
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(createHash("sha256").update(readFileSync(join(outDir, f))).digest());
  const version = hash.digest("hex").slice(0, 12);
  // "./" is the app's start URL; index.html is also listed so offline navigations to either find a page.
  const list = ["./", ...files];
  const sw = readFileSync(join(root, "pwa/sw.js"), "utf8").replace("__CACHE__", `pascaline-${version}`).replace("__PRECACHE__", JSON.stringify(list));
  writeFileSync(join(outDir, "sw.js"), sw);
}

export function pwaLite(): Plugin {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "pascaline-pwa-lite",
    apply: "build",
    configResolved(c) {
      outDir = buildOutDir(c.root, c.build.outDir);
      root = c.root;
    },
    closeBundle() {
      writeServiceWorker(root, outDir);
    },
  };
}
