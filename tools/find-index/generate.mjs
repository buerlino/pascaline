#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// The Find index (docs/04 section 3.3): one JSON array of FindItem, built from the pinned, SHA-256-checked
// source tarballs and our own files in find/, with constant values, uncertainties and unit factors taken from
// the qalc build run in Node. Every unit, prefix and constant id is checked to parse back to itself in qalc.
// Node only, no network. Output (gitignored): app/src/find/_gen/find-index.json.
//
//   node tools/find-index/generate.mjs [--no-units] [--out FILE] [--verbose]
//   (cd app && npm run index)                       # the same, from the app
//
// Env: QALC_OUT        the qalc build (qalc.mjs + qalc.wasm; default engine/qalc/_out/dev). Without one, or with
//                      --no-units, the index holds functions only (a warning; build.sh passes --no-units with its own).
//      PASCALINE_DL_DIR       Giac tarball cache (default engine/giac/_downloads)
//      PASCALINE_QALC_DL_DIR  libqalculate tarball cache (default engine/qalc/_downloads)
//
// Sources: Giac doc/aide_cas, English lines ("2 ...") only, never French (line "1"), entries starting with "_"
// dropped (Giac's own units and constants, P3); libqalculate data/units.xml.in, variables.xml.in (the Physical
// Constants category only), prefixes.xml.in. Currencies, elements, planets and datasets are not read at all.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined);
const OUT = resolve(opt("--out") ?? join(REPO, "app/src/find/_gen/find-index.json"));
const VERBOSE = flag("--verbose");
const YAML = createRequire(join(REPO, "app/package.json"))("yaml");

const SOURCES = {
  giac: {
    file: "giac-2.1.0.tar.gz",
    sha256: "1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67",
    dir: process.env.PASCALINE_DL_DIR ?? join(REPO, "engine/giac/_downloads"),
  },
  qalc: {
    file: "libqalculate-5.13.1.tar.gz",
    sha256: "cf8d3eaf3d85030115701e997b6585e69573e71add88e7758486c5d1b01d3cc3",
    dir: process.env.PASCALINE_QALC_DL_DIR ?? join(REPO, "engine/qalc/_downloads"),
  },
};

const problems = []; // fatal: printed together at the end
const notes = []; // printed with --verbose, counted always
const fail = (m) => problems.push(m);

// ---------------------------------------------------------------------------------------------- sources

function tarball(src) {
  const path = join(src.dir, src.file);
  if (!existsSync(path)) throw new Error(`missing ${path} (set ${src === SOURCES.giac ? "PASCALINE_DL_DIR" : "PASCALINE_QALC_DL_DIR"})`);
  const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (sha !== src.sha256) throw new Error(`SHA-256 mismatch: ${path}`);
  return path;
}

function member(path, name) {
  return execFileSync("tar", ["-xzOf", path, name], { maxBuffer: 64 << 20 }).toString("utf8");
}

/** A minimal XML reader for qalc's data files: elements, attributes, text, comments; no DTD, no CDATA. */
function parseXml(text) {
  const root = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  for (const m of text.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.text += decodeXml(m[5]); continue; }
    if (!m[2]) continue;
    if (m[1]) {
      if (top.tag !== m[2]) throw new Error(`XML: </${m[2]}> closes <${top.tag}>`);
      stack.pop();
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = decodeXml(a[2]);
    const el = { tag: m[2], attrs, children: [], text: "" };
    top.children.push(el);
    if (!m[4]) stack.push(el);
  }
  if (stack.length !== 1) throw new Error("XML: unclosed elements");
  return root;
}
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e]);
}
const child = (el, tag) => el.children.find((c) => c.tag === tag);
const childText = (el, tag) => child(el, tag)?.text.trim();

/** qalc's names attribute: "ar:c,speed_of_light,p:meters" -> [{name, flags}] (a abbreviation, r reference, p plural,
 *  u unicode, i avoid input, o completion only, c case-sensitive, s suffix; "-x" negates x). */
function qalcNames(text) {
  return (text ?? "").split(",").map((part) => {
    const k = part.indexOf(":");
    const raw = k >= 0 ? part.slice(0, k) : "";
    const flags = new Set();
    for (let i = 0; i < raw.length; i++) if (raw[i] === "-") i++; else flags.add(raw[i]);
    return { name: part.slice(k + 1).trim(), flags };
  }).filter((n) => n.name);
}

