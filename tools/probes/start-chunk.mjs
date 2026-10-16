// SPDX-License-Identifier: GPL-3.0-or-later
// Start-chunk probe (R35): builds app/ with source maps into tools/probes/_out/start-chunk/ and prints the raw bytes
// of the start chunk (the entry plus every chunk it imports statically) per source file, largest first.
//   node tools/probes/start-chunk.mjs [--top=N] [--no-build]
// Bytes per source: each source-map segment owns the generated text up to the next segment (a close estimate; the
// table in docs/shifts/brief.md R35 came from this method). Read-only against the repo; writes only to _out/.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "tools/probes/_out/start-chunk");
const top = Number((process.argv.find((a) => a.startsWith("--top=")) ?? "--top=25").slice(6));

if (!process.argv.includes("--no-build")) {
  execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir", "--sourcemap", "true"], {
    cwd: join(root, "app"),
    stdio: ["ignore", "ignore", "inherit"],
  });
}

const manifest = JSON.parse(readFileSync(join(out, ".vite/manifest.json"), "utf8"));
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const seen = new Set();
(function walk(k) {
  if (seen.has(k)) return;
  seen.add(k);
  for (const i of manifest[k].imports ?? []) walk(i);
})(entryKey);

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function* segments(mappings) {
  let src = 0;
  for (const line of mappings.split(";")) {
    let col = 0;
    for (const seg of line.split(",")) {
      if (!seg) continue;
      const v = [];
      let n = 0;
      let shift = 0;
      for (const c of seg) {
        const d = B64.indexOf(c);
        n += (d & 31) << shift;
        if (d & 32) shift += 5;
        else {
          v.push(n & 1 ? -(n >> 1) : n >> 1);
          n = 0;
          shift = 0;
        }
      }
      col += v[0];
      if (v.length > 1) src += v[1];
      yield { col, src: v.length > 1 ? src : -1 };
    }
    yield { col: Infinity, src: -2 }; // line end
  }
}

const per = new Map();
let raw = 0;
let gz = 0;
for (const k of seen) {
  const file = join(out, manifest[k].file);
  const code = readFileSync(file, "utf8");
  raw += Buffer.byteLength(code);
  gz += gzipSync(readFileSync(file)).length;
  if (!existsSync(file + ".map")) continue;
  const map = JSON.parse(readFileSync(file + ".map", "utf8"));
  const lines = code.split("\n");
  let line = 0;
  let prev = null;
  const add = (s, bytes) => {
    const name = (map.sources[s] ?? "(unmapped)").replace(/^(\.\.\/)+/, "").replace(/^.*node_modules\//, "node_modules/");
    const pkg = name.startsWith("node_modules/") ? name.split("/").slice(0, name.split("/")[1].startsWith("@") ? 3 : 2).join("/") : name;
    per.set(pkg, (per.get(pkg) ?? 0) + bytes);
  };
  for (const g of segments(map.mappings)) {
    if (g.src === -2) {
      if (prev) add(prev.src, Buffer.byteLength(lines[line].slice(prev.col)) + 1);
      prev = null;
      line++;
      continue;
    }
    if (prev) add(prev.src, Buffer.byteLength(lines[line].slice(prev.col, g.col)));
    prev = g.src >= 0 ? g : null;
  }
}
console.log(`start chunk: ${(raw / 1000).toFixed(2)} kB raw, ${(gz / 1000).toFixed(2)} kB gzip (files summed: ${[...seen].map((k) => manifest[k].file).join(", ")})`);
for (const [name, b] of [...per].sort((a, c) => c[1] - a[1]).slice(0, top)) console.log(`${(b / 1000).toFixed(1).padStart(6)} kB  ${name}`);
