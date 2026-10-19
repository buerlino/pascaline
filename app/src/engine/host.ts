// SPDX-License-Identifier: GPL-3.0-or-later
// The engine side of the protocol: one Giac instance, synchronous calls. Runs inside the Web
// Worker (giac.worker.ts) and, for tests and the golden runner, directly in Node. Knows nothing
// about the UI. Only erasable TypeScript syntax, so Node runs this file directly.
import type { Request, Response } from "./protocol.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";
import {
  arrowFunction,
  definedBy,
  expIgnoresAngle,
  definitionsUsedBy,
  ENGINE_DEFINITIONS,
  decideFloatTest,
  EQ_DIFF,
  EQ_INEXACT_FLAG,
  EQ_VERDICT,
  floatsAsEvalf,
  homeEval,
  homeSetupCommands,
  angleCommand,
  latexShown,
  pasdegCommand,
  isStateful,
  onceUndecided,
  regrouped,
  resultFromFacts,
  safePrecision,
  symbolicWhy,
  testSides,
  showExp,
  showExpResult,
  simpleAssignment,
  storeTargets,
  toExactLiterals,
  unquote,
} from "./homeEval.ts";
import { eseriesDefinition } from "./eseries.ts";
import { callsIn, giacPair, hasDefiniteIntegral, refusalOf } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { dropAngleFactor } from "../input/angles.ts";
import { askedDigits, decideTwice, DOUBLE_DIGITS, restsOnDecision, notBuiltin, callsStateful, floatsShown, floatFacts, functionsIn, hasFloat, namesIn, numberLatex, perturbedDigits, shapeOf, valuePrecision, whyOf, withDigits, type ElementFacts, type Shape } from "./numeric.ts";
import { applyDefChanges, PREVIEW_MAX, replayOrder, type DefChange, type DefEntry, type NameFacts } from "./defs.ts";
import { SOLVE_HARD_TIMEOUT_S, solveRequest, unknownsOf } from "./solve.ts";
import { analyze, table } from "./analysis.ts";
import { UNIT_DEFINITIONS, unitEval } from "../units/evaluate.ts";
import { constUncDigits, inexactConstsIn, withConstValues, type ConstTable } from "./constUnc.ts";
import { chipCommand, chipNameFacts, chipsIn, CHIP_PREFIX, withChipValues, type ChipFactsTable } from "./chipFacts.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";


/** What the host needs from a loaded Giac module (engine/giac/wasm/api.cc). */
export interface GiacApi {
  eval(input: string): string;
  /** giac_set_pow_limit: returns the previous limit. */
  setPowLimit(limit: number): number;
  /** Text Giac printed (Emscripten `print`) since the last clearMessages(). Parse errors arrive here. */
  messages(): string;
  clearMessages(): void;
}

export interface LoadedGiac {
  giac: GiacApi;
  /** Fetch + compile + instantiate, measured by the loader. */
  instantiateMs: number;
}

export type GiacLoader = (baseUrl: string) => Promise<LoadedGiac>;

/** Read by Giac's EMCC hooks (gen.cc, maple.cc): no "=decimal" suffix on fractions, no WebGL 3D.
 *  Must be set before the module is instantiated. */
export function setGiacHostGlobals(): void {
  (globalThis as Record<string, unknown>).UI = {
    add_evalf: 0,
    js_bigint: 0,
    disable3d: -1,
    Datestart: Date.now(),
  };
}

/** Collects what the Emscripten module prints, for GiacApi.messages(). */
export function messageBuffer(): { print: (s: string) => void; messages: () => string; clear: () => void } {
  let buf: string[] = [];
  return {
    print: (s) => {
      if (buf.length < 50) buf.push(s);
    },
    messages: () => buf.join("\n"),
    clear: () => {
      buf = [];
    },
  };
}

export { isStateful };

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

/** Commands that put Giac into CAS mode (D3). Home's are homeSetupCommands() in homeEval.ts. */
export function casSetupCommands(s: CasSettings): string[] {
  return [
    angleCommand(s.angle),
    `Digits:=${Math.trunc(s.digits)}`,
    `timeout ${Math.min(Math.max(s.hardTimeoutS, 0.001), 1439).toFixed(3)}`,
    "ckevery 10",
  ];
}

/** Giac reports a parse error by printing "syntax error" and returning `undef`. */
class GiacSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiacSyntaxError";
  }
}

type CasError = NonNullable<CasResult["error"]>;

/** Names in a printed value that are not user names (a value with only these in it does not depend on the order of the
 *  replay). */
const CONSTANT_NAMES: ReadonlySet<string> = new Set(["i", "pi", "e", "infinity", "inf", "undef", "euler_gamma", "true", "false"]);

const IDENT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Variable arguments the probe (tools/probes/bound.ts, G28) found quoted: the result does not change when the name
 *  holds a value. [command, index of the variable argument, indexes of the arguments it is bound in, min arguments].
 *  A command not listed keeps listing the name: a hint too many is noise, a hint missing hides a stored value. */
const QUOTING: [string, number, number[], number][] = [
  ["diff", 1, [0, 1], 2],
  ["solve", 1, [0, 1], 2],
  ["csolve", 1, [0, 1], 2],
  ["fsolve", 1, [0, 1], 2],
  ["linsolve", 1, [0, 1], 2],
  ["limit", 1, [0, 1], 3],
  ["sum", 1, [0, 1], 4],
  ["product", 1, [0, 1], 4],
  ["seq", 1, [0, 1], 4],
  ["int", 1, [0, 1], 4], // only the definite form: int(x^2,x) reads the stored value (Giac evaluates the integrand)
  ["integrate", 1, [0, 1], 4],
];

/** Index where the body of an arrow that starts at `from` ends: the first top-level comma, the unmatched ) ] or }, or
 *  the end of `text`. */
function arrowBodyEnd(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      if (q < 0) return text.length;
      i = q;
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return i;
      depth--;
    } else if (c === "," && depth === 0) return i;
  }
  return text.length;
}