// ---------------------------------------------------------------------------------------------- exact numbers

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
function frac(n, d = 1n) {
  if (d === 0n) throw new Error("division by zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const fmul = (a, b) => frac(a.n * b.n, a.d * b.d);
const fdiv = (a, b) => frac(a.n * b.d, a.d * b.n);
const fsub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const feq = (a, b) => a.n === b.n && a.d === b.d;
const pow10 = (k) => 10n ** BigInt(k);
const fpow = (a, e) => (e >= 0 ? frac(a.n ** BigInt(e), a.d ** BigInt(e)) : frac(a.d ** BigInt(-e), a.n ** BigInt(-e)));
const ftext = (a) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

/** A decimal string ("6.62607015E-34", "0.000123") as an exact fraction. */
function decFrac(s) {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s.trim());
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new Error(`not a decimal: ${s}`);
  const digits = BigInt(`${m[2]}${m[3] ?? ""}` || "0") * (m[1] === "-" ? -1n : 1n);
  const exp = Number(m[4] ?? 0) - (m[3] ?? "").length;
  return exp >= 0 ? frac(digits * pow10(exp)) : frac(digits, pow10(-exp));
}

/** A terminating fraction as plain decimal text in E notation ("6.62607015E-34", "299792458"), else null. */
function terminatingText(a) {
  let d = a.d, k = 0;
  while (d % 10n === 0n) { d /= 10n; k++; }
  while (d % 2n === 0n) { d /= 2n; k++; }
  while (d % 5n === 0n) { d /= 5n; k++; }
  if (d !== 1n) return null;
  const n = (a.n * pow10(k)) / a.d; // a = n / 10^k exactly
  return sciText(n, -k);
}

/** m * 10^e as "d.ddd" or "d.dddE±k" (plain for 1e-4 <= |x| < 1e12, like our formatter). */
function sciText(m, e) {
  if (m === 0n) return "0";
  const sign = m < 0n ? "-" : "";
  let digits = (m < 0n ? -m : m).toString();
  while (digits.length > 1 && digits.endsWith("0")) { digits = digits.slice(0, -1); e++; }
  const lead = digits.length - 1 + e; // exponent of the leading digit
  if (lead >= -4 && lead < 12) {
    if (e >= 0) return sign + digits + "0".repeat(e);
    const point = digits.length + e;
    return sign + (point > 0 ? `${digits.slice(0, point)}.${digits.slice(point)}` : `0.${"0".repeat(-point)}${digits}`);
  }
  return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}E${lead}`;
}

/** value ± unc, CODATA style: unc to 2 significant digits, the value rounded to the same decimal place, keeping its
 *  trailing zeros ("6.67430E-11", "1.5E-15"). Both are exact fractions. Rounding: half away from zero. */
function roundWithUnc(value, unc) {
  // place = exponent of the second significant digit of unc (10^lead <= unc < 10^(lead+1))
  const atLeast = (x, k) => (k >= 0 ? x.n >= x.d * pow10(k) : x.n * pow10(-k) >= x.d);
  let lead = 0;
  while (atLeast(unc, lead + 1)) lead++;
  while (!atLeast(unc, lead)) lead--;
  const place = lead - 1;
  const round = (x) => { // x / 10^place, rounded half away from zero, as BigInt
    const num = place >= 0 ? x.n : x.n * pow10(-place);
    const den = place >= 0 ? x.d * pow10(place) : x.d;
    const q = num / den, r = num % den;
    const twice = 2n * (r < 0n ? -r : r);
    return twice >= den ? q + (num < 0n ? -1n : 1n) : q;
  };
  return { value: fixedSci(round(value), place), unc: fixedSci(round(unc), place) };
}
/** m * 10^e keeping every digit of m (trailing zeros are significant): "6.67430E-11". */
function fixedSci(m, e) {
  const sign = m < 0n ? "-" : "";
  const digits = (m < 0n ? -m : m).toString();
  const lead = digits.length - 1 + e;
  if (lead >= -4 && lead < 12 && e <= 0) {
    const point = digits.length + e;
    return sign + (point > 0 ? `${digits.slice(0, point)}${e < 0 ? "." : ""}${digits.slice(point)}` : `0.${"0".repeat(-point)}${digits}`);
  }
  if (lead >= -4 && lead < 12) return sign + digits + "0".repeat(e);
  return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}E${lead}`;
}

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
const latexName = (n) => n.replace(/_/g, "\\_");
const opInsert = (n) => `\\operatorname{${latexName(n)}}\\left(#?\\right)`;

/** An English line that says the entry is not a function one calls: an option, a pseudo-variable, a program
 *  instruction or a reserved word (`lp_integer`, `Digits`, `for`, `then`). */
