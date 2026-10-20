// SPDX-License-Identifier: GPL-3.0-or-later
// Units, prefixes and physical constants of the Find index (docs/04 3.3). Two sources for the numbers:
//   factors (find/factors.yaml, read by generate.mjs): no qalc build needed; names and titles come from libqalculate's XML.
//   q (the qalc build run in Node, refresh-factors.mjs only): computes the same rows from qalc, for the refresh diff.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { notes, fail } from "./state.mjs";
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
export const ftext = (a) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

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

// ---------------------------------------------------------------------------------------------- qalc

export async function loadQalc(dir) {
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

export const latexName = (n) => n.replace(/_/g, "\\_");
/** A dimension key ("kg1m2s-3") back to its base units and exponents. */
const dimsOf = (key) => new Map([...key.matchAll(/([A-Za-z]+?)(-?\d+)/g)].map((m) => [m[1], Number(m[2])]));
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
export async function unitItems({ q, factors, xml, ours, aliases }) {
  // q: the qalc build (refresh-factors.mjs): raw numbers, no checks, `rows` recorded. factors: find/factors.yaml (generate.mjs).
  const rows = { prefixes: {}, units: {}, consts: {} };
  const F = q ? null : factors;
  const items = [];
  const stats = { units: 0, unitsSkipped: [], composites: 0, prefixes: 0, consts: 0, constsSkipped: [], noSi: [], overrides: [], siChecked: 0 };

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
    // round trip: the prefix on a unit that takes it (qalc only; the factors file lists the prefixes that passed)
    if (q) {
      const probe = binary ? `${ascii}bit` : `${ascii}m`;
      const ls = leaves(q.parse(probe));
      const want = q.parse(binary ? "bit" : "m").u;
      if (!ls || ls.length !== 1 || ls[0].u !== want || ls[0].pfx !== ascii) { fail(`prefix ${ascii}: ${probe} does not parse back`); continue; }
    } else if (!F.prefixes?.[ascii]) continue;
    const shown = uni ?? ascii;
    const si = binary ? `${2n ** BigInt(exp)}` : (exp >= 0 ? `${pow10(exp)}` : `1/${pow10(-exp)}`);
    if (F && F.prefixes[ascii].si !== si) fail(`find/factors.yaml prefixes ${ascii}: si ${F.prefixes[ascii].si}, the exponent gives ${si}`);
    rows.prefixes[ascii] = { si };
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
    const id = cands.find((c) => { if (!q) return F.units?.[c] !== undefined; const t = q.parse(c); return t.t === "unit" && t.u === d.ref && !t.pfx; });
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
    unitDefs.push({ id: u.id, text: u.text, symbol: u.symbol, expect, names: u.names ?? [], title: u.title ?? autoTitle(expect, byRef, pfxBySym), cat: "ours", nonlinear: false, ours: true });
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
    // round trip: the id parses to exactly the expected unit leaves (qalc only; the factors file lists the ids that passed)
    const qt = u.text ?? u.id; // the qalc text, where the id itself does not parse (kip, fbm)
    const row = F ? F.units?.[u.id] : null;
    if (F && !row) {
      const msg = `${where}: not in find/factors.yaml`;
      if (u.ours) fail(msg); else { notes.push(msg); stats.unitsSkipped.push(`${u.def?.ref} (id does not parse back)`); }
      continue;
    }
    if (q) {
      const ls = leaves(q.parse(qt));
      if (!ls || leafKey(ls) !== leafKey(u.expect)) {
        const msg = `${where}: ${u.text ? "text" : "id"} "${qt}" parses to ${JSON.stringify(q.parse(qt))}`;
        if (u.ours) fail(msg); else { notes.push(msg); stats.unitsSkipped.push(`${u.def?.ref} (id does not parse back)`); }
        continue;
      }
    }
    const printed = (u.symbol ?? (q ? q.print(qt) : row.sym)).replace(/μ/g, "µ"); // the micro sign, as on keyboards and in the SI brochure
    const symbol = printed.replace(/^1 /, "").replace(/\s*∕\s*/g, "/").replace(/\s*⋅\s*/g, "·");
    let names = uniq([u.id, symbol, ...u.names]);
    names = uniq(names.flatMap((n) => (/[µμ]/.test(n) ? [n.replace(/μ/g, "µ"), n.replace(/µ/g, "μ")] : [n])));
    names = names.filter((n) => !names.some((m) => m !== n && m.length >= 3 && (n === `${m}s` || n === `${m}es`)));
    const item = { id: `unit:${u.id}`, kind: "unit", names, title: u.title, tier: 0, insert: "" };
    // the SI factor and dimension
    let si = null;
    if (F) {
      si = row.si ?? null;
      if (row.dim !== undefined) item.dim = row.dim;
      if (si === null) stats.noSi.push(`${u.id} (no factor in find/factors.yaml)`);
      // our audit against exact definitions (find/units.yaml checks): the row must equal the definition
      const check = ours.checks?.[item.id];
      if (check !== undefined) {
        stats.siChecked++;
        if (si !== ftext(evalProduct(check.si))) fail(`${item.id}: find/factors.yaml gives ${si}, the definition ${check.si}`);
      }
    } else {
      const ex = q.eval(qt, 2);
      let base = siOf(ex.tree);
      if (base && base.dec) { const exact = siOf(q.eval(qt, 3).tree); if (exact && !exact.dec) base = exact; }
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
      rows.units[u.id] = { si: si ?? undefined, dim: item.dim, sym: u.symbol ? undefined : printed };
    }
    if (si !== null) item.si = si;
    item.insert = `\\unit{${u.id}}{${unitLatex(printed)}}`;
    if (!u.ours && /\b(Planck|Atomic|Natural Unit|Electronvolt (Distance|Mass|Time|Temperature|Momentum)|Solar|Bohr|Hartree|Rydberg)\b/.test(u.title ?? "")) item.tier = 1;
    seenIds.set(u.id, item);
    items.push(item);
    stats.units++;
  }

  // --- units qalc lacks or has differently (find/units.yaml `defined`): exact `si` and `dim` from the definition.
  // `replace` takes the place of qalc's unit of that id; `dropNames` takes names off another item (rev off tr).
  for (const d of ours.defined ?? []) {
    if (!d.id || d.si === undefined || d.dim === undefined || !d.title || !d.source) { fail(`find/units.yaml defined ${d.id ?? "?"}: needs id, title, si, dim, source`); continue; }
    const at = items.findIndex((i) => i.id === `unit:${d.id}`);
    if (at >= 0 && !d.replace) { fail(`find/units.yaml defined ${d.id}: qalc has this unit; say "replace: true" to take its place`); continue; }
    if (at < 0 && d.replace) { fail(`find/units.yaml defined ${d.id}: replace: true, but qalc has no such unit`); continue; }
    try { frac(evalProduct(d.si).n); } catch { fail(`find/units.yaml defined ${d.id}: bad si "${d.si}"`); continue; }
    const item = { id: `unit:${d.id}`, kind: "unit", names: uniq([d.id, ...(d.names ?? [])]), title: d.title, dim: d.dim, si: ftext(evalProduct(d.si)), tier: 0, insert: `\\unit{${d.id}}{\\mathrm{${d.symbol ?? d.id}}}` };
    if (at >= 0) { notes.push(`unit:${d.id}: qalc's ${items[at].si} (${items[at].dim}) replaced by ours ${item.si} (${d.source})`); items[at] = item; } else items.push(item);
    stats.siChecked++;
  }
  for (const [id, names] of Object.entries(ours.dropNames ?? {})) {
    const it = items.find((i) => i.id === id);
    if (!it) fail(`find/units.yaml dropNames: no item ${id}`); else it.names = it.names.filter((n) => !names.includes(n));
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
    const back = (c) => { if (!q) return F.consts?.[c] !== undefined; const t = q.parse(c); return t.t === "var" && t.v === ref; };
    const id = cands.find(back);
    if (!id) { stats.constsSkipped.push(`${ref} (no name parses back)`); continue; }
    const sym = aliases.symbols?.[`const:${id}`] ?? symbolOf(names);
    const row = F ? F.consts[id] : null;
    const item = { id: `const:${id}`, kind: "const", names: uniq([id, ...names.filter((n) => !n.flags.has("i")).map((n) => n.name)]), title, tier: 0, insert: "" };
    if (F) {
      item.value = row.value;
      if (row.unc !== undefined) item.unc = row.unc;
      item.dim = row.dim;
      if (row.dim) item.unit = unitText(dimsOf(row.dim));
      // our audit against the definitions and CODATA 2022 (find/units.yaml checks): the row must equal them
      const check = ours.checks?.[item.id];
      if (check !== undefined) {
        stats.siChecked++;
        const same = feq(evalProduct(row.value), evalProduct(check.value)) && (check.unc === undefined || (row.unc !== undefined && feq(decFrac(row.unc), decFrac(check.unc))));
        if (!same) fail(`${item.id}: find/factors.yaml gives ${row.value}${row.unc ? ` ± ${row.unc}` : ""}, the definition ${check.value}${check.unc ? ` ± ${check.unc}` : ""}`);
      }
    } else {
      let r = siOf(q.eval(id, 3).tree);
      const exact = !!(r && !r.dec);
      if (!exact) r = siOf(q.eval(id, 2).tree);
      if (!r) { stats.constsSkipped.push(`${id} (not a number times base units)`); continue; }
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
      // the unit text parses in qalc to the same dimension
      if (item.unit) {
        const back2 = siOf(q.eval(item.unit, 2).tree);
        if (!back2 || dimKey(back2.dims) !== item.dim) fail(`const ${id}: unit text ${item.unit} does not parse back to ${item.dim}`);
      }
      rows.consts[id] = { value: item.value, unc: item.unc, dim: item.dim };
    }
    item.insert = `\\const{${id}}{${sym ? symbolLatex(sym) : `\\mathrm{${latexName(id)}}`}}`;
    if (sym && sym !== id) item.names.push(sym);
    items.push(item);
    stats.consts++;
  }
  // --- constants of ours (find/units.yaml constants.define): exact value, unit text parsed by qalc for the dimension
  for (const [id, c] of Object.entries(ours.constants?.define ?? {})) {
    if (items.some((i) => i.id === `const:${id}`)) { fail(`find/units.yaml constants.define ${id}: qalc has this constant`); continue; }
    const r = q ? siOf(q.eval(c.unit, 2).tree) : { dims: dimsOf(F.consts?.[id]?.dim ?? ""), coef: frac(1n) };
    if (!c.value || !c.title || !c.source || !r || r.dec || r.piPow || !feq(r.coef, frac(1n))) { fail(`find/units.yaml constants.define ${id}: needs value, title, source and a unit of SI base units`); continue; }
    const check = ours.checks?.[`const:${id}`];
    if (!check || !feq(decFrac(check.value), decFrac(c.value))) { fail(`find/units.yaml constants.define ${id}: a checks entry with the same value is required`); continue; }
    stats.siChecked++;
    if (F && F.consts?.[id]?.value !== c.value) fail(`find/factors.yaml constants ${id}: value ${F.consts?.[id]?.value}, find/units.yaml ${c.value}`);
    rows.consts[id] = { value: c.value, dim: dimKey(r.dims) };
    const sym = aliases.symbols?.[`const:${id}`];
    items.push({ id: `const:${id}`, kind: "const", names: uniq([id, ...(c.names ?? [])]), title: c.title, value: c.value, unit: unitText(r.dims), dim: dimKey(r.dims), tier: 0,
      insert: `\\const{${id}}{${sym ? symbolLatex(sym) : `\\mathrm{${latexName(id)}}`}}` });
    stats.consts++;
  }
  return { items, stats, rows };
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
export function evalProduct(s) {
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

export const uniq = (a) => [...new Set(a.filter((x) => x !== undefined && x !== ""))];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
