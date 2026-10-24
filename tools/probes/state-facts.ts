// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S13, docs/archive/r15-state-facts.md): can the host learn from Giac's state, instead of from our reading of the
// input's text, which names an input stored and which stored names it read?
//   node tools/probes/state-facts.ts            # G48/G49/G51 sequence cases, prec-g48, night-check extras, G55 sequences
//   node tools/probes/state-facts.ts --cost     # Giac calls and desktop time the state rule adds per Enter (engine-calls' 15
//                                               # inputs with a, b and f stored), and G104's Home c:=1, M1[1,1]:=0 with
//                                               # two 300x300 matrices and a list of big integers stored; take the
//                                               # host-cpu lock for the timing
//   SHOW=1 …                                    # every step: stored names, read names, both marks
// Two engines run each sequence side by side:
// - "text": EngineHost as the app runs it today (storeTargets, namesIn, functionsIn, maskBound, bodyFacts, callFacts …);
// - "state": EngineHost with its definitions log wiped after every step (so it inherits nothing: its result carries only
//   the input's own facts), and this model on top. Before and after each input it reads every user name and its stored
//   text in one call (`map(VARS(),k->[k,string(eval(k))])`); the names that changed or appeared take the input's facts.
//   The names an input read are Giac's: `lname` of the parsed input (`quote`; for a store, `lname` of the stored side
//   only, plus the target's own names for `L[k]:=`), then the closure through each stored name's value (`lname(name)`:
//   a program's body, a symbolic value's names), a function's parameters left out. A result takes the weakest facts of
//   the names read (cap of confirmed digits, the strongest warn, never exact), as inherited() does without its
//   perturbation check (which needs only the names, so it would stay).
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl. Read-only; nothing is written.
import { readFileSync } from "node:fs";
import { EngineHost, type GiacApi } from "../../app/src/engine/host.ts";
import { formOf, mayStore } from "../../app/src/engine/stores.ts";
import type { GiacBridge } from "../../app/src/engine/bridge.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, ENGINE_DEFINITIONS, pasdegCommand, WORKER_DEFINITION_NAMES, precisionFacts, type HomeResult, type HomeSettings } from "../../app/src/engine/homeEval.ts";
import { hasFloat, valuePrecision } from "../../app/src/engine/numeric.ts";
import { COMPLEX_DEFINITIONS } from "../../app/src/engine/complex.ts";
import { markOf, type MarkInfo } from "../../app/src/engine/format.ts";
import { defaultCasSettings, type CasResult } from "../../app/src/engine/types.ts";
import { chipCommand, chipNameFacts, chipsIn, CHIP_PREFIX, withChipValues, type ChipFactsTable } from "../../app/src/engine/chipFacts.ts";
import { inexactConstsIn, type ConstTable } from "../../app/src/engine/constUnc.ts";
import type { NameFacts } from "../../app/src/engine/defs.ts";
import { rewriteAngles } from "../../app/src/input/angles.ts";

/** The fields of a one-line flow case (`- { id: "…", steps: [ … ], … }`, as home.yaml, precision.yaml and corpus.yaml
 *  write them); no yaml package needed, so the probe runs in a worktree without app/node_modules. */
function flowCases(file: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of readFileSync(new URL(file, import.meta.url), "utf8").split("\n")) {
    const id = /^\s*- \{ id: "([^"]+)"/.exec(line);
    if (!id) continue;
    const c: Record<string, unknown> = { id: id[1] };
    const steps = /steps: (\[.*?\])(?=, (?:settings|expect|mark|source|oracle|consts)\b| \})/.exec(line);
    if (steps) c.steps = (JSON.parse(steps[1]!) as (string | Step)[]).map((x) => (typeof x === "string" ? { input: x } : x));
    const str = (k: string): void => {
      const m = new RegExp(`\\b${k}: "((?:[^"\\\\]|\\\\.)*)"`).exec(line);
      if (m) c[k] = JSON.parse(`"${m[1]}"`);
    };
    str("input");
    str("mark");
    const d = /settings: \{ digits: (\d+) \}/.exec(line);
    if (d) c.settings = { digits: Number(d[1]) };
    const k = /consts: \{ (\w+): \{ value: "([^"]+)", unc: "([^"]+)" \} \}/.exec(line);
    if (k) c.consts = { [k[1]!]: { value: k[2], unc: k[3] } };
    out.push(c);
  }
  return out;
}