const NOT_A_FUNCTION = /^(Options? (of|for|that|to)\b|Global option|Pseudo-variable|Reserved word|Instruction in a program|In a program,|Used in an? |Loop:|Test:)/;

function giacFunctions(aide, curated, exclude) {
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
  return { items: [...items.values()], entries: all.length, dropped, skipped };
}

// ---------------------------------------------------------------------------------------------- qalc

async function loadQalc(dir) {
  const factory = (await import(pathToFileURL(join(dir, "qalc.mjs")).href)).default;
  const m = await factory();
  if (!m._qalc_init()) throw new Error("qalc_init failed");
  if (typeof m._qalc_eval !== "function") throw new Error(`${dir}: qalc build without the tool calls (qalc_eval); rebuild it`);
  m._qalc_set_precision(40);
  const p = m.cwrap("qalc_parse", "string", ["string"]);
  const pr = m.cwrap("qalc_print", "string", ["string"]);
  const ev = m.cwrap("qalc_eval", "string", ["string", "number"]);
  return { parse: (s) => JSON.parse(p(s)), print: (s) => pr(s), eval: (s, f) => JSON.parse(ev(s, f)) };
}

/** Flatten a parsed tree into unit leaves [{u, pfx, e}]; null when anything else (a symbol, a variable, a sum) occurs. */
function leaves(t, e = 1, out = []) {
  if (t.t === "unit") { out.push({ u: t.u, pfx: t.pfx ?? "", e }); return out; }
  if (t.t === "mul") { for (const c of t.c) if (!leaves(c, e, out)) return null; return out; }
  if (t.t === "inv") return leaves(t.c[0], -e, out);
  if (t.t === "div") return leaves(t.c[0], e, out) && leaves(t.c[1], -e, out);
  if (t.t === "pow" && t.c[1].t === "num" && t.c[1].q === "1") return leaves(t.c[0], e * Number(t.c[1].p), out);
  return null;
}
const leafKey = (ls) => ls.map((l) => `${l.pfx}|${l.u}|${l.e}`).sort().join(" ");

const SI_ORDER = ["m", "kg", "s", "A", "K", "mol", "cd", "rad"];
/** The base units a dimension key may hold: SI's (qalc's mass base is g), the plane angle, and qalc's bit and Np. */
const BASE_DIMS = new Set(["m", "g", "s", "A", "K", "mol", "cd", "rad", "bit", "Np"]);
/** A value in SI base units from qalc_eval(.., 2|1?) -> {coef (fraction) | dec/unc, piPow, dims} or null if not a
 *  number times base units (a log unit, a function, or a unit qalc keeps as its own base because its factor is
 *  uncertain or approximate: solar_mass, cal_fifteen). qalc's base mass unit is g: converted to kg here. */
function siOf(tree) {
  const r = { coef: frac(1n), dec: null, piPow: 0, dims: new Map(), complex: false };
  const addDim = (u, e) => r.dims.set(u, (r.dims.get(u) ?? 0) + e);
  const walk = (t, e) => {
    if (t.t === "num") {
      if (t.complex) return false;
      if (t.p !== undefined) { r.coef = fmul(r.coef, fpow(frac(BigInt(t.p), BigInt(t.q)), e)); return true; }
      if (e !== 1 || r.dec) return false;
      r.dec = { value: decFrac(t.dec), unc: t.unc ? decFrac(t.unc) : frac(0n) };
      return true;
    }
    if (t.t === "var" && t.v === "pi") { r.piPow += e; return true; }
    if (t.t === "unit") { if (t.pfx) return false; addDim(t.u, e); return true; }
    if (t.t === "pow" && t.c[1].t === "num" && t.c[1].q === "1") return walk(t.c[0], e * Number(t.c[1].p));
    if (t.t === "mul") {
      // qalc writes a plane angle as the unsimplified m*m^-1: a "rad" component of the dimension (docs/04 4.3)
      const ls = leaves(t);
      if (ls && ls.length && ls.every((l) => !l.pfx) && dimsCancel(ls) && t.c.every((c) => c.t !== "num")) { addDim("rad", e); return true; }
      return t.c.every((c) => walk(c, e));
    }
    if (t.t === "inv") return walk(t.c[0], -e);
    return false;
  };
  if (!walk(tree, 1)) return null;
  if ([...r.dims.keys()].some((u) => !BASE_DIMS.has(u))) return null;
  const g = r.dims.get("g");
  if (g) { // V g^e = V 1000^-e kg^e
    r.dims.delete("g");
    r.dims.set("kg", g);
    const k = fpow(frac(1000n), -g);
    r.coef = fmul(r.coef, k);
  }
  if (r.dec) { r.dec.value = fmul(r.dec.value, r.coef); r.dec.unc = fmul(r.dec.unc, r.coef); r.coef = null; }
  for (const [u, e] of r.dims) if (e === 0) r.dims.delete(u);
  return r;
}
function dimsCancel(ls) {
  const m = new Map();
  for (const l of ls) m.set(l.u, (m.get(l.u) ?? 0) + l.e);
  return [...m.values()].every((e) => e === 0);
}
const dimKey = (dims) => [...dims].sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()) || a[0].localeCompare(b[0])).map(([u, e]) => `${u}${e}`).join("");
function unitText(dims) {
  const order = (u) => (SI_ORDER.indexOf(u) + 1 || 99);
  return [...dims].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0])).map(([u, e]) => (e === 1 ? u : `${u}^${e}`)).join("*");
}
/** Exact factor text: "p/q", "p/q*pi", "p/q*pi^(-1)". */
function exactText(coef, piPow, asFraction = false) {
  if (!piPow) return asFraction ? ftext(coef) : terminatingText(coef) ?? ftext(coef);
  // with pi, Giac text with integers only (Giac reads a literal 3.3E-34 as a float)
  const int = (x) => { let k = 0; let y = x; while (y > 1n && y % 10n === 0n) { y /= 10n; k++; } return y === 1n && k > 3 ? `10^${k}` : `${x}`; };
  const num = coef.n === 1n && piPow > 0 ? "" : `${int(coef.n)}`;
  const piText = `pi${Math.abs(piPow) === 1 ? "" : `^${Math.abs(piPow)}`}`;
  if (piPow > 0) return `${num ? `${num}*` : ""}${piText}${coef.d === 1n ? "" : `/${int(coef.d)}`}`;
  return `${num}/${coef.d === 1n ? piText : `(${int(coef.d)}*${piText})`}`;
}

