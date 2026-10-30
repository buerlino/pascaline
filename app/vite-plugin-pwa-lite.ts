// SPDX-License-Identifier: GPL-3.0-or-later
// After `vite build`: give the engine files names with their content hash (A49), list every file in the output
// folder (hashed chunks, the engine, icons), fingerprint the list and write dist/sw.js from pwa/sw.js. A short plugin
// instead of a Workbox dependency (no runtime caching rules are needed: the app is entirely static and fully precached).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

const sha = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
/** An engine file's name carries the first 16 hex digits of its content's SHA-256: `giac.<hash>.mjs`. The worker checks it. */
const HASHED_ENGINE = /^engine\/giac\.([0-9a-f]{16})\.(mjs|wasm)$/;

export interface EngineFiles {
  readonly mjs: string;
  readonly wasm: string;
  /** giac.mjs with the wasm's plain name replaced by the hashed one (Emscripten loads it by that name). */
  readonly mjsText: string;
  readonly wasmBytes: Uint8Array;
}

/** The hashed names and contents of `dir`'s giac.mjs and giac.wasm, or null when the engine is not there. */
export function engineFiles(dir: string): EngineFiles | null {
  if (!existsSync(join(dir, "giac.mjs")) || !existsSync(join(dir, "giac.wasm"))) return null;
  const wasmBytes = readFileSync(join(dir, "giac.wasm"));
  const wasm = `giac.${sha(wasmBytes).slice(0, 16)}.wasm`;
  const plain = readFileSync(join(dir, "giac.mjs"), "utf8");
  if (!plain.includes("giac.wasm")) throw new Error("engine: giac.mjs does not name giac.wasm");
  const mjsText = plain.replaceAll("giac.wasm", wasm);
  return { mjs: `giac.${sha(mjsText).slice(0, 16)}.mjs`, wasm, mjsText, wasmBytes };
}

/**
 * Renames `outDir/engine/giac.{mjs,wasm}` to their hashed names (the engine files are the only ones Vite does not hash,
 * so a new giac.mjs could meet a stale giac.wasm from a cache). The workers name the file through `__GIAC_MJS__`
 * (vite.config.ts); a build whose JS lacks the new name fails here.
 */
export function hashEngine(outDir: string): void {
  const dir = join(outDir, "engine");
  const e = engineFiles(dir);
  if (!e) return;
  writeFileSync(join(dir, e.mjs), e.mjsText);
  writeFileSync(join(dir, e.wasm), e.wasmBytes);
  rmSync(join(dir, "giac.mjs"));
  rmSync(join(dir, "giac.wasm"));
  const used = walk(join(outDir, "assets")).some((f) => f.endsWith(".js") && readFileSync(f, "utf8").includes(e.mjs));
  if (!used) throw new Error(`engine: no built script names ${e.mjs}; vite.config.ts and the plugin disagree`);
}

/** List the files in `outDir`, fingerprint them and write `outDir/sw.js` from `root/pwa/sw.js`. */
export function writeServiceWorker(root: string, outDir: string): void {
  const files = precacheFiles(outDir);
  for (const f of files.filter((f) => f.startsWith("engine/"))) {
    const m = HASHED_ENGINE.exec(f);
    if (!m || sha(readFileSync(join(outDir, f))).slice(0, 16) !== m[1]) throw new Error(`engine file ${f} does not carry its content hash`);
  }
  const template = readFileSync(join(root, "pwa/sw.js"), "utf8");
  // the worker's own text is part of the version: a changed worker never reuses (or, failing, deletes) a cache in use
  const hash = createHash("sha256").update(template);
  for (const f of files) hash.update(f).update(createHash("sha256").update(readFileSync(join(outDir, f))).digest());
  const version = hash.digest("hex").slice(0, 12);
  // "./" is the app's start URL; index.html is also listed so offline navigations to either find a page.
  const list = ["./", ...files];
  const sw = template.replace("__CACHE__", `pascaline-${version}`).replace("__PRECACHE__", JSON.stringify(list));
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
      if (!existsSync(outDir)) return; // the build failed before writing: let Vite show its own error, not this one
      hashEngine(outDir);
      writeServiceWorker(root, outDir);
    },
  };
}