/** Replaces, in the places a name is bound, its occurrences by "_" so that `namesIn` skips them: a function's
 *  parameters in `f(x):=` and `x->` / `(x,y)->`, and the variable argument of the QUOTING commands. */
function maskBound(input: string): string {
  const mask = (text: string, vars: string[]): string =>
    text.replace(/"[^"]*"|([A-Za-z_][A-Za-z0-9_]*)/g, (m, id?: string) => (id && vars.includes(id) ? "_" : m));
  let out = input;
  // f(x,y):=body and (x,y)->body / x->body: the parameters are bound in the body (the head is not scanned: f is called).
  const fn = /^\s*[A-Za-z][A-Za-z0-9_]*\s*\(([^()]*)\)\s*:=([\s\S]*)$/.exec(out);
  if (fn) out = mask(fn[2]!, fn[1]!.split(",").map((v) => v.trim()));
  // Every arrow binds its parameters in its own body only: from the -> to the first top-level comma, the unmatched
  // ) or ], or the end of the input.
  const arrow = /(?:\(([^()]*)\)|([A-Za-z_][A-Za-z0-9_]*))\s*->/g;
  for (let m = arrow.exec(out); m; m = arrow.exec(out)) {
    const start = m.index + m[0].length;
    const end = arrowBodyEnd(out, start);
    // The parameter list itself is masked too; it is not a read of the stored value.
    const masked = mask(out.slice(m.index, end), (m[1] ?? m[2]!).split(",").map((v) => v.trim()));
    out = out.slice(0, m.index) + masked + out.slice(end);
    arrow.lastIndex = m.index + masked.indexOf("->") + 2; // a nested arrow in the body is found next
  }
  // A quoting command: its variable is bound in the arguments listed, not in the others (limit's point, a sum's bounds).
  for (const [cmd, vi, bindIn, min] of QUOTING) {
    const re = new RegExp(`\\b${cmd}\\s*\\(`, "g");
    for (let m = re.exec(out); m; m = re.exec(out)) {
      const open = m.index + m[0].length - 1;
      const close = matching(out, open);
      if (close < 0) continue;
      const args = splitTop(out.slice(open + 1, close));
      if (args.length < min) continue;
      const vars = namesIn(args[vi]!);
      const masked = args.map((a, i) => (bindIn.includes(i) ? mask(a, vars) : a));
      out = out.slice(0, open + 1) + masked.join(",") + out.slice(close);
    }
  }
  return out;
}

function matching(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && --depth === 0) return k;
  }
  return -1;
}

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(s.slice(start, k));
      start = k + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

/** `L[2]:=…`: an element of a stored list or matrix (the whole variable is what changes). */
function indexedTarget(input: string): string | null {
  const m = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\[[^\]]*\]\s*:=/.exec(input);
  return m ? m[1]! : null;
}

/** G49f4: the input defines a function for the mark facts: `f(x):=…`, or `f:=x->…` (definedBy reads that as a variable,
 *  which the Find items keep). */
function definesFunction(input: string): boolean {
  return definedBy(input)?.kind === "fn" || arrowFunction(input) !== null;
}

/** A log entry that holds a function: `f(x):=…`, or a variable set to an arrow (`f:=((x)->…)`, G49f4). */
function isFnEntry(e: DefEntry): boolean {
  return e.kind === "fn" || (e.kind === "var" && e.cmds.some((c) => arrowFunction(c) === e.name));
}

/** Facts that together cap a value: the fewest confirmed digits, the strongest warn, never exact (G49f1). Null when
 *  `all` is empty. */
function mergedFacts(all: readonly NameFacts[]): NameFacts | null {
  if (!all.length) return null;
  const capped = all.filter((f) => f.reliableDigits !== null).map((f) => f.reliableDigits!);
  const warn = all.some((f) => f.warn === "unaudited") ? "unaudited" : all.some((f) => f.warn === "unchecked") ? "unchecked" : undefined;
  return { reliableDigits: capped.length ? Math.min(...capped) : null, ...(warn ? { warn } : {}), inexact: true };
}

/** The shape of a numeric result (scalar, list, matrix), from its fields. */
function shapeOfResult(r: HomeResult): Shape {
  if (!r.items) return { kind: "scalar" };
  return r.shape ? { kind: "matrix", rows: r.shape[0], cols: r.shape[1] } : { kind: "list", n: r.items.length };
}

/** Engine state and the synchronous operations on it. One per Giac instance. */
export class EngineHost {
  private modeKey = "";
  private readonly giac: GiacApi;
  /** `giac.eval` that throws GiacSyntaxError instead of quietly returning `undef` (which would
   *  otherwise leave the previous answer in place and show it again). */
  private readonly strict: { eval(input: string): string };

  /** Our definitions already loaded into this Giac instance (ENGINE_DEFINITIONS, loaded on first use). */
  private readonly loaded = new Set<string>();
  /** UNIT_DEFINITIONS are loaded (the first units request). */
  private unitsLoaded = false;

  /** This engine's copy of the definitions log (defs.ts): what the user's names hold, and the mark facts of the
   *  variables that hold floats (decisions M4-7). */
  private log: DefEntry[] = [];
  private byName = new Map<string, DefEntry>();
  /** G49: the chips the current Home input holds by name (`pasr_<k>`), with the facts they lend (as a stored float's). */
  private chipFacts = new Map<string, NameFacts>();

  /** Loads the definitions `text` mentions that are not loaded yet. Called before every input reaches Giac. */
  need(text: string): void {
    for (const name of definitionsUsedBy(text)) {
      if (this.loaded.has(name)) continue;
      this.giac.eval(ENGINE_DEFINITIONS[name] ?? eseriesDefinition());
      this.loaded.add(name);
    }
  }

  constructor(giac: GiacApi) {
    this.giac = giac;
    // R64: our parser's text reads pasdeg in every angle; set before any input (the units, raw eval and replay paths
    // have no mode setup of their own)
    giac.eval(pasdegCommand("rad"));
    this.strict = {
      eval: (input) => {
        giac.clearMessages();
        const out = giac.eval(input);
        if (out === "undef") {
          const msg = giac.messages();
          if (/syntax error/.test(msg)) throw new GiacSyntaxError(msg.trim());
        }
        return out;
      },
    };
  }