const GREEK = { α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\varepsilon", θ: "\\theta", λ: "\\lambda", μ: "\\mu", µ: "\\mu",
  ν: "\\nu", π: "\\pi", ρ: "\\rho", σ: "\\sigma", τ: "\\tau", φ: "\\varphi", Φ: "\\Phi", ω: "\\omega", Ω: "\\Omega", ℏ: "\\hbar", "∞": "\\infty" };
/** A constant's symbol ("k_B", "ε_0", "R_∞") as LaTeX: italic letter, upright subscript of letters. */
function symbolLatex(sym) {
  const [base, sub] = sym.split(/_(.*)/s);
  const conv = (s) => [...s].map((ch) => GREEK[ch] ? `${GREEK[ch]} ` : ch).join("").trim();
  if (!sub) return conv(base);
  const subL = /^[A-Za-z]+$/.test(sub) ? `\\mathrm{${sub}}` : conv(sub);
  return `${conv(base)}_{${subL}}`;
}
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** A unit's printed form ("km ∕ h", "m²", "°C") as upright LaTeX. */
function unitLatex(printed) {
  let s = printed.replace(/^1 /, "").replace(/\s*∕\s*/g, "/").replace(/\s*⋅\s*/g, "\\cdot ").replace(/\s+/g, "\\,");
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^{${[...m].map((c) => SUP[c]).join("")}}`);
  s = s.replace(/\^(-?\d+)/g, "^{$1}");
  s = s.replace(/\(([^()]*)\)/g, "\\left($1\\right)");
  return `\\mathrm{${s}}`;
}

/** Units, prefixes and physical constants from libqalculate's data files, checked and valued by the qalc build. */
async function qalcItems(q, xml, ours, aliases) {
  const items = [];
  const stats = { units: 0, unitsSkipped: [], composites: 0, prefixes: 0, consts: 0, constsSkipped: [], noSi: [], siChecked: 0 };

  // --- prefixes
  const pfxBySym = new Map(); // ascii symbol -> {decimal exponent | binary exponent}
  const pfxDec = new Map(), pfxBin = new Map(); // exponent -> ascii symbol
  for (const el of parseXml(xml.prefixes).children[0].children.filter((c) => c.tag === "prefix")) {
    const names = qalcNames(childText(el, "names"));
    const exp = Number(childText(el, "exponent"));
    const binary = el.attrs.type === "binary";
    const ascii = names.find((n) => n.flags.has("a") && !n.flags.has("u"))?.name;
    const uni = names.find((n) => n.flags.has("a") && n.flags.has("u") && n.flags.has("o"))?.name // µ (micro sign) first
      ?? names.find((n) => n.flags.has("a") && n.flags.has("u"))?.name;
    const long = names.find((n) => !n.flags.has("a"))?.name;
    if (!ascii || !long) { fail(`prefix without names: ${childText(el, "names")}`); continue; }
    (binary ? pfxBin : pfxDec).set(exp, ascii);
    pfxBySym.set(ascii, { binary, exp, long });
    // round trip: the prefix on a unit that takes it
    const probe = binary ? `${ascii}bit` : `${ascii}m`;
    const ls = leaves(q.parse(probe));
    const want = q.parse(binary ? "bit" : "m").u;
    if (!ls || ls.length !== 1 || ls[0].u !== want || ls[0].pfx !== ascii) { fail(`prefix ${ascii}: ${probe} does not parse back`); continue; }
    const shown = uni ?? ascii;
    const si = binary ? `${2n ** BigInt(exp)}` : (exp >= 0 ? `${pow10(exp)}` : `1/${pow10(-exp)}`);
    items.push({
      id: `pfx:${ascii}`, kind: "pfx", names: uniq([long, ascii, ...names.map((n) => n.name)]),
      title: `${cap(long)} (${binary ? `2^${exp}` : `10^${exp}`})`, si, tier: 0, insert: `\\pfx{${ascii}}{\\mathrm{${shown}}}`,
    });
    stats.prefixes++;
  }

  // --- units: base and alias first (their ids name the parts of composites), then composites
  const defs = [];
  const walkCats = (el, cat) => {
    for (const c of el.children) {
      if (c.tag === "category") walkCats(c, childText(c, "title")?.replace(/^!units!/, "") ?? cat);
      else if (c.tag === "unit" && c.attrs.type) defs.push({ el: c, cat });
    }
  };
  walkCats(parseXml(xml.units).children[0], "");
  const byRef = new Map(); // qalc reference name -> def
  for (const d of defs) {
    d.names = qalcNames(childText(d.el, "names"));
    d.ref = d.names.find((n) => n.flags.has("r"))?.name ?? d.names[0]?.name;
    d.title = childText(d.el, "title");
    d.hidden = !!child(d.el, "hidden");
    d.type = d.el.attrs.type;
    byRef.set(d.ref, d);
  }
  const unitId = new Map(); // ref -> chosen id text
  for (const d of defs.filter((x) => x.type !== "composite")) {
    if (d.hidden) { stats.unitsSkipped.push(`${d.ref} (hidden)`); continue; }
    const cands = [
      ...d.names.filter((n) => n.flags.has("a") && !n.flags.has("u") && !n.flags.has("i")),
      ...d.names.filter((n) => n.flags.has("r") && !n.flags.has("u")),
      ...d.names.filter((n) => !n.flags.has("u") && !n.flags.has("i") && !n.flags.has("p")),
    ].map((n) => n.name).filter((n) => /^[A-Za-z][A-Za-z0-9_]*$/.test(n));
    const id = cands.find((c) => { const t = q.parse(c); return t.t === "unit" && t.u === d.ref && !t.pfx; });
    if (!id) { stats.unitsSkipped.push(`${d.ref} (no name parses back)`); continue; }
    unitId.set(d.ref, id);
  }
  const compositeText = (d, seen = new Set()) => {
    if (seen.has(d.ref)) return null;
    seen.add(d.ref);
    const num = [], den = [], expect = [];
    for (const p of d.el.children.filter((c) => c.tag === "part")) {
      const ref = childText(p, "unit");
      const pe = child(p, "prefix");
      const e = Number(childText(p, "exponent") ?? 1);
      let pfx = "";
      if (pe && Number(pe.text) !== 0) pfx = (pe.attrs.type === "binary" ? pfxBin : pfxDec).get(Number(pe.text)) ?? null;
      if (pfx === null) return null;
      let name = unitId.get(ref);
      if (!name) {
        const sub = byRef.get(ref);
        if (!sub || sub.type !== "composite" || pfx) return null;
        const inner = compositeText(sub, seen);
        if (!inner || inner.expect.length !== 1 || inner.expect[0].e !== 1) return null;
        expect.push({ ...inner.expect[0], e });
        (e > 0 ? num : den).push(`${inner.text}${Math.abs(e) === 1 ? "" : `^${Math.abs(e)}`}`);
        continue;
      }
      expect.push({ u: ref, pfx, e });
      (e > 0 ? num : den).push(`${pfx}${name}${Math.abs(e) === 1 ? "" : `^${Math.abs(e)}`}`);
    }
    if (!num.length) return null;
    const text = num.join("*") + (den.length === 0 ? "" : den.length === 1 ? `/${den[0]}` : `/(${den.join("*")})`);
    return { text, expect };
  };

  const rename = ours.ids ?? {};
  const unitDefs = [];
  for (const d of defs) {
    if (d.hidden) { if (d.type === "composite") stats.unitsSkipped.push(`${d.ref} (hidden)`); continue; }
    let id, expect;
    if (d.type === "composite") {
      const c = compositeText(d);
      if (!c) { stats.unitsSkipped.push(`${d.ref} (composite of units without an id)`); continue; }
      id = rename[c.text] ?? c.text;
      expect = c.expect;
      stats.composites++;
    } else {
      id = unitId.get(d.ref);
      if (!id) continue;
      expect = [{ u: d.ref, pfx: "", e: 1 }];
    }
    const nl = d.names.filter((n) => !n.flags.has("i")).map((n) => n.name).filter((n) => d.type !== "composite");
    unitDefs.push({ id, expect, names: nl, title: d.title, cat: d.cat, nonlinear: hasNonlinear(d), def: d });
  }
  // our prefixed and compound units (find/units.yaml)
  for (const u of ours.units ?? []) {
    const expect = parseParts(u.parts, pfxBySym);
    if (!expect) { fail(`find/units.yaml ${u.id}: bad parts "${u.parts}"`); continue; }
    unitDefs.push({ id: u.id, expect, names: u.names ?? [], title: u.title ?? autoTitle(expect, byRef, pfxBySym), cat: "ours", nonlinear: false, ours: true });
  }
  function hasNonlinear(d) {
    const b = child(d.el, "base");
    if (b && child(b, "inverse_relation")) return true;
    const ref = b ? childText(b, "unit") : undefined;
    return ref && byRef.get(ref) && byRef.get(ref) !== d ? hasNonlinear(byRef.get(ref)) : false;
  }

  const seenIds = new Map();
  for (const u of unitDefs) {
    const where = u.ours ? `find/units.yaml ${u.id}` : `qalc unit ${u.def.ref}`;
    if (seenIds.has(u.id)) {
      const prev = seenIds.get(u.id);
      if (u.ours) { prev.names = uniq([...prev.names, ...u.names]); continue; }
      notes.push(`${where}: id ${u.id} taken by an earlier unit, skipped`);
      stats.unitsSkipped.push(`${u.def.ref} (same id as another unit: ${u.id})`);
      continue;
    }
    // round trip: the id parses to exactly the expected unit leaves
    const ls = leaves(q.parse(u.id));
    if (!ls || leafKey(ls) !== leafKey(u.expect)) {
      const msg = `${where}: id "${u.id}" parses to ${JSON.stringify(q.parse(u.id))}`;
      if (u.ours) fail(msg); else { notes.push(msg); stats.unitsSkipped.push(`${u.def?.ref} (id does not parse back)`); }
      continue;
    }
    const printed = q.print(u.id).replace(/μ/g, "µ"); // the micro sign, as on keyboards and in the SI brochure
    const symbol = printed.replace(/^1 /, "").replace(/\s*∕\s*/g, "/").replace(/\s*⋅\s*/g, "·");
    let names = uniq([u.id, symbol, ...u.names]);
    names = uniq(names.flatMap((n) => (/[µμ]/.test(n) ? [n.replace(/μ/g, "µ"), n.replace(/µ/g, "μ")] : [n])));
    names = names.filter((n) => !names.some((m) => m !== n && m.length >= 3 && (n === `${m}s` || n === `${m}es`)));
    const item = { id: `unit:${u.id}`, kind: "unit", names, title: u.title, tier: 0, insert: "" };
    // the SI factor and dimension
    let si = null;
    const ex = q.eval(u.id, 2);
    let base = siOf(ex.tree);
    if (base && base.dec) { const exact = siOf(q.eval(u.id, 3).tree); if (exact && !exact.dec) base = exact; }
    if (base) item.dim = dimKey(base.dims);
    if (u.nonlinear) {
      // °C, °F: affine (factor and offset, from f(0) and f(1)); dB, Np, dBm: logarithmic, no factor
      const f0 = siOf(q.eval(`0 ${u.id}`, 2).tree), f1 = siOf(q.eval(`1 ${u.id}`, 2).tree), f2 = siOf(q.eval(`2 ${u.id}`, 2).tree);
      if (f0?.coef && f1?.coef && f2?.coef && !f0.piPow && !f1.piPow && dimKey(f1.dims) === "K1") {
        const k = fsub(f1.coef, f0.coef);
        if (feq(fsub(f2.coef, f1.coef), k)) { si = `${ftext(k)}+${ftext(f0.coef)}`; item.dim = "K1"; }
      }
      if (!si) stats.noSi.push(`${u.id} (logarithmic)`);
    } else if (base && !base.dec) si = exactText(base.coef, base.piPow, true);
    else stats.noSi.push(`${u.id} (${base ? "no exact factor: a measured constant or a logarithm" : "does not convert to SI base units in qalc"})`);
    // our audit against exact definitions (find/units.yaml checks)
    const check = ours.checks?.[item.id];
    if (check !== undefined) {
      stats.siChecked++;
      const want = evalProduct(check.si);
      const got = base && !base.dec && !base.piPow ? base.coef : null;
      const same = !!got && feq(got, want);
      if (!same && check.known) {
        // a known qalc data error (check.known says where it is tracked): no factor rather than a wrong one
        notes.push(`${item.id}: qalc's factor ${si} differs from the definition ${check.si} (${check.known}); si left out`);
        stats.noSi.push(`${u.id} (qalc's factor differs from its definition: ${check.known})`);
        si = null;
      } else if (!same) fail(`${item.id}: qalc's factor ${si} differs from the definition ${check.si}`);
      else if (check.known) fail(`${item.id}: matches its definition now; remove "known" from find/units.yaml checks`);
    }
    if (si !== null) item.si = si;
    item.insert = `\\unit{${u.id}}{${unitLatex(printed)}}`;
    if (!u.ours && /\b(Planck|Atomic|Natural Unit|Electronvolt (Distance|Mass|Time|Temperature|Momentum)|Solar|Bohr|Hartree|Rydberg)\b/.test(u.title ?? "")) item.tier = 1;
    seenIds.set(u.id, item);
    items.push(item);
    stats.units++;
  }

  // --- physical constants
  const walkVars = (el, path, out) => {
    for (const c of el.children) {
      if (c.tag === "category") walkVars(c, [...path, childText(c, "title")], out);
      else if (c.tag === "variable" || c.tag === "builtin_variable") out.push({ el: c, path });
    }
    return out;
  };
  const vars = walkVars(parseXml(xml.variables).children[0], [], []);
  const skipCats = new Set(ours.constants?.skipCategories ?? []);
  for (const v of vars) {
    if (v.path[0] !== "Physical Constants") continue;
    if (skipCats.has(v.path[1])) continue;
    if (child(v.el, "hidden")) continue;
    const names = qalcNames(childText(v.el, "names"));
    const ref = names.find((n) => n.flags.has("r"))?.name ?? names[0].name;
    const title = childText(v.el, "title");
    // the id: the shortest ASCII abbreviation that parses back to this constant, else the reference name
    const ascii = names.filter((n) => /^[A-Za-z][A-Za-z0-9_]*$/.test(n.name) && !n.flags.has("i") && !n.flags.has("p"));
    const cands = [...ascii.filter((n) => n.flags.has("a")).sort((a, b) => a.name.length - b.name.length), ...ascii.filter((n) => !n.flags.has("a"))].map((n) => n.name);
    const back = (c) => { const t = q.parse(c); return t.t === "var" && t.v === ref; };
    const id = cands.find(back);
    if (!id) { stats.constsSkipped.push(`${ref} (no name parses back)`); continue; }
    let r = siOf(q.eval(id, 3).tree);
    let exact = !!(r && !r.dec);
    if (!exact) r = siOf(q.eval(id, 2).tree);
    if (!r) { stats.constsSkipped.push(`${id} (not a number times base units)`); continue; }
    const item = { id: `const:${id}`, kind: "const", names: uniq([id, ...names.filter((n) => !n.flags.has("i")).map((n) => n.name)]), title, tier: 0, insert: "" };
    if (exact) item.value = exactText(r.coef, r.piPow);
    else {
      const rel = r.dec.value.n === 0n ? frac(0n) : fdiv(r.dec.unc, r.dec.value);
      if (rel.n * 10n ** 30n < (rel.d < 0n ? -rel.d : rel.d) && rel.n >= 0n) {
        // an interval only from rounding (an irrational without an exact form qalc can give: lambertw)
        stats.constsSkipped.push(`${id} (irrational without an exact form)`);
        continue;
      }
      const { value, unc } = roundWithUnc(r.dec.value, r.dec.unc);
      item.value = value;
      item.unc = unc;
    }
    if (r.dims.size) item.unit = unitText(r.dims);
    item.dim = dimKey(r.dims);
    const sym = aliases.symbols?.[item.id] ?? symbolOf(names);
    item.insert = `\\const{${id}}{${sym ? symbolLatex(sym) : `\\mathrm{${latexName(id)}}`}}`;
    if (sym && sym !== id) item.names.push(sym);
    // the unit text parses in qalc to the same dimension
    if (item.unit) {
      const back2 = siOf(q.eval(item.unit, 2).tree);
      if (!back2 || dimKey(back2.dims) !== item.dim) fail(`const ${id}: unit text ${item.unit} does not parse back to ${item.dim}`);
    }
    const check = ours.checks?.[item.id];
    if (check !== undefined) {
      stats.siChecked++;
      if (!exact || !feq(r.piPow ? frac(0n) : r.coef, evalProduct(check.value))) fail(`${item.id}: qalc gives ${item.value}, the definition ${check.value}`);
    }
    items.push(item);
    stats.consts++;
  }
  return { items, stats };
}