interface Step { input: string; view?: "cas" }
interface Case { id: string; steps: Step[]; mark?: string; digits: number; consts?: ConstTable; group: string }

const F = "floor(sin(10^100)*10^12)"; // Giac 899450126402 at 40 digits; oracle -372376123662 (g38-floor-sin1e100)
/** Night check 2.2's "right" list and the forms the text rules were not written for. Marks derived (F is undecided). */
const EXTRAS: [string, string[], string][] = [
  ["x-indexed", [`sto(${F},pA)`, "L2:=[0,0]", "L2[1]:=pA", "L2[1]"], "⚠"],
  ["x-subst", [`sto(${F},pA)`, "subst(x+1,x=pA)"], "⚠"],
  ["x-local-body", [`sto(${F},pA)`, "pf(x):={local t; t:=pA; return x+t;}", "pf(0)"], "⚠"],
  ["x-seq-stored", [`sto(${F},pA)`, "sL:=seq(pA+k,k,1,2)", "sL"], "⚠"],
  ["x-prog-stores-global", [`sto(${F},pA)`, "setg(v):={gl:=v; return 1;}", "setg(pA)", "gl"], "⚠"],
  ["x-store-in-expr", [`sto(${F},pA)`, "(pZ:=pA)+1", "pZ"], "⚠"],
  ["x-symbolic-late", ["S:=y+pA0", `sto(${F},pA0)`, "subst(S,y=0)"], "⚠"],
  ["x-symbolic-late-plain", ["S2:=pA1*2", `sto(${F},pA1)`, "S2"], "⚠"],
  ["x-symbolic-late-float", ["S3:=y+k1", "k1:=romberg(exp(-x^2),x,0,1)", "subst(S3,y=0)"], "⚠"],
  ["x-sto-in-list", [`sto(${F},pA)`, "[sto(pA,pY),1]", "pY"], "⚠"],
  ["x-redefine-exact", [`sto(${F},pB)`, "pB:=5", "pB+1"], "="],
  ["x-purge-exact", [`sto(${F},pB)`, "purge(pB)", "pB:=5", "pB+1"], "="],
  ["x-local-shadow-exact", ["t:=evalf(sqrt(2))", "pq(x):={local t; t:=1; return x+t;}", "pq(1)"], "="],
  ["x-param-shadow-exact", ["x:=evalf(sqrt(2))", "pr(x):=x+1", "pr(1)"], "="],
  ["x-cas-unapply", [`sto(${F},pA)`, "cas:pv:=unapply(x+pA,x)", "pv(0)"], "⚠"],
];

function cases(): Case[] {
  const home = flowCases("../../tests/golden/home.yaml");
  const out: Case[] = [];
  for (const c of home) {
    const id = String(c.id);
    if (!/^g4[89]|^g51/.test(id) || !Array.isArray(c.steps)) continue;
    const s = c.settings as { digits?: number } | undefined;
    out.push({ id, steps: c.steps as Step[], digits: s?.digits ?? 12, group: "golden", ...(c.mark ? { mark: String(c.mark) } : {}), ...(c.consts ? { consts: c.consts as ConstTable } : {}) });
  }
  const prec = flowCases("../../tests/golden/precision.yaml");
  for (const c of prec) if (String(c.id).startsWith("prec-g48")) out.push({ id: String(c.id), steps: [{ input: String(c.input), view: "cas" }], digits: 12, group: "golden", mark: String(c.mark) });
  for (const [id, steps, mark] of EXTRAS)
    out.push({ id, steps: steps.map((t) => (t.startsWith("cas:") ? { input: t.slice(4), view: "cas" as const } : { input: t })), digits: 12, group: "extra", mark });
  for (const q of flowCases("../../tests/golden/corpus.yaml"))
    if (Array.isArray(q.steps)) out.push({ id: `corpus-${String(q.id)}`, steps: q.steps as Step[], digits: 12, group: "corpus" });
  return out.map((c) => ({ ...c, steps: c.steps.map((st) => ({ ...st, input: rewriteAngles(st.input) })) }));
}

// --- the state model --------------------------------------------------------------------------------------------------

/** Our own engine names (definitions, slots, the degree factor): not user state. Named chips (pasr_<k>) are. */
const OURS = new Set([...Object.keys(ENGINE_DEFINITIONS), ...WORKER_DEFINITION_NAMES, ...Object.keys(COMPLEX_DEFINITIONS)]);
const ours = (n: string): boolean => OURS.has(n) || n === "pcasans" || (n.startsWith("pas") && !n.startsWith(CHIP_PREFIX));

