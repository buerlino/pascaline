// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G85, structured bridge spike; docs/research/structure-hindsight.md 2.1): today's text readers against the
// bridge (engine/giac/wasm/api.cc: giac_ctx_get/set, giac_parse, giac_value), on two engines fed the same inputs.
// Inputs: every home.yaml and precision.yaml case (its `input`, its `latex` through our parser, a sequence's last step;
// its `before` first), and text-1 … text-10 (tools/probes/text-misses.ts). Fields, each today's way against the bridge:
//   reads    names the input reads: the host's (stateRead.ts readsFrom of giac_parse since G99) | giac_parse reads
//   targets  names it stores: the host's top-level targets ∪ storeTargets() | giac_parse targets
//   stateful isStateful() | targets, or a purge/assume/additionally head
//   float    hasFloat(input) | giac_parse float
//   kind     read from the printed value (isError, rationalValue, shapeOf, hasFloat) | giac_value kind
//   text     the print of pasans:=(input) | giac_value text
//   P, P+20  valueParts(pasans) at the case's digits P and P + 20 | giac_value at[P], at[P+20]
//   ctx      after the case, on the bridge's engine: FLAGS_READ (G67's read, kept here) decoded field by field | giac_ctx_get
//   state    after the case: FLAGS_READ on today's engine | on the bridge's (the two paths leave the same settings)
// Before each case both engines get the host's settings back (giac_ctx_set of hostContext, as the host does, G102).
//   GIAC_OUT=<dir> node tools/probes/bridge.ts            # every case; mismatches listed by field, totals at the end
//   … bridge.ts --calls   # call-trace.ts's seven inputs: today's calls, each marked kept / bridge-n / dropped, and timings
//   … bridge.ts --cost    # each bridge call against the call it replaces (medians of 7), and giac_parse over 200 programs
//   … bridge.ts --readers # the host's readers each bridge call would delete: lines and regex lines (glue-growth.mjs's
//                           pattern), from the TypeScript source (no engine needed)
// Stops at "no bridge exports" on an engine built without them. Read-only; no network.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { EngineHost, type GiacApi } from "../../app/src/engine/host.ts";
import { NO_BRIDGE, type GiacBridge, type GiacValue } from "../../app/src/engine/bridge.ts";
import { angleCommand, defaultHomeSettings, ENGINE_DEFINITIONS, pasdegCommand } from "../../app/src/engine/homeEval.ts";
import { formOf, mayStore } from "../../app/src/engine/stores.ts";
import { isOurStore } from "../../app/src/engine/ourNames.ts";
import { hasFloat, MAX_ITEMS, rationalValue, shortDigits, splitList, topLevelArgs, type Giac, type Shape } from "../../app/src/engine/numeric.ts";
import { readsFrom } from "../../app/src/engine/stateRead.ts";
import { hostContext } from "../../app/src/engine/flags.ts";
import { decimalFromString, decimalToString, type DecimalValue } from "../../app/src/engine/format.ts";
import { latexToGiac } from "../../app/src/input/latex-to-giac.ts";

