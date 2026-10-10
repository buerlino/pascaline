// SPDX-License-Identifier: GPL-3.0-or-later
// Raw / gzip / brotli sizes of the Pyodide files a "Python+" pack would ship (core + numpy + sympy + mpmath).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "_build", "pyodide");
const lock = JSON.parse(fs.readFileSync(path.join(dir, "pyodide-lock.json"), "utf8")).packages;
const core = ["pyodide.asm.wasm", "pyodide.asm.mjs", "pyodide.mjs", "python_stdlib.zip", "pyodide-lock.json"];
const closure = (n, seen = new Set()) => { if (seen.has(n)) return seen; seen.add(n); lock[n].depends.forEach((d) => closure(d, seen)); return seen; };
const row = (name, f) => {
  const b = fs.readFileSync(path.join(dir, f));
  return { name, raw: b.length, gz: zlib.gzipSync(b, { level: 9 }).length, br: zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
};
const show = (title, rows) => {
  const s = (k) => rows.reduce((a, r) => a + r[k], 0);
  console.log(`${title}: raw ${(s("raw") / 1e6).toFixed(2)} MB, gzip ${(s("gz") / 1e6).toFixed(2)} MB, brotli ${(s("br") / 1e6).toFixed(2)} MB`);
};
const coreRows = core.map((f) => row(f, f));
coreRows.forEach((r) => console.log(" ", r.name, r.raw, r.gz, r.br));
show("core", coreRows);
for (const set of [["numpy"], ["numpy", "sympy"], ["scipy"]]) {
  const names = [...set.reduce((s, n) => closure(n, s), new Set())];
  const rows = names.map((n) => row(n, lock[n].file_name));
  console.log(" ", set.join("+"), "closure:", names.join(","));
  show(`packages ${set.join("+")}`, rows);
}