function merged(all: readonly NameFacts[]): NameFacts | null {
  if (!all.length) return null;
  const capped = all.flatMap((f) => (f.reliableDigits === null ? [] : [f.reliableDigits]));
  const warn = all.some((f) => f.warn === "unaudited") ? "unaudited" : all.some((f) => f.warn === "unchecked") ? "unchecked" : undefined;
  return { exact: false, reliableDigits: capped.length ? Math.min(...capped) : null, ...(warn ? { warn } : {}), inexact: true };
}

class StateModel {
  facts = new Map<string, NameFacts>();
  calls = 0;
  ms = 0;
  private readonly giac: GiacApi;
  constructor(giac: GiacApi) {
    this.giac = giac;
  }

  private ev(t: string): string {
    this.calls++;
    const t0 = performance.now();
    const out = this.giac.eval(t);
    this.ms += performance.now() - t0;
    return out;
  }

  private list(t: string): string[] {
    const out = this.ev(t).trim();
    return out.startsWith("[") ? out.slice(1, -1).split(",").map((n) => n.trim()).filter((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) : [];
  }

  /** Every user name and its stored text (one call). */
  state(): Map<string, string> {
    const out = this.ev("map(VARS(),k->[k,string(eval(k))])");
    const m = new Map<string, string>();
    for (const x of out.matchAll(/\[([A-Za-z_][A-Za-z0-9_]*),"((?:[^"\\]|\\.)*)"\]/g)) if (!ours(x[1]!)) m.set(x[1]!, x[2]!);
    return m;
  }

  /** The user names the input reads, by Giac's parse, and the closure through what they hold. */
  reads(input: string, vars: Map<string, string>, consts?: ConstTable): string[] {
    let direct: string[];
    const q = this.ev(`pasprobeq:=quote(${input})`);
    if (q.startsWith("GIAC_ERROR")) direct = this.list(`lname(quote(${input}))`);
    else {
      // a store reads its stored side; `L[k]:=` also reads L (the other elements stay)
      const sto = this.ev("sommet(pasprobeq)").includes("sto");
      const head = sto ? /^\s*"?\s*\(([^()]*)\)\s*->/.exec(this.ev("string(op(pasprobeq)[0])")) : null;
      const params = new Set(head ? head[1]!.split(",").map((p) => p.trim()) : []);
      direct = sto ? [...this.list("lname(op(pasprobeq)[0])").filter((n) => !params.has(n)), ...this.list("when(type(op(pasprobeq)[1])==DOM_IDENT or type(op(pasprobeq)[1])==DOM_LIST,[],lname(op(pasprobeq)[1]))")] : this.list("lname(pasprobeq)");
      this.ev("purge(pasprobeq)");
    }
    const seen = new Set<string>();
    const walk = (n: string): void => {
      if (seen.has(n)) return;
      if (n.startsWith("pasc_") && consts && inexactConstsIn(n, consts).length) {
        seen.add(n);
        return;
      }
      const v = vars.get(n);
      if (v === undefined) return;
      seen.add(n);
      // a program's parameters are not reads (its locals are: Giac's print keeps them inside the body; over-reads only)
      const head = /^\s*\(([^()]*)\)\s*->/.exec(v);
      const params = new Set(head ? head[1]!.split(",").map((p) => p.trim()) : []);
      for (const m of this.list(`lname(${n})`)) if (!params.has(m)) walk(m);
    };
    for (const n of direct) walk(n);
    return [...seen];
  }

  factsOfReads(names: readonly string[]): { facts: NameFacts | null; causes: string[] } {
    const fs = names.flatMap((n) => {
      const f = n.startsWith("pasc_") ? { exact: false, reliableDigits: null, inexact: true as const } : this.facts.get(n);
      return f ? [[n, f] as const] : [];
    });
    return { facts: merged(fs.map(([, f]) => f)), causes: fs.map(([n]) => n) };
  }

  /** After the input: changed or new names take `stored`, purged names lose their facts. Returns the changed names. */
  record(before: Map<string, string>, after: Map<string, string>, stored: NameFacts | null): string[] {
    const changed: string[] = [];
    for (const [n, v] of after)
      if (before.get(n) !== v) {
        changed.push(n);
        // as host.ts storedFacts: a float keeps the facts; a value that prints exactly only when they say inexact
        const keep = stored && (hasFloat(v) || stored.inexact === true);
        if (keep) this.facts.set(n, stored);
        else this.facts.delete(n);
      }
    for (const n of before.keys()) if (!after.has(n)) this.facts.delete(n);
    return changed;
  }
}

/** A result's own facts as a stored name keeps them (EngineHost.factsOf, the G49 inexact flag for a ⚠). */
function ownFacts(r: HomeResult): NameFacts | null {
  if (!r.ok) return null;
  const w = r.facts.warn;
  if (!r.value && !r.items) return r.approximate ? { exact: false, reliableDigits: null, ...(w ? { warn: w } : {}), inexact: true } : null;
  const m = markOf(precisionFacts(r), { format: "STD", digits: 12 });
  if (m?.mark === "=") return null;
  return { exact: false, reliableDigits: r.facts.reliableDigits, ...(w ? { warn: w } : {}), ...(w ? { inexact: true as const } : {}) };
}

function casOwn(r: CasResult): NameFacts | null {
  if (r.numeric) return ownFacts(r.numeric);
  const w = r.facts.warn;
  return r.approximate || w ? { exact: false, reliableDigits: null, ...(w ? { warn: w } : {}), inexact: true } : null;
}

/** The own result capped by the facts read (inherited() without the perturbation check). */
function capped(r: HomeResult, f: NameFacts | null, digits: number): MarkInfo | null {
  if (!f || !r.ok || (!r.value && !r.items)) return markOf(precisionFacts(r), { format: "STD", digits });
  const P = valuePrecision(digits);
  const one = (e: HomeResult): HomeResult => ({
    ...e,
    facts: { ...e.facts, exact: false, reliableDigits: Math.min(e.facts.reliableDigits ?? P, f.reliableDigits ?? P), ...((f.warn ?? e.facts.warn) ? { warn: f.warn ?? e.facts.warn } : {}) },
  });
  return markOf(precisionFacts(r.items ? { ...r, items: r.items.map(one) } : one(r)), { format: "STD", digits });
}

function casMark(r: CasResult, f: NameFacts | null): string {
  if (r.numeric) return text(capped(r.numeric, f, 12));
  const warn = f?.warn ?? r.facts.warn;
  return warn ? "⚠" : r.approximate || f ? "≈" : "-";
}

const text = (m: MarkInfo | null): string => (m ? `${m.mark}${m.n ?? ""}` : "-");

// --- running a case ----------------------------------------------------------------------------------------------------

async function fresh(): Promise<{ giac: GiacApi; bridge: GiacBridge }> {
  const L = await loadNodeGiac();
  L.giac.eval(pasdegCommand("rad"));
  return L;
}

type Wipe = { log: unknown[]; byName: Map<string, unknown> };

interface Row { id: string; group: string; expect?: string; textMark: string; stateMark: string; stored: string; read: string; calls: number }

async function run(c: Case, show: boolean): Promise<Row> {
  const fa = await fresh();
  const a = new EngineHost(fa.giac, fa.bridge);
  const { giac: bg, bridge } = await fresh();
  const b = new EngineHost(bg, bridge);
  const model = new StateModel(bg);
  const named: ChipFactsTable = {};
  let textMark = "-";
  let stateMark = "-";
  let lastStored: string[] = [];
  let lastRead: string[] = [];
  let calls = 0;
  for (const [k, st] of c.steps.entries()) {
    const s: HomeSettings = { ...defaultHomeSettings, digits: c.digits };
    // today's rules
    if (st.view === "cas") {
      const r = a.cas(st.input, { ...defaultCasSettings, digits: c.digits }).result;
      textMark = casMark(r, null);
    } else {
      const r = (c.consts || k > 0 ? a.home(st.input, s, c.consts, named) : a.home(st.input, s)).result;
      textMark = text(markOf(precisionFacts(r), { format: "STD", digits: c.digits }));
      if (r.ok && r.full) named[String(k + 1)] = { value: r.full, reliableDigits: r.facts.reliableDigits, ...(r.facts.warn ? { warn: r.facts.warn } : {}), exact: !r.approximate && r.facts.exact };
    }
    // the state model: chips as stored names with their facts, for this step only; an input the log keeps as typed (a
    // function definition) gets their values, as the host does, and their facts are lent (G49f1)
    const held = st.view === "cas" ? [] : chipsIn(st.input, named);
    // G100: the host's form of the input (stores.ts), from Giac's tree
    const form = formOf(st.input, mayStore(st.input) ? bridge.parse(st.input) : null, () => false);
    const asValues = form.stores && form.defined?.kind !== "var";
    const input = asValues && held.length ? withChipValues(st.input, named, new Set()) : st.input;
    const lent = held.filter((j) => !named[j]!.exact).map((j) => chipNameFacts(named[j]!));
    if (!asValues)
      for (const j of held) {
        bg.eval(chipCommand(j, named[j]!));
        if (!named[j]!.exact) model.facts.set(`${CHIP_PREFIX}${j}`, chipNameFacts(named[j]!));
      }
    const c0 = model.calls;
    const before = model.state();
    const read = model.reads(input, before, c.consts);
    const fr = model.factsOfReads(read).facts;
    const facts = merged([...(fr ? [fr] : []), ...(asValues ? lent : [])]);
    let own: NameFacts | null;
    if (st.view === "cas") {
      const r = b.cas(st.input, { ...defaultCasSettings, digits: c.digits }).result;
      own = casOwn(r);
      stateMark = casMark(r, facts);
    } else {
      const r = (c.consts ? b.home(input, s, c.consts) : b.home(input, s)).result;
      own = ownFacts(r);
      stateMark = text(capped(r, facts, c.digits));
    }
    const wipe = b as unknown as Wipe;
    wipe.log = [];
    wipe.byName = new Map();
    const after = model.state();
    const stored = model.record(before, after, merged([...(own ? [own] : []), ...(facts ? [facts] : [])]));
    calls = model.calls - c0;
    if (held.length && !asValues) {
      bg.eval(`purge(${held.map((j) => CHIP_PREFIX + j).join(",")})`);
      for (const j of held) model.facts.delete(`${CHIP_PREFIX}${j}`);
    }
    lastStored = stored.filter((n) => !n.startsWith(CHIP_PREFIX));
    lastRead = read;
    if (show) console.log(`  ${c.id} #${k + 1} ${st.view ?? ""} ${st.input}  text ${textMark}  state ${stateMark}  stored [${lastStored}] read [${read}] calls ${calls}`);
  }
  return { id: c.id, group: c.group, ...(c.mark ? { expect: c.mark } : {}), textMark, stateMark, stored: lastStored.join(","), read: lastRead.join(","), calls };
}

const rank = (m: string): number => (m.startsWith("⚠") ? 0 : m === "≈" ? 1 : m === "=" ? 2 : 3);

async function main(): Promise<void> {
  const show = process.env.SHOW === "1";
  if (process.argv.includes("--cost")) return cost();
  const rows: Row[] = [];
  for (const c of cases()) rows.push(await run(c, show));
  console.log("| case | expect | text rules | state | last step read | last step stored | state calls |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.id} | ${r.expect ?? ""} | ${r.textMark} | ${r.stateMark} | ${r.read} | ${r.stored} | ${r.calls} |`);
  const ok = (m: string, e?: string): boolean => e === undefined || m.startsWith(e);
  const sum = (g: string): string => {
    const rs = rows.filter((r) => r.group === g);
    const agree = rs.filter((r) => r.textMark === r.stateMark).length;
    const stateMore = rs.filter((r) => rank(r.stateMark) < rank(r.textMark)).length;
    const stateLess = rs.filter((r) => rank(r.stateMark) > rank(r.textMark)).length;
    const tOk = rs.filter((r) => ok(r.textMark, r.expect)).length;
    const sOk = rs.filter((r) => ok(r.stateMark, r.expect)).length;
    return `${g}: ${rs.length} cases, same mark ${agree}, state weaker ${stateMore}, state stronger ${stateLess}; expected mark: text ${tOk}, state ${sOk}`;
  };
  for (const g of ["golden", "extra", "corpus"]) console.log(sum(g));
}

/** Calls and time the state rule adds per Enter: one state read before, one after, and the reads' closure. */
async function cost(): Promise<void> {
  const inputs = ["1/3", "2+3", "sqrt(2)", "sin(1)", "a*b+1", "f(3)", "f(b)", "exp(-0.5)", "atan(2)", "0.1+0.2", "int(x^2,x,0,1)", "normald_cdf(1.96)", "floor(2.7)", "round(2.25,1)", "a+b+f(a)"];
  const { giac: g, bridge } = await fresh();
  const host = new EngineHost(g, bridge);
  const model = new StateModel(g);
  const s = { ...defaultHomeSettings };
  for (const t of ["a:=2.5", "b:=sqrt(2)", "f(x):=x^2+a"]) host.home(t, s);
  let calls = 0;
  let ms = 0;
  for (const input of inputs.map(rewriteAngles)) {
    const times: number[] = [];
    let n = 0;
    for (let k = 0; k < 5; k++) {
      const c0 = model.calls;
      const m0 = model.ms;
      const before = model.state();
      model.reads(input, before);
      model.state();
      n = model.calls - c0;
      times.push(model.ms - m0);
    }
    times.sort((x, y) => x - y);
    calls += n;
    ms += times[2]!;
    console.log(`${input.padEnd(28)} state calls ${String(n).padStart(2)}  median ${times[2]!.toFixed(2)} ms`);
  }
  console.log(`total state calls ${calls}, median sum ${ms.toFixed(1)} ms (${inputs.length} inputs)`);
  // The lean form a host would use: the state before is the state after the last Enter (kept), so an Enter costs two
  // calls: the input's own names by Giac's parse, and every stored name with its text and lname (the closure is then
  // walked in JS). Its cost grows with the stored names: measured with a, b, f and with the replay bench's 200 entries.
  const time = (t: string): number => {
    const t0 = performance.now();
    g.eval(t);
    return performance.now() - t0;
  };
  const readCall = (input: string): string =>
    `pasprobeq:=quote(${input});[string(sommet(pasprobeq)),lname(pasprobeq),when(string(sommet(pasprobeq))=="'sto'",lname(op(pasprobeq)[0]),0)]`;
  const stateCall = "map(VARS(),k->[k,string(eval(k)),lname(eval(k))])";
  const leanRound = (label: string): void => {
    let read = 0;
    let state = 0;
    const med = (f: () => number): number => [0, 1, 2, 3, 4].map(f).sort((x, y) => x - y)[2]!;
    for (const input of inputs.map(rewriteAngles)) {
      read += med(() => time(readCall(input)));
      state += med(() => time(stateCall));
    }
    const n = inputs.length;
    console.log(`lean, ${label}: per Enter, the read call ${(read / n).toFixed(3)} ms, the state call ${(state / n).toFixed(3)} ms (medians of 5, ${n} inputs)`);
  };
  leanRound("a, b, f stored");
  // replay-cost.mjs's bench log: 150 values, 50 functions
  for (let k = 0; k < 150; k++) g.eval(`v${k}:=${k % 3 === 0 ? `${k}.25` : k % 3 === 1 ? `sqrt(${k + 2})` : `${k}/7`}`);
  for (let k = 0; k < 50; k++) g.eval(`fn${k}(x):=x^2+v${k}*x+${k}`);
  leanRound("200 more stored (150 values, 50 functions)");
  storedCost();
}

/** G104: Home `c:=1` and `M1[1,1]:=0` with large values stored (M1, M2 = ranm(300,300), then L = seq(k!,k,1,1500)):
 *  the time of the Enter (medians of 5) and the Giac calls and printed bytes it takes. */
async function storedCost(): Promise<void> {
  const { giac: g, bridge } = await fresh();
  let calls = 0;
  let bytes = 0;
  const ev = g.eval.bind(g);
  g.eval = (t: string): string => {
    calls++;
    const out = ev(t);
    bytes += out.length;
    return out;
  };
  const host = new EngineHost(g, bridge);
  const s = { ...defaultHomeSettings };
  const enter = (label: string, input: string): void => {
    host.home(input, s);
    const times: number[] = [];
    let n = 0;
    let b = 0;
    for (let k = 0; k < 5; k++) {
      calls = 0;
      bytes = 0;
      const t0 = performance.now();
      host.home(input, s);
      times.push(performance.now() - t0);
      n = calls;
      b = bytes;
    }
    times.sort((x, y) => x - y);
    console.log(`${label}: ${input.padEnd(12)} median ${times[2]!.toFixed(2)} ms, Giac calls ${n}, printed ${(b / 1000).toFixed(1)} kB`);
  };
  host.home("M1:=ranm(300,300)", s);
  host.home("M2:=ranm(300,300)", s);
  enter("M1, M2 stored", "c:=1");
  enter("M1, M2 stored", "M1[1,1]:=0");
  host.home("L:=seq(k!,k,1,1500)", s);
  enter("M1, M2, L stored", "c:=1");
  enter("M1, M2, L stored", "M1[1,1]:=0");
  enter("M1, M2, L stored", "sin(1)");
}

await main();