/** A constant's symbol: qalc's Unicode abbreviation (ε_0, ℏ), else its ASCII one (G, k_B); null when it has none. */
function symbolOf(names) {
  const abbr = (u) => names.find((n) => n.flags.has("a") && n.flags.has("u") === u && !n.flags.has("o") && !n.flags.has("i"))?.name;
  return abbr(true) ?? abbr(false) ?? null;
}

/** "k:m h^-1" -> [{pfx:"k", u:"m", e:1}, {pfx:"", u:"h", e:-1}] (u: qalc reference names). */
function parseParts(text, pfxBySym) {
  const out = [];
  for (const tok of String(text ?? "").trim().split(/\s+/)) {
    const m = /^(?:([A-Za-z]+):)?([A-Za-z_]+)(?:\^(-?\d+))?$/.exec(tok);
    if (!m || (m[1] && !pfxBySym.has(m[1]))) return null;
    out.push({ pfx: m[1] ?? "", u: m[2], e: Number(m[3] ?? 1) });
  }
  return out.length ? out : null;
}
function autoTitle(expect, byRef, pfxBySym) {
  if (expect.length !== 1 || expect[0].e !== 1) return expect.map((l) => l.pfx + l.u).join("·");
  const t = byRef.get(expect[0].u)?.title ?? expect[0].u;
  return expect[0].pfx ? `${cap(pfxBySym.get(expect[0].pfx).long)}${t.toLowerCase()}` : t;
}
/** "550*0.3048*0.45359237*9.80665" or "1/3600": a product and quotient of decimals, exactly. */
function evalProduct(s) {
  let r = frac(1n);
  const parts = String(s).split(/([*/])/);
  let op = "*";
  for (const p of parts) {
    if (p === "*" || p === "/") { op = p; continue; }
    const v = decFrac(p);
    r = op === "*" ? fmul(r, v) : fdiv(r, v);
  }
  return r;
}