  /** Replays definitions (a fresh engine: at init, or the stored log on first launch) and adds them to the log.
   *  Symbolic values first, while every name in them is still free (defs.ts). Returns the time it took. */
  restore(entries: readonly DefEntry[]): number {
    const t0 = performance.now();
    // G29: values and functions go to Giac REPLAY_BATCH at a time (`a:=1;b:=2;`), which halves the per-call cost.
    // Assumptions and inputs kept as typed go alone. A batch that printed an error or warning (not the `// Success` notes of functions) or returned an error is run again one command at a
    // time (values and functions can be set twice), so one bad entry never takes the entries after it down (G19).
    let batch: string[] = [];
    let names: string[] = [];
    const flush = (): void => {
      if (!batch.length) return;
      this.giac.clearMessages();
      const out = this.giac.eval(batch.join(";") + ";");
      // Any message or error result: a syntax error, or a reserved name that aborts the rest of the batch (`pi:=3`).
      if (batch.length > 1 && (/error|reserved word|not allowed/i.test(this.giac.messages()) || /^GIAC_ERROR/.test(out))) {
        // Errors only: a warning (`declared as global`) is no reason to run twice. The names are purged first, so a
        // rerun sees them as free again, as in the first run (G3: S:=(K*x+1) must not meet a K set by the aborted run).
        for (const n of names) this.giac.eval(`purge(${n})`);
        for (const c of batch) this.giac.eval(c);
      }
      batch = [];
      names = [];
    };
    for (const e of replayOrder(entries)) {
      const plain = (e.kind === "var" || e.kind === "fn") && e.cmds.length === 1 && balanced(e.cmds[0]!);
      for (const c of e.cmds) this.need(c); // a replayed definition may use one of ours
      if (plain) {
        batch.push(e.cmds[0]!);
        names.push(e.name);
        if (batch.length >= REPLAY_BATCH) flush();
      } else {
        flush();
        for (const c of e.cmds) this.giac.eval(c);
      }
    }
    flush();
    this.record(entries.map((e) => ({ set: e })));
    return performance.now() - t0;
  }

  private record(changes: readonly DefChange[]): void {
    if (!changes.length) return;
    this.log = applyDefChanges(this.log, changes);
    this.byName = new Map(this.log.filter((e) => e.kind !== "other").map((e) => [e.name, e]));
  }

  eval(input: string): { output: string; ok: boolean; engineMs: number; defs: DefChange[] } {
    this.need(input);
    const t0 = performance.now();
    const output = this.giac.eval(input);
    const ok = !isError(output);
    const defs = ok && isStateful(input) ? this.defsAfter(input, [input], output, null, "home", 12, undefined) : [];
    return { output, ok, engineMs: performance.now() - t0, defs };
  }

