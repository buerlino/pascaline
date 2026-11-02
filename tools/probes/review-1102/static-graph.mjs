// SPDX-License-Identifier: GPL-3.0-or-later
// ca probe (night review 2026-11-02): the static import graph of app/src from main.ts, from SOURCE (no build).
//   node static-graph.mjs <app dir> [--top=N] [--why=<rel path>]
// Prints: files statically reachable from src/main.ts with source bytes, and for each file the source bytes that
// would leave the start graph if that file alone were imported dynamically (its dominated set). Source bytes are
// not minified bytes: an estimate only (minified ≈ 0.4–0.6 × source for TS with comments; gzip ≈ 0.3 × minified).
// Excluded: `import type`, `export type`, dynamic import(), specifiers with only `type` names.
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

const app = resolve(process.argv[2]);
const top = Number((process.argv.find((a) => a.startsWith("--top=")) ?? "--top=40").slice(6));
const why = (process.argv.find((a) => a.startsWith("--why=")) ?? "").slice(6);
const entry = join(app, (process.argv.find((a) => a.startsWith("--entry=")) ?? "--entry=src/main.ts").slice(8));
const exts = ["", ".ts", ".js", ".mjs", ".svelte", "/index.ts", ".svelte.ts"];

function resolveSpec(from, spec) {
  let base;
  if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else if (spec.startsWith("$spec/") || spec.startsWith("@spec/")) base = resolve(app, "..", "spec", spec.slice(6));
  else return null; // a package
  for (const e of exts) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return "MISSING:" + base;
}

function scriptOf(file, text) {
  if (!file.endsWith(".svelte")) return text;
  return [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
}

function staticImports(file) {
  const text = scriptOf(file, readFileSync(file, "utf8"));
  const out = [];
  const re = /^\s*(import|export)\s+([^"';]*?)\s*from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
  for (const m of text.matchAll(re)) {
    if (m[4]) { out.push(m[4]); continue; }
    const clause = m[2];
    if (/^type\b/.test(clause)) continue;
    const braces = clause.match(/\{([\s\S]*)\}/);
    const outside = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
    if (braces && !outside) {
      const names = braces[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length && names.every((n) => n.startsWith("type "))) continue;
    }
    out.push(m[3]);
  }
  return out;
}

const graph = new Map();
const pkgs = new Map();
const missing = [];
(function walk(f) {
  if (graph.has(f)) return;
  const deps = [];
  graph.set(f, deps);
  for (const s of staticImports(f)) {
    const r = resolveSpec(f, s);
    if (r === null) { pkgs.set(s, (pkgs.get(s) ?? new Set()).add(relative(app, f))); continue; }
    if (r.startsWith("MISSING:")) { missing.push(`${relative(app, f)} -> ${s}`); continue; }
    deps.push(r);
    walk(r);
  }
})(entry);

const size = (f) => statSync(f).size;
function reach(skip) {
  const seen = new Set();
  const st = [entry];
  while (st.length) {
    const f = st.pop();
    if (f === skip || seen.has(f)) continue;
    seen.add(f);
    for (const d of graph.get(f)) st.push(d);
  }
  return seen;
}
const all = reach(null);
const total = [...all].reduce((a, f) => a + size(f), 0);
console.log(`files statically reachable from ${relative(app, entry)}: ${all.size}, source bytes ${total}`);
console.log(`packages: ${[...pkgs.keys()].join(", ")}`);
if (missing.length) console.log(`unresolved: ${missing.join("; ")}`);
const rows = [];
for (const f of all) {
  if (f === entry) continue;
  const r = reach(f);
  const gone = [...all].filter((x) => !r.has(x));
  rows.push({ f: relative(app, f), own: size(f), saved: gone.reduce((a, x) => a + size(x), 0), n: gone.length });
}
rows.sort((a, b) => b.saved - a.saved);
console.log("saved-if-lazy(src B)  own(src B)  files  file");
for (const r of rows.slice(0, top)) console.log(`${String(r.saved).padStart(10)}  ${String(r.own).padStart(10)}  ${String(r.n).padStart(5)}  ${r.f}`);
if (why) {
  const target = join(app, why);
  const importers = [...all].filter((f) => graph.get(f).includes(target)).map((f) => relative(app, f));
  console.log(`importers of ${why}: ${importers.join(", ")}`);
}
if (process.argv.includes("--cycles")) {
  // runtime import cycles (type-only imports excluded), each printed once from its smallest member
  const seen = new Set();
  const cycles = new Set();
  const stack = [];
  const on = new Set();
  (function dfs(f) {
    stack.push(f);
    on.add(f);
    for (const d of graph.get(f) ?? []) {
      if (on.has(d)) {
        const c = stack.slice(stack.indexOf(d)).map((x) => relative(app, x));
        const i = c.indexOf([...c].sort()[0]);
        cycles.add([...c.slice(i), ...c.slice(0, i)].join(" -> "));
      } else if (!seen.has(d)) dfs(d);
    }
    stack.pop();
    on.delete(f);
    seen.add(f);
  })(entry);
  console.log(`runtime cycles: ${cycles.size}`);
  for (const c of cycles) console.log(`  ${c}`);
}