// G103 deleted the text readers from the app (Home reads bridge-3 alone); the probe keeps phase-1's (9e07920) shapeOf
// and valueParts with their helpers, as "today's way" was, so its comparison still runs.
function hasTopLevelComma(t: string): boolean {
  let depth = 0;
  for (const ch of t) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

function shapeOf(text: string): Shape | null {
  const t = text.trim();
  if (!t.startsWith("[") && !t.startsWith("list[")) {
    // A sequence (`1,2`), a set or a vector with another prefix is not a number we format.
    return /^\w+\[/.test(t) || hasTopLevelComma(t) ? null : { kind: "scalar" };
  }
  const els = splitList(t);
  if (!els || els.length === 0 || els.length > MAX_ITEMS) return null;
  const rows = els.map(splitList);
  if (rows.every((r) => r === null)) return { kind: "list", n: els.length };
  if (t.startsWith("list[")) return null;
  const cols = rows[0]?.length ?? 0;
  if (cols === 0 || rows.some((r) => r === null || r.length !== cols || r.some((x) => splitList(x) !== null))) return null;
  if (els.length * cols > MAX_ITEMS) return null;
  return { kind: "matrix", rows: els.length, cols };
}

function flatten(text: string, shape: Shape): string[] | null {
  if (shape.kind === "scalar") return [text.trim()];
  const els = splitList(text);
  if (!els) return null;
  if (shape.kind === "list") return els.length === shape.n ? els : null;
  if (els.length !== shape.rows) return null;
  const out: string[] = [];
  for (const e of els) {
    const r = splitList(e);
    if (!r || r.length !== shape.cols) return null;
    out.push(...r);
  }
  return out;
}

function anyValue(text: string, keep: number): DecimalValue | null {
  const t = text.trim();
  // `0.-000…`: Giac's print of a negative zero part (asin(2*i) at 40 digits).
  return rationalValue(t, keep)?.v ?? decimalFromString(t.replace(/^-?0\.-?0*$/, "0"), keep);
}

function valueParts(
  giac: Giac,
  text: string,
  shape: Shape,
  prec: number,
  keep: number,
  restore?: number,
): { re: DecimalValue; im: DecimalValue; short?: number }[] | null {
  const read = `(pasz->[re(pasz),im(pasz)])(evalf(${text},${prec}))`;
  let out = restore === undefined ? giac.eval(read) : giac.eval(`Digits:=${prec};${read};Digits:=${restore}`);
  if (restore !== undefined) {
    // The three results print as `prec,[re,im],restore`; on an error Digits may not be set back.
    const all = isError(out) ? [] : topLevelArgs(out);
    if (all.length !== 3) giac.eval(`Digits:=${restore}`);
    out = all.length === 3 ? all[1]! : "GIAC_ERROR";
  }
  const two = isError(out) ? null : splitList(out);
  return two && two.length === 2 ? partsOf(two[0]!, two[1]!, shape, keep, prec) : null;
}

function partsOf(reT: string, imT: string, shape: Shape, keep: number, asked: number): { re: DecimalValue; im: DecimalValue; short?: number }[] | null {
  if (isError(reT) || isError(imT)) return null;
  const re = flatten(reT, shape);
  const im = flatten(imT, shape);
  if (!re || !im || re.length !== im.length) return null;
  const out: { re: DecimalValue; im: DecimalValue; short?: number }[] = [];
  for (let k = 0; k < re.length; k++) {
    const a = anyValue(re[k]!, keep);
    const b = anyValue(im[k]!, keep);
    if (!a || !b) return null;
    // `asked`: the MPFR digits this print was asked for; a part printed as a double confirms fewer (shortDigits).
    const short = [shortDigits(re[k]!, asked), shortDigits(im[k]!, asked)].filter((n): n is number => n !== undefined);
    out.push(short.length ? { re: a, im: b, short: Math.min(...short) } : { re: a, im: b });
  }
  return out;
}

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { parse: yaml } = require("yaml") as { parse: (s: string) => unknown };
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

const A = await loadNodeGiac(); // today's way
const B = await loadNodeGiac(); // the bridge
const bridge: GiacBridge = B.bridge;
try {
  bridge.ctxGet();
} catch (e) {
  if (String(e).includes(NO_BRIDGE)) {
    console.log(`${NO_BRIDGE}: this engine (${process.env.GIAC_OUT ?? "default"}) was built without them; build engine/giac/build-wasm.sh on the G85 branch`);
    process.exit(1);
  }
  throw e;
}
for (const g of [A.giac, B.giac]) for (const d of Object.values(ENGINE_DEFINITIONS)) g.eval(d);

interface Case {
  id: string;
  text: string;
  before: string[];
  digits: number;
  angle: "rad" | "deg";
}
interface YamlCase {
  id: string;
  input?: string;
  latex?: string;
  steps?: { input?: string; latex?: string; angle?: "rad" | "deg" }[];
  before?: string[];
  beforeHome?: string[];
  beforeCas?: string[];
  settings?: { digits?: number; angle?: "rad" | "deg" };
}
const giacOf = (c: { input?: string; latex?: string }): string | null => {
  if (c.input !== undefined) return c.input;
  if (c.latex === undefined) return null;
  try {
    return latexToGiac(c.latex);
  } catch {
    return null;
  }
};
function cases(): Case[] {
  const out: Case[] = [];
  for (const f of ["home.yaml", "precision.yaml"]) {
    const all = (yaml(readFileSync(new URL(`../../tests/golden/${f}`, import.meta.url), "utf8")) as { cases: YamlCase[] }).cases;
    for (const c of all) {
      const steps = c.steps ?? [];
      const last = steps.length ? steps[steps.length - 1]! : c;
      const text = giacOf(last);
      if (text === null) continue;
      const before = [...(c.before ?? c.beforeHome ?? c.beforeCas ?? []), ...steps.slice(0, -1).map((s) => giacOf(s) ?? "0")];
      out.push({ id: c.id, text, before, digits: c.settings?.digits ?? 12, angle: (steps.length ? steps[steps.length - 1]!.angle : undefined) ?? c.settings?.angle ?? "rad" });
    }
  }
  const t = (id: string, text: string, before: string[] = []): Case => ({ id, text, before, digits: 12, angle: "rad" });
  out.push(
    t("text-1", "approx(sin(10^30),2*10)"),
    t("text-2", "floor((2^-(1/2)+3^-(1/2))^2-5/6-2*6^-(1/2)+1)"),
    t("text-3", "evalf((tanh)(1+i))"),
    t("text-4", "seq(k^2,k=1..3)"),
    t("text-5", "a+=1", ["a:=1"]),
    t("text-6", '"1.123456789012345678"'),
    t("text-7", "subst(t^2,t=x)-2"),
    t("text-8", "f(x):={ approx_mode(1); x }"),
    t("text-9", 'f(x):={ local s; s:="a\\"b:=1"; x }'),
    t("text-10", "int(B^2,B,0,1)", ["B:=evalf(sqrt(2),5)"]),
  );
  return out;
}

// --- today's readers ------------------------------------------------------------------------------------------------
const isError = (s: string): boolean => s.startsWith("GIAC_ERROR");
/** The kind today's readers give a printed value (isError, novalue.ts's words, rationalValue, shapeOf, hasFloat). */
function todayKind(out: string): string {
  const t = out.trim();
  if (isError(t)) return "error";
  if (/\bundef\b/.test(t)) return "undef";
  if (/infinity/.test(t)) return "infinity";
  if (t === "true" || t === "false") return "boolean";
  if (t.startsWith('"')) return "string";
  const r = rationalValue(t);
  if (r) return r.q === 1n ? "integer" : "rational";
  const sh = shapeOf(t);
  if (sh?.kind === "list") return "list";
  if (sh?.kind === "matrix") return "matrix";
  if (sh?.kind === "scalar" && hasFloat(t) && decimalFromString(t)) return "float";
  // a complex number: digits, signs, a point or exponent, and i as the only letter
  if (sh?.kind === "scalar" && /\bi\b/.test(t) && /^[-+*/^()0-9.\s]*$/.test(t.replace(/e[+-]?\d+/g, "").replace(/\bi\b/g, ""))) return "complex";
  return "symbolic";
}
const bridgeKind = (v: GiacValue): string => (v.kind === "sequence" || v.kind === "set" ? "symbolic" : v.kind);
const num = (s: string): string => {
  const r = rationalValue(s, 60);
  const d = r?.v ?? decimalFromString(s.trim().replace(/^-?0\.-?0*$/, "0"), 60);
  return d ? decimalToString(d) : `?${s}`;
};
const set = (xs: readonly string[]): string => [...new Set(xs)].sort().join(",");
const userNames = (g: GiacApi): Set<string> => new Set(splitList(g.eval("VARS()")) ?? []);

/** G67's settings read (flags.ts before G102, which moved the host to bridge-1): kept here for the ctx comparison. */
const FLAGS_READ = "[cas_setup(),integer_format(),xcas_mode(),python_compat(),calc_mode(),keep_algext(),parse_e(),convert_rootof(),step_infolevel(),eval_level(),prog_eval_level(),autosimplify(),auto_assume(),ntl_on()]";

/** FLAGS_READ's print as bridge-1's fields (flags.ts: cas_setup() = [approx_mode, complex_variables, complex_mode,
 *  angle_radian, scientific_format + 16·integer_format, [epsilon, proba_epsilon], Digits, [threads, recursion, debug,
 *  a level that is not the context's eval_level], increasing_power, with_sqrt, all_trig_solutions, integer_mode], then
 *  the getters in their order; eval_level() is the context's). */
function ctxToday(g: GiacApi): Record<string, string> | null {
  const top = splitList(g.eval(FLAGS_READ));
  const cs = top && splitList(top[0]!);
  const eps = cs && splitList(cs[5]!);
  if (!top || top.length !== 14 || !cs || cs.length !== 12 || !eps) return null;
  const n = (x: string): string => String(Number(Number(x).toPrecision(12)));
  return {
    approx_mode: cs[0]!, complex_variables: cs[1]!, complex_mode: cs[2]!, angle_radian: cs[3]!, "scientific_format+16*integer_format": cs[4]!,
    epsilon: n(eps[0]!), proba_epsilon: n(eps[1]!), decimal_digits: cs[6]!, eval_level: top[9]!, increasing_power: cs[8]!, withsqrt: cs[9]!,
    all_trig_sol: cs[10]!, integer_mode: cs[11]!, integer_format: top[1]!, xcas_mode: top[2]!, python_compat: top[3]!, calc_mode: top[4]!,
    keep_algext: top[5]!, parse_e: top[6]!, convert_rootof: top[7]!, step_infolevel: top[8]!, prog_eval_level: top[10]!,
    autosimplify: top[11]!.replace(/^'(.*)'$/, "$1"), auto_assume: top[12]!, ntl_on: top[13]!,
  };
}
function ctxBridge(): Record<string, string> {
  const c = bridge.ctxGet() as unknown as Record<string, number | boolean | string>;
  const v = (k: string): string => (typeof c[k] === "boolean" ? (c[k] ? "1" : "0") : String(c[k]));
  const n = (k: string): string => String(Number(Number(c[k]).toPrecision(12)));
  const out: Record<string, string> = {};
  for (const k of ["approx_mode", "complex_variables", "complex_mode", "angle_radian", "decimal_digits", "eval_level", "increasing_power", "withsqrt", "all_trig_sol", "integer_mode", "integer_format", "xcas_mode", "python_compat", "calc_mode", "keep_algext", "parse_e", "convert_rootof", "step_infolevel", "prog_eval_level", "autosimplify", "auto_assume", "ntl_on"]) out[k] = v(k);
  out.epsilon = n("epsilon");
  out.proba_epsilon = n("proba_epsilon");
  // Giac keeps autosimplify as typed: a fresh engine holds regroup, a set of 'regroup' (G67's restore, G102's) holds
  // 'regroup'; FLAGS_READ prints both as 'regroup' (no effect seen on results, G85 report). Compared without the quotes.
  out.autosimplify = out.autosimplify!.replace(/^'(.*)'$/, "$1");
  out["scientific_format+16*integer_format"] = String(Number(c.scientific_format) + 16 * Number(c.integer_format));
  return out;
}
const diffCtx = (a: Record<string, string> | null, b: Record<string, string>): [string, string] => {
  if (!a) return ["unreadable", ""];
  const ks = Object.keys(b).filter((k) => a[k] !== b[k]);
  return [ks.map((k) => `${k}=${a[k]}`).join(" "), ks.map((k) => `${k}=${b[k]}`).join(" ")];
};

const fields = ["reads", "targets", "stateful", "float", "kind", "text", "P", "P+20", "ctx", "state"] as const;
type Field = (typeof fields)[number];
const mism: Record<Field, string[]> = Object.fromEntries(fields.map((f) => [f, []])) as unknown as Record<Field, string[]>;
const compared: Record<Field, number> = Object.fromEntries(fields.map((f) => [f, 0])) as unknown as Record<Field, number>;
const note = (f: Field, c: Case, today: string, br: string): void => {
  compared[f]++;
  if (today !== br) mism[f].push(`${c.id} ${JSON.stringify(c.text).slice(0, 90)}: today ${today.slice(0, 120)} | bridge ${br.slice(0, 120)}`);
};

function runCase(c: Case): void {
  for (const L of [A, B]) {
    const g = L.giac;
    L.bridge.ctxSet(hostContext(c.digits));
    g.eval(angleCommand(c.angle));
    g.eval(pasdegCommand(c.angle));
    g.eval(`Digits:=${c.digits}`);
    for (const b of c.before) g.eval(b);
  }
  const names0 = userNames(A.giac);
  // names and stores: nothing is evaluated
  const tree = A.bridge.parse(c.text);
  const reads = readsFrom(tree);
  const p = bridge.parse(c.text);
  note("reads", c, set(reads.names), set(p.reads));
  // G100: the host's targets are the tree's, our helpers' stores told apart by name (ourNames.ts); its stateful is
  // stores.ts formOf (no stored programs here: the walk finds none). The bridge column is the raw tree.
  note("targets", c, set(tree.targets.filter((t) => !isOurStore(t))), set(p.targets));
  note("stateful", c, String(formOf(c.text, mayStore(c.text) ? tree : null, () => false).stores), String(p.targets.length > 0 || p.heads.some((h) => ["purge", "assume", "additionally", "DelVar"].includes(h))));
  note("float", c, String(hasFloat(c.text)), String(p.float));
  // one evaluation each
  const P = c.digits;
  const stored = A.giac.eval(`pasans:=(${c.text})`);
  const out = isError(stored) ? stored : A.giac.eval("pasans"); // a failed store leaves the last value in pasans
  const v = bridge.value(c.text, [P, P + 20]);
  note("kind", c, todayKind(out), bridgeKind(v));
  note("text", c, v.cut ? out.slice(0, v.text.length) : out, v.text); // over 2 kB the bridge gives a cut text by design
  const [ct, cb] = diffCtx(ctxToday(B.giac), ctxBridge());
  note("ctx", c, ct, cb);
  note("state", c, A.giac.eval(FLAGS_READ), B.giac.eval(FLAGS_READ));
  const shape: Shape | null = isError(out) ? null : shapeOf(out);
  for (const [f, n] of [["P", P], ["P+20", P + 20]] as const) {
    const today = shape && !isError(stored) ? valueParts(A.giac, "pasans", shape, n, 60) : null;
    const br = v.at?.[String(n)] ?? null;
    if (today === null && br === null) continue;
    note(f, c, today ? today.map((x) => `${decimalToString(x.re)}|${decimalToString(x.im)}`).join(";") : "none", br ? br.map(([re, im]) => `${num(re)}|${num(im)}`).join(";") : "none");
  }
  A.giac.eval(`Digits:=${c.digits}`);
  // keep the engines alike: drop what this case stored
  const made = [...userNames(A.giac)].filter((n) => !names0.has(n) || c.before.length);
  const fresh = [...made, ...[...userNames(B.giac)].filter((n) => !names0.has(n))].filter((n) => !n.startsWith("pas") && !(n in ENGINE_DEFINITIONS));
  if (fresh.length) for (const g of [A.giac, B.giac]) g.eval(`purge(${[...new Set(fresh)].join(",")})`);
}

// --- --calls: call-trace.ts's seven inputs, each call marked --------------------------------------------------------
const SEVEN = ["1/3", "sqrt(2)", "sin(1)+1/7", "[1/3,sqrt(2)]", "x^2+1", "floor(10*pi)", "a*b+1"];
/** How a host on the bridge would make this call: kept (same giac_eval), a bridge call, or dropped (a field of a bridge
 *  answer, or a store/purge of a slot the bridge does not need). */
function mark(call: string, input: string): string {
  if (/^Digits:=\d+$/.test(call)) return "bridge-1 ctx_set";
  if (call === `pasans:=(${input})` || call === `pasdec:=(${input})`) return "bridge-3 value";
  if (/^pasbx:=/.test(call)) return "bridge-3 value"; // value(x - round(evalf(x,60)), [60,80]): pasbn…pasbb are its parts
  if (/^pas(bn|bd|ba|bb):=/.test(call)) return "dropped (the parts of that value)";
  if (/^(re|im)\(pas[a-z]*\)$/.test(call)) return "dropped (value at[P])";
  if (call === "pasans") return "dropped (value text)";
  if (/^\(pasz->\[re\(pasz\),im\(pasz\)\]\)\(evalf\(pasans,\d+\)\)$/.test(call)) return "dropped (value at[P], same call)";
  if (/^pasd:=evalf\(pasans\)$/.test(call)) return "dropped (value at[14], same call)";
  if (/^type\(pas[a-z]*\)$/.test(call)) return "dropped (value kind)";
  if (/^when\(abs\(pasba-pasbb\)/.test(call)) return "dropped (compared in TypeScript from at[60], at[80])";
  if (/^purge\(pas/.test(call)) return "dropped (nothing stored)";
  if (call.startsWith(FLAGS_READ) || call.startsWith(`[${FLAGS_READ}`)) return "bridge-2 parse (+ the flags check in the restoring ctx_set)";
  if (call.startsWith("[(Digits:=")) return "kept (the state part, G102)";
  return "kept";
}
async function calls(): Promise<void> {
  const log: string[] = [];
  const traced: GiacApi = { eval: (s) => (log.push(s), A.giac.eval(s)), setPowLimit: (n) => A.giac.setPowLimit(n), messages: () => A.giac.messages(), clearMessages: () => A.giac.clearMessages() };
  const host = new EngineHost(traced, A.bridge);
  host.home("0", defaultHomeSettings);
  let today = 0;
  let after = 0;
  for (const i of SEVEN) {
    log.length = 0;
    host.home(i, defaultHomeSettings);
    const marks = log.map((c) => mark(c, i));
    // Consecutive ctx_set calls with only dropped calls between them are one ctx_set (it sets several fields at once).
    let n = 0;
    let lastSet = false;
    for (const m of marks) {
      if (m.startsWith("dropped")) continue;
      if (m === "bridge-1 ctx_set") {
        if (!lastSet) n++;
        lastSet = true;
        continue;
      }
      lastSet = false;
      n++;
    }
    console.log(`${JSON.stringify(i)}: today ${log.length} calls, bridge ${n}`);
    log.forEach((c, k) => console.log(`    ${marks[k]!.padEnd(28)} ${c.slice(0, 110)}`));
    today += log.length;
    after += n;
  }
  console.log(`total: today ${today}, bridge ${after} (${((100 * after) / today).toFixed(0)}%; bar: at most ${today / 2})`);
  // Timing: today's Enter against its bridge chain (ctx_set, value at [40,60,14], ctx_set, parse), medians of 7.
  for (const i of SEVEN) {
    const t: number[] = [];
    const b: number[] = [];
    for (let r = 0; r < 7; r++) {
      let s = performance.now();
      host.home(i, defaultHomeSettings);
      t.push(performance.now() - s);
      s = performance.now();
      bridge.ctxSet({ decimal_digits: 40 });
      bridge.value(i, [40, 60, 14]);
      bridge.ctxSet({ decimal_digits: 12 });
      bridge.parse(i);
      b.push(performance.now() - s);
    }
    console.log(`time ${JSON.stringify(i)}: today's Enter ${median(t).toFixed(2)} ms, bridge chain ${median(b).toFixed(2)} ms`);
  }
}

// --- --cost ---------------------------------------------------------------------------------------------------------
function time(f: () => unknown, n = 7, reps = 50): number {
  const ms: number[] = [];
  for (let r = 0; r < n; r++) {
    const s = performance.now();
    for (let k = 0; k < reps; k++) f();
    ms.push((performance.now() - s) / reps);
  }
  return median(ms);
}
function cost(): void {
  const g = A.giac;
  const row = (what: string, ms: number, vs: string, ms2: number): void => console.log(`${what.padEnd(46)} ${ms.toFixed(3)} ms   against ${vs.padEnd(52)} ${ms2.toFixed(3)} ms`);
  row("bridge-1 ctx_get", time(() => bridge.ctxGet()), "FLAGS_READ (giac_eval)", time(() => g.eval(FLAGS_READ)));
  row("bridge-1 ctx_set {decimal_digits:40}", time(() => bridge.ctxSet({ decimal_digits: 40 })), "Digits:=40 (giac_eval)", time(() => g.eval("Digits:=40")));
  bridge.ctxSet({ decimal_digits: 12 });
  g.eval("Digits:=12");
  for (const i of ["a*b+1", "f(x):=x^2+a", "seq(k^2,k=1..3)"]) row(`bridge-2 parse ${i}`, time(() => bridge.parse(i)), "lname(quote(…)) (the read before G99, giac_eval)", time(() => g.eval(`lname(quote(${i}))`)));
  for (const i of ["1/3", "sqrt(2)", "[1/3,sqrt(2)]"]) {
    const chain = (): void => {
      g.eval(`pasans:=(${i})`);
      g.eval("pasans");
      g.eval("re(pasans)");
      g.eval("im(pasans)");
      g.eval("(pasz->[re(pasz),im(pasz)])(evalf(pasans,40))");
      g.eval("(pasz->[re(pasz),im(pasz)])(evalf(pasans,60))");
    };
    row(`bridge-3 value ${i} at [40,60]`, time(() => bridge.value(i, [40, 60])), "pasans:=, pasans, re, im, two evalf parts (6 calls)", time(chain));
  }
  // bridge-2 over A12's 200-program library (tools/probes/library.ts replay), all 200 parsed, medians of 7 runs
  const prog = Array.from({ length: 200 }, (_, k) => `lib${k + 1}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${k + 1};\n}`);
  const all = (f: (s: string) => unknown): number => time(() => prog.forEach(f), 7, 1);
  const p0 = bridge.parse(prog[0]!);
  console.log(`bridge-2 over 200 library programs: ${all((s) => bridge.parse(s)).toFixed(1)} ms (bar: under 50 ms); lname(quote(…)) over the same: ${all((s) => g.eval(`lname(quote(${s}))`)).toFixed(1)} ms; lib1 → ${JSON.stringify(p0)}`);
}

// --- --readers ------------------------------------------------------------------------------------------------------
/** The readers a host on the bridge deletes, by the bridge call whose field answers them. Kept (not listed): the state
 *  part (VARS, parsePrinted, tableOf), CONTEXT_FIELDS and its canary, decimalFromString, shortDigits, the LaTeX readers. */
const READERS: Record<string, [string, string[]][]> = {
  "bridge-1 ctx": [
    ["flags.ts", ["GETTERS", "FLAGS_READ", "flagsExpected", "restoreCommands"]],
    ["numeric.ts", ["withDigits"]],
  ],
  "bridge-2 parse": [
    ["stateRead.ts", ["STO", "READER", "readPart", "IDENT", "idents", "readsOf"]],
    ["homeEval.ts", ["STATEFUL", "HELPER_STO", "isStateful", "simpleAssignment", "definedBy", "NAME_LIST", "storeTargets"]],
    ["decisions.ts", ["definitionStores", "callsStateful"]],
    ["library.ts", ["STATE_WORDS", "globalAssigned", "storedNames", "assigns"]],
    ["numeric.ts", ["FLOAT_LITERAL", "hasFloat", "functionsIn", "namesIn"]],
    ["host.ts", ["QUOTING", "arrowBodyEnd", "maskBound", "matching", "splitTop", "indexedTarget"]],
  ],
  "bridge-3 value": [
    ["numeric.ts", ["splitList", "hasTopLevelComma", "shapeOf", "flatten", "RATIONAL", "rationalValue", "anyValue", "isError", "readParts", "valueParts", "partsOf"]],
  ],
};
// glue-growth.mjs's REGEX_LINE
const REGEX_LINE = /(\/(?![/*])(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[dgimsuyv]*\s*[.,;)\]]|\.(?:match|matchAll|replace|replaceAll|test|exec|search)\(|\.split\(\s*\/|new RegExp\()/;
function readers(): void {
  const ts = require("typescript") as typeof import("typescript");
  let all = 0;
  let allRegex = 0;
  for (const [bridgeCall, files] of Object.entries(READERS)) {
    let lines = 0;
    let regex = 0;
    const rows: string[] = [];
    for (const [file, names] of files) {
      const text = readFileSync(new URL(`../../app/src/engine/${file}`, import.meta.url), "utf8");
      const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const spans = new Map<string, [number, number]>();
      const lineOf = (pos: number): number => src.getLineAndCharacterOfPosition(pos).line;
      for (const st of src.statements) {
        if (ts.isFunctionDeclaration(st) && st.name) spans.set(st.name.text, [lineOf(st.getStart()), lineOf(st.end)]);
        if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) spans.set(d.name.text, [lineOf(st.getStart()), lineOf(st.end)]);
      }
      for (const n of names) {
        const sp = spans.get(n);
        if (!sp) {
          rows.push(`${file} ${n}: gone`);
          continue;
        }
        const body = text.split("\n").slice(sp[0], sp[1] + 1).filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l));
        const re = body.filter((l) => REGEX_LINE.test(l)).length;
        lines += body.length;
        regex += re;
        rows.push(`${file}:${sp[0] + 1}-${sp[1] + 1} ${n}: ${body.length} lines, ${re} regex`);
      }
    }
    console.log(`${bridgeCall}: ${lines} code lines, ${regex} regex lines`);
    for (const r of rows) console.log(`    ${r}`);
    all += lines;
    allRegex += regex;
  }
  console.log(`total: ${all} code lines, ${allRegex} regex lines (definitions only; their call sites change too)`);
}

if (process.argv.includes("--readers")) readers();
else if (process.argv.includes("--calls")) await calls();
else if (process.argv.includes("--cost")) cost();
else {
  const all = cases();
  for (const c of all) {
    try {
      runCase(c);
    } catch (e) {
      console.log(`${c.id}: probe error ${String(e).slice(0, 200)}`);
    }
  }
  for (const f of fields) {
    console.log(`\n== ${f}: ${mism[f].length} mismatches of ${compared[f]}`);
    for (const m of mism[f]) console.log(`  ${m}`);
  }
  console.log(`\n${all.length} inputs; ${fields.map((f) => `${f} ${mism[f].length}/${compared[f]}`).join(", ")}`);
}