  /**
   * What a stateful input changed, as entries for the definitions log (defs.ts), recorded in this engine's copy too.
   * `ran`: the commands that redo it (kind "other" and functions); `facts`: the mark facts of the value it stored;
   * `angle`: the mode a variable was stored in (G34), recorded with it when known.
   */
  private defsAfter(input: string, ran: string[], preview: string, facts: NameFacts | null, view: "home" | "cas", digits: number, angle: "rad" | "deg" | undefined): DefChange[] {
    const base = { preview: dropAngleFactor(showExp(preview.trim())).slice(0, PREVIEW_MAX), view, time: Date.now() };
    const purge = /^\s*purge\s*\(([^()]*)\)\s*$/.exec(input);
    let changes: DefChange[];
    const names = purge ? purge[1]!.split(",").map((x) => x.trim()) : [];
    const assume = /^\s*(assume|additionally)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)/.exec(input);
    const asg = simpleAssignment(input);
    const target = asg && isStateful(asg.rhs) ? undefined : (definedBy(input) ?? (indexedTarget(input) ? { name: indexedTarget(input)!, kind: "var" as const } : undefined));
    // G48: `[a,b]:=…` and `a,b:=…` set each name as a variable, with the facts of the value stored.
    const list = target ? null : storeTargets(input);
    const many = list && (list.form === "[]:=" || list.form === ",:=") && !isStateful(list.read) ? list.names : null;
    if (purge && names.length && names.every((n) => IDENT_NAME.test(n))) changes = [{ purge: names }];
    else if (assume) {
      const name = assume[2]!;
      const prev = this.byName.get(name);
      const cmds = assume[1] === "additionally" && prev?.kind === "assume" ? [...prev.cmds, ...ran] : ran;
      changes = [{ set: { name, kind: "assume", cmds, ...base } }];
    } else if (target?.kind === "fn") changes = [{ set: { name: target.name, kind: "fn", cmds: ran, ...(facts ? { facts } : {}), ...base } }];
    else if (target?.kind === "var") {
      const snap = this.snapshot(target.name, digits);
      changes = snap
        ? [{ set: { name: target.name, kind: "var", cmds: [snap.cmd], ...storedFacts(facts, snap.float), ...base, ...(snap.early ? { early: true } : {}), ...(angle ? { angle } : {}) } }]
        : [{ purge: [target.name] }];
    } else if (many) {
      changes = many.map((name): DefChange => {
        const snap = this.snapshot(name, digits);
        return snap
          ? { set: { name, kind: "var", cmds: [snap.cmd], ...storedFacts(facts, snap.float), ...base, ...(snap.early ? { early: true } : {}), ...(angle ? { angle } : {}) } }
          : { purge: [name] };
      });
    } else changes = [{ set: { name: "", kind: "other", cmds: ran, ...base } }];
    this.record(changes);
    return changes;
  }

  /**
   * A variable's value as a command that sets it again: `B:=(<value>)`, floats as `evalf(<exact>,k)` with the digits
   * they print with (doubles: 14). `early`: the value has names in it, so it must be set before any of them is.
   * Null when the name holds nothing.
   */
  private snapshot(name: string, digits: number): { cmd: string; float: boolean; early: boolean } | null {
    const t = withDigits(this.giac, DOUBLE_DIGITS, digits, () => this.giac.eval(name)).trim();
    if (t === "" || t === name || isError(t)) return null;
    const float = hasFloat(t);
    const early = namesIn(t).some((n) => !CONSTANT_NAMES.has(n));
    return { cmd: `${name}:=(${float ? floatsAsEvalf(t) : t})`, float, early };
  }

  /**
   * Decisions M4-7: a numeric result computed from stored variables that hold floats (or inexact values, G49), or from
   * chips named in the input (G49), inherits their facts. Its
   * confirmed digits are at most theirs, its warn is theirs, and it is never exact; when the input can be run again
   * (`expr`, decimals exact) and is more than the bare name, it is checked once more with each variable moved in its
   * last confirmed digit, which catches a cancellation (B-0.7468 with B known to 13 digits).
   */
  private inherited(r: HomeResult, input: string, expr: string | null, digits: number, restoreDigits: number): HomeResult {
    if (!r.ok || (!r.value && !r.items)) return r;
    // G49f1, G49f3: a called function lends the facts it stored and those of the names its body holds now (it is never
    // moved).
    const seen = new Set<string>();
    const called = functionsIn(input).flatMap((name) => {
      const facts = this.callFacts(name, seen);
      return facts ? [{ name, facts, fn: true }] : [];
    });
    // G49f4: an arrow function named without a call (passed on) lends its facts too, and is never moved.
    const used = namesIn(input)
      .map((name) => {
        const e = this.byName.get(name);
        if (e && isFnEntry(e)) return { name, facts: this.callFacts(name, seen) ?? undefined, fn: true };
        return { name, facts: e?.facts ?? this.chipFacts.get(name), fn: false };
      })
      .filter((u): u is { name: string; facts: NameFacts; fn: boolean } => u.facts !== undefined)
      .concat(called);
    if (!used.length) return r;
    const P = valuePrecision(digits);
    const els = r.items ?? [r];
    const cap = used.reduce((n, u) => (u.facts.reliableDigits === null ? n : Math.min(n, u.facts.reliableDigits)), P);
    const warn = used.some((u) => u.facts.warn === "unaudited") ? "unaudited" : used.some((u) => u.facts.warn === "unchecked") ? "unchecked" : undefined;
    const moved = used.filter((u) => !u.fn && u.facts.reliableDigits !== null).map((u) => ({ name: u.name, n: u.facts.reliableDigits! }));
    const shape = shapeOfResult(r);
    let pert: number[] | null | undefined;
    let once = false;
    if (expr !== null && moved.length && !IDENT_NAME.test(expr.trim())) {
      pert = perturbedDigits(this.giac, expr, shape, els.map((e) => e.value!), moved, digits, restoreDigits);
    }
    const facts: ElementFacts[] = els.map((e, k) => {
      let n = Math.min(e.reliableDigits ?? P, cap);
      if (pert) n = Math.min(n, pert[k]!);
      const w = warn ?? e.warn ?? (pert === null ? "unchecked" : undefined);
      if (pert === null && !warn && !e.warn) once = true;
      return { value: e.value!, exactRational: false, reliableDigits: n, ...(w ? { warn: w } : {}), big: false };
    });
    const b = resultFromFacts(facts, shape, digits, r.path, true, r.totalMs);
    // Only the names behind a ⚠: one with a warning, or one known to fewer digits than the setting shows.
    const lost = pert ? pert.some((d) => d < digits) : false;
    const causes = used
      .filter((u) => u.facts.warn !== undefined || (u.facts.reliableDigits !== null && (u.facts.reliableDigits < digits || lost)))
      .map((u) => u.name);
    const why = { ...(r.why ?? {}), ...(causes.length ? { inherited: causes } : {}), ...(once ? { once: true as const } : {}) };
    return {
      ...b,
      ...(Object.keys(why).length ? { why } : {}),
      ...(r.exact !== undefined ? { exact: r.exact } : {}),
      ...(r.defined ? { defined: r.defined } : {}),
      ...(r.digits !== undefined ? { digits: r.digits } : {}),
      exactMs: r.exactMs,
    };
  }

  /**
   * G49f1: the facts a function keeps when its definition `input` held an inexact chip or constant (`lent`, put in as
   * values), or its body names a stored variable or calls a function that has facts: not limited in digits unless
   * those names cap it, their warn, and never exact. Null when nothing in it is inexact.
   */
  private fnFacts(input: string, lent: readonly NameFacts[]): NameFacts | null {
    const def = definedBy(input)?.name;
    return mergedFacts([...lent, ...this.bodyFacts(input, def, new Set(def ? [def] : []))]);
  }

  /**
   * G48 (rule 2): the facts a stored name takes. A store in any form (`:=`, `[a,b]:=`, `a,b:=`, `=>`, `sto`, `L[k]:=`)
   * keeps at least the weakest facts of the names and chips (`lent`) its input read, whatever the value prints as, a
   * function from `unapply` included (a call inherits them, as for a fn entry). `own`: the facts of the stored value.
   */
  private storeFacts(input: string, own: NameFacts | null, lent: readonly NameFacts[]): NameFacts | null {
    const t = storeTargets(input);
    if (!t) return own;
    const read = [...lent, ...this.bodyFacts(t.read, undefined, new Set())];
    return read.length ? mergedFacts([...(own ? [own] : []), ...read]) : own;
  }

  /** G49f3: the facts of the names a definition's body (`input`, its parameters masked) holds now: stored variables
   *  with facts, and called functions by `callFacts`. `def` (the function itself) is skipped; `seen` ends recursion. */
  private bodyFacts(input: string, def: string | undefined, seen: Set<string>): NameFacts[] {
    const body = maskBound(input);
    const vars = namesIn(body).flatMap((n) => {
      const e = this.byName.get(n);
      if (n === def || !e) return [];
      const f = isFnEntry(e) ? this.callFacts(n, seen) : e.facts;
      return f ? [f] : [];
    });
    const fns = functionsIn(body).flatMap((n) => {
      const f = n === def ? null : this.callFacts(n, seen);
      return f ? [f] : [];
    });
    return [...vars, ...fns];
  }

  /**
   * G51: the facts a CAS result without a float takes from what its input read: the stored variables with facts its
   * (bound names masked) text holds and the functions with facts it calls or names (`callFacts`), merged. `causes`: the
   * names behind a warn (for why.inherited). Null when nothing it read is inexact, and for inputs that store no value
   * (a function definition, purge, assume): those read names without showing a value from them.
   */
  private readFacts(input: string): { facts: NameFacts; causes: string[] } | null {
    if (definesFunction(input) || /^\s*(purge|assume|additionally)\s*\(/.test(input)) return null;
    const body = maskBound(storeTargets(input)?.read ?? input);
    const seen = new Set<string>();
    const read = new Map<string, NameFacts>();
    for (const n of [...namesIn(body), ...functionsIn(body)]) {
      const e = this.byName.get(n);
      if (!e || read.has(n)) continue;
      const f = isFnEntry(e) ? this.callFacts(n, seen) : e.facts;
      if (f) read.set(n, f);
    }
    const facts = mergedFacts([...read.values()]);
    if (!facts) return null;
    return { facts, causes: [...read].filter(([, f]) => f.warn !== undefined).map(([n]) => n) };
  }

  /** G49f3: the facts a call to the stored function `name` lends: the facts its entry stored at definition (chips and
   *  constants lent then) merged with those of the names its body holds now. Null when it is no function (`f(x):=` or
   *  an arrow, G49f4), already visited (`seen`), or nothing in it is inexact. */
  private callFacts(name: string, seen: Set<string>): NameFacts | null {
    const e = this.byName.get(name);
    if (!e || !isFnEntry(e) || seen.has(name)) return null;
    seen.add(name);
    const cmd = e.cmds.find((c) => definedBy(c)?.name === name || arrowFunction(c) === name) ?? e.cmds[0];
    return mergedFacts([...(e.facts ? [e.facts] : []), ...(cmd !== undefined ? this.bodyFacts(cmd, name, seen) : [])]);
  }

  /** The mark facts a variable keeps when it is set from result `r` (decisions M4-7). A value carried as its decimal
   *  (G34) is known to every digit it carries: the result's confirmed digits, at most P = valuePrecision(digits). */
  private static factsOf(r: HomeResult | undefined, digits: number): NameFacts | null {
    if (!r || !r.ok) return null;
    if (r.carried === "decimal") return { reliableDigits: r.reliableDigits ?? valuePrecision(digits), ...(r.warn ? { warn: r.warn } : {}) };
    if (!r.value && !r.items) return { reliableDigits: null, warn: "unchecked" }; // a symbolic value with a float in it
    return { reliableDigits: r.reliableDigits, ...(r.warn ? { warn: r.warn } : {}) };
  }

  /**
   * `consts` (G26): the constants the input holds by name (`pasc_<id>`) with their values and uncertainties. The
   * values are put in and the input evaluates as without the table; a numeric result from an inexact constant then
   * carries `uncDigits` (constUnc.ts). `chips` (G49): the chips it holds by name (`pasr_<k>`, chipFacts.ts). An exact
   * chip is put in as its value; any other is a Giac variable for this run, and its facts pass on as a stored float's
   * (M4-7). An input kept as typed in the log (`f(x):=…`, `a,b:=…`) gets every chip as its value, since the name
   * would outlive the run. A value stored from an input with an inexact constant or chip keeps `inexact` facts.
   * Without the tables, nothing changes.
   */
  home(input: string, s: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): { result: HomeResult; defs: DefChange[] } {
    if (!consts && !chips) return this.homeRun(input, s, false);
    const asg = simpleAssignment(input);
    const stateful = isStateful(input);
    const held = chips ? chipsIn(input, chips) : [];
    const keep = new Set(stateful && definedBy(input)?.kind !== "var" ? [] : held.filter((k) => !chips![k]!.exact));
    const named = chips ? withChipValues(input, chips, keep) : input;
    // G49f1: the facts an inexact chip or constant lends to a function defined from it (its value is put in).
    const lent: NameFacts[] = [
      ...held.filter((k) => !chips![k]!.exact).map((k) => chipNameFacts(chips![k]!)),
      ...(consts !== undefined && inexactConstsIn(input, consts).length > 0 ? [{ reliableDigits: null, inexact: true as const }] : []),
    ];
    const inexactIn = lent.length > 0;
    for (const k of keep) {
      this.giac.eval(chipCommand(k, chips![k]!));
      this.chipFacts.set(`${CHIP_PREFIX}${k}`, chipNameFacts(chips![k]!));
    }
    try {
      const out = this.homeRun(consts ? withConstValues(named, consts) : named, s, inexactIn, lent);
      if (!consts || (stateful && !asg)) return out;
      const body = asg ? simpleAssignment(named)!.rhs : named;
      const n = constUncDigits(this.giac, body, consts, out.result, Math.trunc(out.result.digits ?? s.digits));
      return n === undefined ? out : { ...out, result: { ...out.result, uncDigits: n } };
    } finally {
      if (keep.size) this.giac.eval(`purge(${[...keep].map((k) => CHIP_PREFIX + k).join(",")})`);
      this.chipFacts.clear();
    }
  }

  private homeRun(typed: string, s: HomeSettings, inexactIn: boolean, lent: readonly NameFacts[] = []): { result: HomeResult; defs: DefChange[] } {
    const out = this.homeRunRaw(typed, s, inexactIn, lent);
    return { ...out, result: showExpResult(out.result) };
  }

  /** `inexactIn` (G49): the input held a constant or chip that is not exact, so a value it stores is not exact.
   *  `lent` (G49f1): the facts of those chips and constants, for a function defined from them. */
  private homeRunRaw(typed: string, s: HomeSettings, inexactIn: boolean, lent: readonly NameFacts[]): { result: HomeResult; defs: DefChange[] } {
    const input = expIgnoresAngle(typed, s.angle);
    this.need(input);
    this.useHomeMode(s);
    const t0 = performance.now();
    let result: HomeResult;
    try {
      result = homeEval(this.strict, input, s);
    } catch (e) {
      if (!(e instanceof GiacSyntaxError)) throw e;
      const ms = performance.now() - t0;
      return {
        result: { ok: false, display: e.message, path: "float-error", approximate: false, tieRisk: false, exactMs: ms, totalMs: ms, error: "syntax", ...safePrecision(e.message) },
        defs: [],
      };
    }
    if (!result.ok) return { result: { ...result, error: result.error ?? "engine" }, defs: [] };
    // M4-7: a value computed from stored floats keeps their marks. An assignment's right side is what ran; a
    // self-reference (B:=B*2) already overwrote B, and other stateful inputs cannot run again, so neither is moved.
    const asg = simpleAssignment(input);
    const body = asg ? asg.rhs : input;
    const rerun = (asg ? !namesIn(asg.rhs).includes(asg.name) : !isStateful(input)) && !callsStateful(this.strict, body);
    result = this.inherited(result, body, rerun ? toExactLiterals(body) : null, Math.trunc(s.digits), Math.trunc(s.digits));
    let defs: DefChange[] = [];
    if (isStateful(input)) {
      // Replay the form that actually ran: exact for the exact paths, floats for the fallbacks.
      const ran =
        result.path === "exact" || result.path === "exact-big"
          ? [toExactLiterals(input)]
          : [`Digits:=${s.workDigits}`, input, `Digits:=${s.digits}`];
      // G49: an inexact input, or a result shown with ⚠ (G38's decision that did not hold), stores a value that is not
      // exact even when it prints as an exact rational.
      const fn = definesFunction(input);
      const facts = fn ? this.fnFacts(input, lent) : EngineHost.factsOf(result, Math.trunc(s.digits));
      const inexact = !fn && facts !== null && (inexactIn || result.warn !== undefined);
      // G48: a symbolic value's facts count only when they say it is not exact (a float in it, a ⚠).
      const own = inexact ? { ...facts, inexact: true as const } : result.value || result.items ? facts : null;
      defs = this.defsAfter(input, ran, result.display, fn ? facts : this.storeFacts(input, own, lent), "home", Math.trunc(s.digits), s.angle);
    }
    return { result, defs };
  }

  /** The stored variables a CAS input reads (F28): names in it that the log holds as values, except the names the
   *  input binds (see `maskBound`). An assignment lists its own target when its right side reads it (`x:=x+1`).
   *  Taken before the input runs, since it may change the log. */
  private usesOf(input: string): NonNullable<CasResult["uses"]> {
    const asg = simpleAssignment(input);
    const def = asg ? undefined : definedBy(input);
    const target = asg ? undefined : (def?.name ?? indexedTarget(input));
    // G48: the names a list assignment sets are not read either.
    const set = asg ? [] : (storeTargets(input)?.names ?? []);
    const text = asg ? asg.rhs : input;
    return namesIn(maskBound(text))
      .filter((n) => n !== target && !set.includes(n))
      .flatMap((n) => {
        const e = this.byName.get(n);
        return e?.kind === "var" ? [{ name: n, preview: e.preview, view: e.view }] : [];
      });
  }

  cas(input: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    const used = this.usesOf(input);
    const out = this.casRun(input, s);
    if (used.length && out.result.ok) out.result.uses = used;
    return out;
  }

  private casRun(typed: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    const out = this.casRunRaw(typed, s);
    const r = out.result;
    const result: CasResult = { ...r, text: showExp(r.text), latex: showExp(r.latex) };
    if (r.numeric) result.numeric = showExpResult(r.numeric);
    return { ...out, result };
  }

  private casRunRaw(typed: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    const input = expIgnoresAngle(typed, s.angle);
    this.need(input);
    this.useMode(`cas${JSON.stringify(s)}`, () => {
      for (const c of casSetupCommands(s)) this.giac.eval(c);
      this.giac.setPowLimit(s.powLimit);
    });
    const t0 = performance.now();
    const fail = (text: string, error: CasError): { result: CasResult; defs: DefChange[] } => ({
      result: { ok: false, text, latex: "", timedOut: error === "timeout", error, engineMs: performance.now() - t0 },
      defs: [],
    });
    // P9 (docs/04 section 2.9): typed decimals are exact rationals, as in Home; approx() gives decimals.
    const exactInput = toExactLiterals(input);
    const test = input.includes(EQ_INEXACT_FLAG);
    if (test) this.giac.eval(`purge(${EQ_INEXACT_FLAG},${EQ_DIFF})`);
    // G39: `a:=sum(cos(k),k,1,inf)` must store nothing when its value is refused, so an assignment whose value holds a
    // definite integral, a series or a limit runs its right-hand side first, is checked, and only then stored.
    const asg0 = simpleAssignment(exactInput);
    const guarded = asg0 && !isStateful(asg0.rhs) && callsIn(asg0.rhs).length ? asg0 : null;
    // G38 (docs/04 2.4 rule 2): Giac decides signs, comparisons and floor at Digits, so the evaluation runs at P; the
    // mode's Digits stays the setting, which prints the floats of a non-number.
    const digitsSet = Math.trunc(s.digits);
    const body = guarded ? guarded.rhs : exactInput;
    const run = (): string => withDigits(this.giac, valuePrecision(digitsSet), digitsSet, () => this.strict.eval(`pcasans:=(${body})`));
    let text: string;
    try {
      text = run();
    } catch (e) {
      if (e instanceof GiacSyntaxError) return fail(e.message, "syntax");
      throw e;
    }
    if (isError(text)) return fail(text, isTimeout(text) ? "timeout" : "engine");
    const stateful = isStateful(input);
    // A call to a stored function that stores (inc(x):={c:=c+1;c}) must not run again either, assigned or not.
    const storing = callsStateful(this.giac, input);
    const single = stateful || storing;
    // An == or ≠ test on a float side: decided by its own digits, as in Home (R18f2).
    const inexactTest = test && this.giac.eval(EQ_INEXACT_FLAG) === "1";
    const decided = inexactTest && !single ? decideFloatTest(this.giac, exactInput, digitsSet) : null;
    if (decided) {
      text = run();
      this.giac.eval(`purge(${EQ_VERDICT})`);
    }
    // G38: a result that rests on a numeric decision is decided again at P + 20 (and P + 40), as in Home; an exact
    // == or ≠ test too, only one with a float side is decideFloatTest's.
    // A plain name:=value decides its value (the right-hand side) and stores the agreed one, as Home does; other
    // stateful inputs (f(x):=…, purge, assume, =>) must not run twice.
    const asg = simpleAssignment(input);
    const once = (!asg && stateful) || storing;
    // G48: an input that runs once and rests on a decision is ⚠, as in Home (it cannot be decided again).
    let undecided = once && !inexactTest && onceUndecided(this.giac, input, exactInput, text);
    const decisionExpr = asg ? toExactLiterals(asg.rhs) : exactInput;
    if (!once && !inexactTest && !hasFloat(text) && restsOnDecision(decisionExpr, text, notBuiltin(this.giac))) {
      const d = decideTwice(this.giac, decisionExpr, text, digitsSet, digitsSet);
      if ("undecided" in d) undecided = true;
      if (!("undecided" in d) && d.from !== undefined) {
        this.giac.eval(`pcasans:=${d.from}`);
        if (asg && !guarded) this.giac.eval(`${asg.name}:=pcasans`);
        text = d.text;
      }
      this.giac.eval("purge(pasdec2)");
    }
    // G39: a divergent integral or series, or no limit, is refused as in Home; Giac's [exact, numeric] pair of a
    // definite integral is shown as Giac's text (both answers) with ⚠, never as a numeric list.
    const refused = guarded ? refusalOf(this.giac, guarded.rhs, text, s.angle) : single ? null : refusalOf(this.giac, exactInput, text, s.angle);
    if (refused && refused !== "unchecked") return fail(enEngine[`error.${refused}`], refused);
    if (guarded) {
      const stored = this.giac.eval(`${guarded.name}:=pcasans`);
      if (isError(stored)) return fail(stored, isTimeout(stored) ? "timeout" : "engine");
    }
    // A check that could not finish: the result stands with ⚠ (its numeric facts, or the text's mark).
    const unverified = refused === "unchecked";
    const pair = !single && hasDefiniteIntegral(exactInput) && giacPair(text) !== null;
    // G49f3: a function defined here keeps the facts of the names its body holds, as in Home (fnFacts).
    const defsOf = (preview: string, facts: NameFacts | null): DefChange[] =>
      stateful
        ? this.defsAfter(input, [exactInput], preview, definesFunction(input) ? this.fnFacts(input, facts ? [facts] : []) : this.storeFacts(input, facts, []), "cas", Math.trunc(s.digits), s.angle)
        : [];
    // A number with a float in it: checked like Home (the value as `numeric`, its text and LaTeX from our formatter).
    // `evalf(e,n)` alone is shown with the n digits it asks for, checked at that precision (decisions M4-6).
    const shape = hasFloat(text) && !pair ? shapeOf(text) : null;
    if (shape) {
      const asked = askedDigits(input);
      const digits = asked ?? Math.trunc(s.digits);
      const facts = floatFacts(this.giac, "pcasans", single ? null : exactInput, shape, digits, Math.trunc(s.digits), exactInput);
      if (facts) {
        let numeric = resultFromFacts(facts, shape, digits, "numeric", true, performance.now() - t0);
        if (unverified) numeric.warn = numeric.warn ?? "unchecked";
        if (asked !== null) numeric.digits = asked;
        const body = asg ? asg.rhs : input;
        const why = whyOf(facts, single ? null : exactInput);
        if (why) numeric.why = why;
        numeric = this.inherited(numeric, body, single ? null : exactInput, digits, Math.trunc(s.digits));
        return {
          result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric },
          defs: defsOf(numeric.display, EngineHost.factsOf(numeric, Math.trunc(s.digits))),
        };
      }
    }
    // G38: a float in a non-number prints with the precision it was computed at (P). pcasans keeps the P result; the
    // text prints its floats at the setting (floatsShown), never by running the input again (that redid decisions).
    const atN = hasFloat(text) ? floatsShown(this.giac, text, digitsSet, "pasfl") : null;
    const slot = atN === null ? "pcasans" : "pasfl";
    if (atN !== null) text = atN;
    // This build leaves x*x unevaluated (no top-level "regroup" autosimplify), and latex() then draws x·x as "xx".
    if (text.includes("*")) text = regrouped(this.giac, slot, text);
    // An == or ≠ test on a side with a float in it (input/emit.ts equalityTest): its true or false is approximate.
    // A float in a non-number (x-0.54764225985): nobody checked its digits, so ⚠ without a count (G27, docs/04 2.4),
    // as the definitions log records it.
    const unchecked = hasFloat(text) || undecided || unverified;
    // G51: a result without a float that read a stored name, or called a function, with facts takes their warn and
    // why.inherited, as `inherited` does for a number; one built from exact names stays unmarked.
    const read = this.readFacts(input);
    const approximate = (test && this.giac.eval(EQ_INEXACT_FLAG) === "1") || unchecked || read !== null;
    const own = decided?.warn ?? (unchecked ? "unchecked" : undefined);
    const warn = own === "unaudited" || read?.facts.warn === "unaudited" ? "unaudited" : (own ?? read?.facts.warn);
    const symWhy = symbolicWhy(own, testSides(exactInput));
    // G38: "decided at limited precision"; the value was computed, not compared, so `once` is not said.
    const why0 = pair ? { differ: true } : undecided ? { ...(symWhy && !symWhy.once ? symWhy : {}), decided: true } : symWhy;
    const why = read?.causes.length ? { ...(why0 ?? {}), inherited: read.causes } : why0;
    const tex = latexShown(this.giac, slot, text);
    if (atN !== null) this.giac.eval("purge(pasfl)");
    if (isError(tex)) return fail(tex, isTimeout(tex) ? "timeout" : "engine");
    return {
      result: { ok: true, text, latex: unquote(tex), timedOut: false, engineMs: performance.now() - t0, ...(approximate ? { approximate } : {}), ...(warn ? { warn } : {}), ...(why ? { why } : {}) },
      defs: defsOf(text, unchecked ? { reliableDigits: null, warn: "unchecked", inexact: true } : null),
    };
  }

  solve(req: SolveRequest, s: HomeSettings): SolveOutcome {
    this.need(JSON.stringify(req));
    this.useSolveMode(s);
    return solveRequest(this.giac, req, s);
  }

  unknowns(equations: string[]): string[] {
    return unknownsOf(this.giac, equations);
  }

  analyze(req: AnalysisRequest, s: HomeSettings): AnalysisResult {
    this.need(JSON.stringify(req));
    this.useSolveMode(s);
    return analyze(this.giac, req, s);
  }

  /** The unit view (G16, docs/04 4.2): in Home's mode (angle, budget, digits), with our unit definitions loaded on the
   *  first request. A syntax error or a timeout is an engine error, never a value. */
  units(job: UnitJob, s: HomeSettings): Quantity | UnitError {
    if (!this.unitsLoaded) {
      for (const d of UNIT_DEFINITIONS) this.giac.eval(d);
      this.unitsLoaded = true;
    }
    this.useHomeMode(s);
    try {
      return unitEval(this.strict, job, s);
    } catch (e) {
      if (e instanceof GiacSyntaxError) return { error: "engine", detail: e.message };
      throw e;
    }
  }

  /** Num table cells are Home evaluations, in Home mode (same budget per cell). */
  table(req: TableRequest, s: HomeSettings): HomeResult[][] {
    this.need(JSON.stringify(req));
    this.useHomeMode(s);
    return table(this.giac, req, s);
  }

  private useHomeMode(s: HomeSettings): void {
    this.useMode(`home${JSON.stringify(s)}`, () => {
      for (const c of homeSetupCommands(s)) this.giac.eval(c);
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useSolveMode(s: HomeSettings): void {
    this.useMode(`solve${JSON.stringify(s)}`, () => {
      this.giac.eval(angleCommand(s.angle));
      this.giac.eval(`timeout ${SOLVE_HARD_TIMEOUT_S}`);
      this.giac.eval("ckevery 10");
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useMode(key: string, apply: () => void): void {
    if (key === this.modeKey) return;
    apply();
    this.modeKey = key;
  }
}

/** The facts a stored variable keeps (M4-7, G49): a float's as they are (its value shows it is not exact), a value that
 *  prints exactly only when they say it is not exact. */
function storedFacts(facts: NameFacts | null, float: boolean): { facts?: NameFacts } {
  if (!facts) return {};
  if (!float) return facts.inexact ? { facts } : {};
  const { inexact: _, ...rest } = facts;
  return { facts: rest };
}

/** Commands per Giac call in a replay (G29; tools/probes/replay-cost.mjs: 10–50 are as fast, 200 in one call is not). */
export const REPLAY_BATCH = 25;

/** Brackets and quotes pair up: a command with a stray one would swallow what follows it in a batch. */
function balanced(cmd: string): boolean {
  let depth = 0;
  let quote = false;
  for (const ch of cmd) {
    if (ch === '"') quote = !quote;
    else if (quote) continue;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") if (--depth < 0) return false;
  }
  return depth === 0 && !quote;
}

/** G24: a failed allocation reaches us as a C++ exception (`WebAssembly.Exception`, from `new`) or as an abort
 *  (GMP, or the heap at its cap). The engine is not trusted after either: the client restarts it. */
function isMemoryFailure(e: unknown): boolean {
  if (typeof WebAssembly !== "undefined" && "Exception" in WebAssembly && e instanceof (WebAssembly as unknown as { Exception: new () => object }).Exception) return true;
  return /\bOOM\b|out of memory|cannot enlarge memory|^Aborted/i.test(e instanceof Error ? e.message : String(e));
}

/** Builds the message handler used by the worker: init loads Giac, then requests go to EngineHost. */
export function createRequestHandler(load: GiacLoader, post: (r: Response) => void): (req: Request) => Promise<void> {
  // Calls that arrive while init is still loading the engine wait for it, in arrival order (a Plot
  // view restored at launch asks for the trace before the engine is up).
  let starting: Promise<EngineHost> | null = null;
  return async (req) => {
    try {
      if (req.type === "init") {
        starting = (async () => {
          const loaded = await load(req.baseUrl);
          const t1 = performance.now();
          loaded.giac.eval("0");
          const host = new EngineHost(loaded.giac);
          const t2 = performance.now();
          const replayMs = host.restore(req.replay);
          post({ id: req.id, type: "ready", instantiateMs: loaded.instantiateMs, initMs: t2 - t1, replayMs });
          return host;
        })();
        await starting;
        return;
      }
      if (!starting) throw new Error("engine not initialised");
      const host = await starting;
      switch (req.type) {
        case "define":
          post({ id: req.id, type: "defined", replayMs: host.restore(req.defs) });
          break;
        case "eval":
          post({ id: req.id, type: "result", ...host.eval(req.input) });
          break;
        case "home":
          post({ id: req.id, type: "home", ...host.home(req.input, req.settings, req.consts, req.chips) });
          break;
        case "cas":
          post({ id: req.id, type: "cas", ...host.cas(req.input, req.settings) });
          break;
        case "solve":
          post({ id: req.id, type: "solve", result: host.solve(req.req, req.settings) });
          break;
        case "unknowns":
          post({ id: req.id, type: "unknowns", result: host.unknowns(req.equations) });
          break;
        case "analyze":
          post({ id: req.id, type: "analyze", result: host.analyze(req.req, req.settings) });
          break;
        case "table":
          post({ id: req.id, type: "table", result: host.table(req.req, req.settings) });
          break;
        case "units":
          post({ id: req.id, type: "units", result: host.units(req.job, req.settings) });
          break;
      }
    } catch (e) {
      post({ id: req.id, type: "fatal", message: e instanceof Error ? e.message : String(e), ...(isMemoryFailure(e) ? { memory: true as const } : {}) });
    }
  };
}