const uniq = (a) => [...new Set(a.filter((x) => x !== undefined && x !== ""))];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
const fns = giacFunctions(member(giacTar, "giac-2.1.0/doc/aide_cas"), curated, fnFile.exclude);
let items = [...fns.items];
let qstats = null;

const qalcDir = resolve(process.env.QALC_OUT ?? join(REPO, "engine/qalc/_out/dev"));
let withUnits = !flag("--no-units");
if (withUnits && !existsSync(join(qalcDir, "qalc.mjs"))) {
  if (process.env.QALC_OUT) throw new Error(`QALC_OUT=${qalcDir}: no qalc.mjs`);
  withUnits = false;
}
if (withUnits) {
  const qtar = tarball(SOURCES.qalc);
  const xml = Object.fromEntries(["units", "variables", "prefixes"].map((n) => [n, member(qtar, `libqalculate-5.13.1/data/${n}.xml.in`)]));
  const q = await loadQalc(qalcDir);
  const r = await qalcItems(q, xml, ours, aliases);
  items.push(...r.items);
  qstats = r.stats;
} else {
  console.warn("find-index: WARNING: no qalc build (or --no-units): the index holds functions only; constants, units and prefixes are missing");
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
    `${qstats.unitsSkipped.length} units and ${qstats.constsSkipped.length} constants skipped, ${qstats.noSi.length} units without si, ${qstats.siChecked} values checked against definitions`);
  if (VERBOSE) {
    console.log(`  units skipped: ${qstats.unitsSkipped.join(", ")}`);
    console.log(`  constants skipped: ${qstats.constsSkipped.join(", ")}`);
    console.log(`  no si: ${qstats.noSi.join(", ")}`);
  }
}
if (notes.length) console.log(`find-index: ${notes.length} note(s)${VERBOSE ? `:\n  ${notes.join("\n  ")}` : " (--verbose lists them)"}`);
