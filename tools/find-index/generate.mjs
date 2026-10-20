#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// The Find index (docs/04 section 3.3): one JSON array of FindItem, built from the pinned, SHA-256-checked
// source tarballs and our own files in find/, with constant values, uncertainties and unit factors taken from
// the rows of find/factors.yaml (A21; tools/find-index/refresh-factors.mjs recomputes them from the qalc build).
// Node only, no network. Output (gitignored): app/src/find/_gen/find-index.json.
//
//   node tools/find-index/generate.mjs [--no-units] [--out FILE] [--verbose]
//   (cd app && npm run index)                       # the same, from the app
//
// With --no-units the index holds functions only (a warning).
// Env:
//      PASCALINE_DL_DIR       Giac tarball cache (default engine/giac/_downloads)
//      PASCALINE_QALC_DL_DIR  libqalculate tarball cache (default engine/qalc/_downloads)
//
// Sources: Giac doc/aide_cas, English lines ("2 ...") only, never French (line "1"), entries starting with "_"
// dropped (Giac's own units and constants, P3); libqalculate data/units.xml.in, variables.xml.in (the Physical
// Constants category only), prefixes.xml.in. Currencies, elements, planets and datasets are not read at all.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { gzipSync } from "node:zlib";
import { latexName, unitItems, uniq } from "./units-items.mjs";
import { REPO, SOURCES, fail, member, notes, problems, qalcXml, tarball } from "./state.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined);
const OUT = resolve(opt("--out") ?? join(REPO, "app/src/find/_gen/find-index.json"));
const VERBOSE = flag("--verbose");
const YAML = createRequire(join(REPO, "app/package.json"))("yaml");


// ---------------------------------------------------------------------------------------------- Giac functions

function parseAide(text) {
  const entries = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("# ")) {
      cur = { names: line.slice(2).trim().split(/\s+/), en: undefined, args: undefined, examples: [] };
      entries.push(cur);
    } else if (!cur || line.trim() === "") continue;
    else if (line.startsWith("2 ")) cur.en = line.slice(2).trim(); // English only (R5); line "1" is French
    else if (line.startsWith("0 ")) cur.args = line.slice(2).trim();
    else if (/^[0-9] /.test(line) || /^-\d+ /.test(line)) continue; // other languages, related commands
    else cur.examples.push(line.trim());
  }
  return entries;
}

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
/** A tier-1 line for the list and preview: its first sentence when the line is long (size budget, docs/04 3.3),
 *  else at most 120 characters cut at a word. Giac's full help stays in Giac. */
