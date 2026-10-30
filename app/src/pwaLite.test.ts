// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildOutDir, engineFiles, hashEngine, writeServiceWorker } from "../vite-plugin-pwa-lite.ts";

describe("pwa-lite build plugin", () => {
  it("keeps an absolute outDir (regression: it was joined onto the root, so closeBundle failed with ENOENT)", () => {
    expect(buildOutDir("/repo/app", "/scratch/out")).toBe("/scratch/out");
    expect(buildOutDir("/repo/app", "dist")).toBe("/repo/app/dist");
  });

  it("writes sw.js into the output folder, precaching every file except source maps", () => {
    const root = mkdtempSync(join(tmpdir(), "pwa-root-"));
    const out = mkdtempSync(join(tmpdir(), "pwa-out-"));
    mkdirSync(join(root, "pwa"));
    writeFileSync(join(root, "pwa/sw.js"), "const CACHE = '__CACHE__'; const LIST = __PRECACHE__;");
    mkdirSync(join(out, "assets"));
    writeFileSync(join(out, "index.html"), "<!doctype html>");
    writeFileSync(join(out, "assets/a.js"), "1");
    writeFileSync(join(out, "assets/a.js.map"), "{}");

    writeServiceWorker(root, buildOutDir(root, out));

    const sw = readFileSync(join(out, "sw.js"), "utf8");
    expect(sw).toContain(`const LIST = ["./","assets/a.js","index.html"];`);
    expect(sw).toMatch(/const CACHE = 'pascaline-[0-9a-f]{12}';/);
  });

  const engineOut = (): { root: string; out: string } => {
    const root = mkdtempSync(join(tmpdir(), "pwa-root-"));
    const out = mkdtempSync(join(tmpdir(), "pwa-out-"));
    mkdirSync(join(root, "pwa"));
    writeFileSync(join(root, "pwa/sw.js"), "const CACHE = '__CACHE__'; const PRECACHE = __PRECACHE__;");
    mkdirSync(join(out, "engine"));
    mkdirSync(join(out, "assets"));
    writeFileSync(join(out, "engine/giac.wasm"), "wasm bytes");
    writeFileSync(join(out, "engine/giac.mjs"), 'new URL("giac.wasm",import.meta.url)');
    return { root, out };
  };
  const h16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

  it("names the engine files by the hash of their content; the glue names the hashed wasm", () => {
    const { out } = engineOut();
    const e = engineFiles(join(out, "engine"));
    expect(e?.wasm).toBe(`giac.${h16("wasm bytes")}.wasm`);
    expect(e?.mjsText).toBe(`new URL("${e?.wasm}",import.meta.url)`);
    expect(e?.mjs).toBe(`giac.${h16(e?.mjsText ?? "")}.mjs`);
    expect(engineFiles(join(out, "assets"))).toBeNull();
  });

  it("hashEngine renames the files and fails when no script names the new file", () => {
    const { out } = engineOut();
    const e = engineFiles(join(out, "engine"));
    expect(() => hashEngine(out)).toThrow(/no built script names/);
    const { out: out2 } = engineOut();
    writeFileSync(join(out2, "assets/w.js"), `import("./engine/${e?.mjs}")`);
    hashEngine(out2);
    expect(readFileSync(join(out2, "engine", e?.mjs ?? ""), "utf8")).toBe(e?.mjsText);
    expect(() => readFileSync(join(out2, "engine/giac.wasm"))).toThrow();
  });

  it("refuses to write a worker whose precache list has an engine file without its hash", () => {
    const { root, out } = engineOut();
    expect(() => writeServiceWorker(root, out)).toThrow(/content hash/);
    const e = engineFiles(join(out, "engine"));
    writeFileSync(join(out, "assets/w.js"), e?.mjs ?? "");
    hashEngine(out);
    writeServiceWorker(root, out);
    expect(readFileSync(join(out, "sw.js"), "utf8")).toContain(`"engine/${e?.wasm}"`);
  });
});
