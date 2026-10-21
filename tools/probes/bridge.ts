// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G85, structured bridge spike; docs/research/structure-hindsight.md 2.1): today's text readers against the
// bridge (engine/giac/wasm/api.cc: giac_ctx_get/set, giac_parse, giac_value), on two engines fed the same inputs.
// Inputs: every home.yaml and precision.yaml case (its `input`, its `latex` through our parser, a sequence's last step;
// its `before` first), and text-1 … text-10 (tools/probes/text-misses.ts). Fields, each today's way against the bridge:
//   reads    names the input reads: Giac's read part (stateRead.ts readPart/readsOf) | giac_parse reads
//   targets  names it stores: readsOf targets ∪ storeTargets() | giac_parse targets
//   stateful isStateful() | targets, or a purge/assume/additionally head
//   float    hasFloat(input) | giac_parse float
//   kind     read from the printed value (isError, rationalValue, shapeOf, hasFloat) | giac_value kind
//   text     the print of pasans:=(input) | giac_value text
//   P, P+20  valueParts(pasans) at the case's digits P and P + 20 | giac_value at[P], at[P+20]
//   ctx      after the case, on the bridge's engine: FLAGS_READ (flags.ts) decoded field by field | giac_ctx_get
//   state    after the case: FLAGS_READ on today's engine | on the bridge's (the two paths leave the same settings)
// Before each case both engines get the host's settings back (restoreCommands, as the host does after a change).
//   GIAC_OUT=<dir> node tools/probes/bridge.ts            # every case; mismatches listed by field, totals at the end
//   … bridge.ts --calls   # call-trace.ts's seven inputs: today's calls, each marked kept / bridge-n / dropped, and timings
//   … bridge.ts --cost    # each bridge call against the call it replaces (medians of 7), and giac_parse over 200 programs
// Stops at "no bridge exports" on an engine built without them. Read-only; no network.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { EngineHost, type GiacApi } from "../../app/src/engine/host.ts";
import { NO_BRIDGE, type GiacBridge, type GiacValue } from "../../app/src/engine/bridge.ts";
import { angleCommand, defaultHomeSettings, ENGINE_DEFINITIONS, isStateful, pasdegCommand, storeTargets } from "../../app/src/engine/homeEval.ts";
import { hasFloat, rationalValue, shapeOf, splitList, valueParts, type Shape } from "../../app/src/engine/numeric.ts";
import { parsePrinted, readPart, readsOf } from "../../app/src/engine/stateRead.ts";
import { FLAGS_READ, restoreCommands } from "../../app/src/engine/flags.ts";
import { decimalFromString, decimalToString } from "../../app/src/engine/format.ts";
import { latexToGiac } from "../../app/src/input/latex-to-giac.ts";

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { parse: yaml } = require("yaml") as { parse: (s: string) => unknown };
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

const A = await loadNodeGiac(); // today's way
const B = await loadNodeGiac(); // the bridge
const bridge = B.bridge as GiacBridge;
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
  // Giac keeps autosimplify as typed: a fresh engine holds regroup, restoreCommands' autosimplify('regroup') holds
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
  for (const g of [A.giac, B.giac]) {
    for (const r of restoreCommands(c.digits)) g.eval(r);
    g.eval(angleCommand(c.angle));
    g.eval(pasdegCommand(c.angle));
    g.eval(`Digits:=${c.digits}`);
    for (const b of c.before) g.eval(b);
  }
  const names0 = userNames(A.giac);
  // names and stores: nothing is evaluated
  const rp = parsePrinted(A.giac.eval(readPart(c.text)));
  const reads = rp ? readsOf(rp, c.text) : { names: [], targets: [], fn: false };
  const p = bridge.parse(c.text);
  note("reads", c, set(reads.names), set(p.reads));
  note("targets", c, set([...reads.targets, ...(storeTargets(c.text)?.names ?? [])]), set(p.targets));
  note("stateful", c, String(isStateful(c.text)), String(p.targets.length > 0 || p.heads.some((h) => ["purge", "assume", "additionally", "DelVar"].includes(h))));
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
  return "kept";
}
async function calls(): Promise<void> {
  const log: string[] = [];
  const traced: GiacApi = { eval: (s) => (log.push(s), A.giac.eval(s)), setPowLimit: (n) => A.giac.setPowLimit(n), messages: () => A.giac.messages(), clearMessages: () => A.giac.clearMessages() };
  const host = new EngineHost(traced);
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
  for (const i of ["a*b+1", "f(x):=x^2+a", "seq(k^2,k=1..3)"]) row(`bridge-2 parse ${i}`, time(() => bridge.parse(i)), "readPart (quote + lname, giac_eval)", time(() => g.eval(readPart(i))));
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
  console.log(`bridge-2 over 200 library programs: ${all((s) => bridge.parse(s)).toFixed(1)} ms (bar: under 50 ms); readPart over the same: ${all((s) => g.eval(readPart(s))).toFixed(1)} ms; lib1 → ${JSON.stringify(p0)}`);
}

if (process.argv.includes("--calls")) await calls();
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