function shortLine(s) {
  if (!s || s.length <= 100) return s;
  const m = /^.{30,119}?[.;](?=\s+[A-Z(]|$)/.exec(s);
  if (m) return m[0];
  if (s.length <= 120) return s;
  return `${s.slice(0, 119).replace(/\s+\S*$/, "")}…`;
}
const opInsert = (n) => `\\operatorname{${latexName(n)}}\\left(#?\\right)`;

/** An English line that says the entry is not a function one calls: an option, a pseudo-variable, a program
 *  instruction or a reserved word (`lp_integer`, `Digits`, `for`, `then`). */
const NOT_A_FUNCTION = /^(Options? (of|for|that|to)\b|Global option|Pseudo-variable|Reserved word|Instruction in a program|In a program,|Used in an? |Loop:|Test:)/;

function giacFunctions(aide, curated, exclude, notes) {
  const all = parseAide(aide);
  const excluded = new Set(Object.values(exclude ?? {}).flat());
  let dropped = 0;
  const skipped = { underscore: 0, notFunction: 0, excluded: 0, noName: 0 };
  const entries = [];
  for (const e of all) {
    if (e.names[0].startsWith("_")) { dropped++; skipped.underscore++; continue; } // Giac's own units and constants (P3)
    if (NOT_A_FUNCTION.test(e.en ?? "") || /^DOM_/.test(e.names[0])) { dropped++; skipped.notFunction++; continue; }
    if (e.names.some((n) => excluded.has(n))) { dropped++; skipped.excluded++; continue; }
    const names = e.names.filter((n) => IDENT.test(n));
    // all-capital spellings of another name (LN, SIN, ASIN): the same command, only noise in the list
    const keep = names.filter((n) => !(n === n.toUpperCase() && /[A-Z]/.test(n) && names.some((m) => m !== n && m.toUpperCase() === n)));
    if (!keep.length) { dropped++; skipped.noName++; continue; }
    entries.push({ ...e, names: keep });
  }
  const byName = new Map();
  for (const e of entries) for (const n of e.names) if (!byName.has(n)) byName.set(n, e);

  const items = new Map();
  const replaced = new Set();
  for (const f of curated) {
    const e = byName.get(f.giac);
    if (f.id.startsWith("fn:") && e) replaced.add(e);
    const names = [];
    if (f.id.startsWith("fn:")) {
      names.push(f.giac);
      if (e) names.push(...e.names.filter((n) => !(f.drop ?? []).includes(n)));
    }
    names.push(...(f.names ?? []));
    const syntax = f.syntax ?? (e?.args ? `${f.giac}(${e.args})` : undefined);
    items.set(f.id, {
      id: f.id, kind: f.id.startsWith("tmpl:") ? "tmpl" : "fn", names: uniq(names), title: f.title, desc: f.desc,
      syntax, example: e?.examples[0], tier: 0, insert: f.insert ?? opInsert(f.giac),
    });
  }
  for (const e of entries) {
    if (replaced.has(e)) continue;
    const id = `fn:${e.names[0]}`;
    if (items.has(id)) continue;
    items.set(id, {
      // tier 1 is "documented only": name and English line; syntax and example stay in Giac's help (size budget).
      // No insert: it is always \operatorname{name}\left(#?\right), which prepare() in app/src/find/rank.ts fills in
      // (about 70 kB of the 400 kB raw budget, decisions.md G4 item 1).
      id, kind: "fn", names: e.names, title: e.names[0], desc: shortLine(e.en), tier: 1,
    });
  }
  for (const n of excluded) if (!byName.has(n) && !all.some((e) => e.names.includes(n))) fail(`find/functions.yaml exclude: no Giac command ${n}`);
  // G67: our line for the commands that change the engine's state on purpose
  for (const [n, desc] of Object.entries(notes ?? {})) {
    const it = items.get(`fn:${n}`);
    if (!it) fail(`find/functions.yaml notes: no Find item fn:${n}`);
    else it.desc = desc;
  }
  return { items: [...items.values()], entries: all.length, dropped, skipped };
}


// ---------------------------------------------------------------------------------------------- main

const loadYaml = (rel) => YAML.parse(readFileSync(join(REPO, rel), "utf8")) ?? {};
const fnFile = loadYaml("find/functions.yaml");
const curated = fnFile.functions ?? [];
const aliases = loadYaml("find/aliases.yaml");
const ours = loadYaml("find/units.yaml");

// golden case ids (tests/golden/*.yaml), for the tier-0 functions
const goldenIds = new Set();
for (const f of readdirSync(join(REPO, "tests/golden")).filter((x) => x.endsWith(".yaml"))) {
  for (const m of readFileSync(join(REPO, "tests/golden", f), "utf8").matchAll(/\bid: "([^"]+)"/g)) goldenIds.add(m[1]);
}
for (const f of curated) {
  if (!f.id || !f.giac || !f.title || !f.desc) fail(`find/functions.yaml: ${f.id ?? "?"} needs id, giac, title, desc`);
  if (!f.golden || !goldenIds.has(f.golden)) fail(`find/functions.yaml ${f.id}: golden case "${f.golden}" not found in tests/golden/`);
}

const t0 = performance.now();
const giacTar = tarball(SOURCES.giac);
const fns = giacFunctions(member(giacTar, "giac-2.1.0/doc/aide_cas"), curated, fnFile.exclude, fnFile.notes);
let items = [...fns.items];
let qstats = null;

let withUnits = !flag("--no-units");
if (withUnits) {
  // names and titles from libqalculate's XML (the pinned tarball, no build); the numbers from find/factors.yaml (A21)
  const f = loadYaml("find/factors.yaml");
  const factors = { prefixes: f.prefixes ?? {}, units: f.units ?? {}, consts: f.constants ?? {} };
  const r = await unitItems({ factors, xml: qalcXml(), ours, aliases });
  items.push(...r.items);
  qstats = r.stats;
} else {
  console.warn("find-index: WARNING: --no-units: the index holds functions only; constants, units and prefixes are missing");
}

// our aliases: what users type and the data lacks, per item id
const byId = new Map(items.map((it) => [it.id, it]));
for (const [id, names] of Object.entries(aliases.aliases ?? {})) {
  const it = byId.get(id);
  if (!it) { if (withUnits || id.startsWith("fn:") || id.startsWith("tmpl:")) fail(`find/aliases.yaml: no item ${id}`); continue; }
  it.names = uniq([...it.names, ...names.map(String)]);
}

// checks over the whole index
for (const it of items) {
  if (/^(unit|const|pfx):/.test(it.id) && /currency|^unit:(EUR|USD|GBP|JPY|CHF|BTC)\b/i.test(`${it.id} ${it.title}`)) fail(`currency in the index: ${it.id}`);
  if (it.kind === "const" && !/^const:[A-Za-z0-9_]+$/.test(it.id)) fail(`const id outside [A-Za-z0-9_]: ${it.id}`);
  for (const k of Object.keys(it)) if (it[k] === undefined) delete it[k];
}
if (new Set(items.map((i) => i.id)).size !== items.length) fail("duplicate ids");

// field order of the schema (docs/04 3.3)
const ORDER = ["id", "kind", "names", "title", "desc", "syntax", "example", "value", "unc", "unit", "dim", "si", "tier", "insert"];
items = items.map((it) => Object.fromEntries(ORDER.filter((k) => it[k] !== undefined).map((k) => [k, it[k]])));

if (problems.length) {
  console.error(`find-index: ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
const json = JSON.stringify(items);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, json);
const count = (k) => items.filter((i) => i.kind === k).length;
const gz = gzipSync(Buffer.from(json), { level: 9 }).length;
console.log(`find-index: ${items.length} items (fn ${count("fn")} [tier 0: ${items.filter((i) => i.kind === "fn" && i.tier === 0).length}], tmpl ${count("tmpl")}, ` +
  `const ${count("const")}, unit ${count("unit")}, pfx ${count("pfx")}) -> ${OUT}`);
console.log(`find-index: ${json.length} bytes raw, ${gz} bytes gzip, ${(performance.now() - t0).toFixed(0)} ms` +
  ` (aide_cas: ${fns.entries} entries, ${fns.dropped} left out: ${Object.entries(fns.skipped).map(([k, v]) => `${v} ${k}`).join(", ")})`);
if (qstats) {
  console.log(`find-index: qalc: ${qstats.units} units (${qstats.composites} composites), ${qstats.prefixes} prefixes, ${qstats.consts} constants; ` +
    `${qstats.unitsSkipped.length} units and ${qstats.constsSkipped.length} constants skipped, ${qstats.noSi.length} units without si, ${qstats.siChecked} values checked against definitions, ${qstats.overrides.length} overridden`);
  if (VERBOSE) {
    console.log(`  units skipped: ${qstats.unitsSkipped.join(", ")}`);
    console.log(`  constants skipped: ${qstats.constsSkipped.join(", ")}`);
    console.log(`  no si: ${qstats.noSi.join(", ")}`);
  }
}
if (notes.length) console.log(`find-index: ${notes.length} note(s)${VERBOSE ? `:\n  ${notes.join("\n  ")}` : " (--verbose lists them)"}`);
