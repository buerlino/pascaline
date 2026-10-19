// SPDX-License-Identifier: GPL-3.0-or-later
// The engine side of the protocol: one Giac instance, synchronous calls. Runs inside the Web
// Worker (giac.worker.ts) and, for tests and the golden runner, directly in Node. Knows nothing
// about the UI. Only erasable TypeScript syntax, so Node runs this file directly.
import type { Request, Response } from "./protocol.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";
import {
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
  isStateful,
  regrouped,
  resultFromFacts,
  safePrecision,
  symbolicWhy,
  testSides,
  showExp,
  showExpResult,
  simpleAssignment,
  toExactLiterals,
  unquote,
} from "./homeEval.ts";
import { eseriesDefinition } from "./eseries.ts";
import { giacPair, hasDefiniteIntegral, refusalOf } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { askedDigits, DOUBLE_DIGITS, floatFacts, hasFloat, namesIn, numberLatex, perturbedDigits, shapeOf, valuePrecision, whyOf, withDigits, type ElementFacts, type Shape } from "./numeric.ts";
import { applyDefChanges, PREVIEW_MAX, replayOrder, type DefChange, type DefEntry, type NameFacts } from "./defs.ts";
import { SOLVE_HARD_TIMEOUT_S, solveRequest, unknownsOf } from "./solve.ts";
import { analyze, table } from "./analysis.ts";
import { UNIT_DEFINITIONS, unitEval } from "../units/evaluate.ts";
import { constUncDigits, withConstValues, type ConstTable } from "./constUnc.ts";
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
    `angle_radian:=${s.angle === "rad" ? 1 : 0}`,
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
    const base = { preview: showExp(preview.trim()).slice(0, PREVIEW_MAX), view, time: Date.now() };
    const purge = /^\s*purge\s*\(([^()]*)\)\s*$/.exec(input);
    let changes: DefChange[];
    const names = purge ? purge[1]!.split(",").map((x) => x.trim()) : [];
    const assume = /^\s*(assume|additionally)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)/.exec(input);
    const asg = simpleAssignment(input);
    const target = asg && isStateful(asg.rhs) ? undefined : (definedBy(input) ?? (indexedTarget(input) ? { name: indexedTarget(input)!, kind: "var" as const } : undefined));
    if (purge && names.length && names.every((n) => IDENT_NAME.test(n))) changes = [{ purge: names }];
    else if (assume) {
      const name = assume[2]!;
      const prev = this.byName.get(name);
      const cmds = assume[1] === "additionally" && prev?.kind === "assume" ? [...prev.cmds, ...ran] : ran;
      changes = [{ set: { name, kind: "assume", cmds, ...base } }];
    } else if (target?.kind === "fn") changes = [{ set: { name: target.name, kind: "fn", cmds: ran, ...base } }];
    else if (target?.kind === "var") {
      const snap = this.snapshot(target.name, digits);
      changes = snap
        ? [{ set: { name: target.name, kind: "var", cmds: [snap.cmd], ...(snap.float && facts ? { facts } : {}), ...base, ...(snap.early ? { early: true } : {}), ...(angle ? { angle } : {}) } }]
        : [{ purge: [target.name] }];
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
   * Decisions M4-7: a numeric result computed from stored variables that hold floats inherits their facts. Its
   * confirmed digits are at most theirs, its warn is theirs, and it is never exact; when the input can be run again
   * (`expr`, decimals exact) and is more than the bare name, it is checked once more with each variable moved in its
   * last confirmed digit, which catches a cancellation (B-0.7468 with B known to 13 digits).
   */
  private inherited(r: HomeResult, input: string, expr: string | null, digits: number, restoreDigits: number): HomeResult {
    if (!r.ok || (!r.value && !r.items)) return r;
    const used = namesIn(input)
      .map((name) => ({ name, facts: this.byName.get(name)?.facts }))
      .filter((u): u is { name: string; facts: NameFacts } => u.facts !== undefined);
    if (!used.length) return r;
    const P = valuePrecision(digits);
    const els = r.items ?? [r];
    const cap = used.reduce((n, u) => (u.facts.reliableDigits === null ? n : Math.min(n, u.facts.reliableDigits)), P);
    const warn = used.some((u) => u.facts.warn === "unaudited") ? "unaudited" : used.some((u) => u.facts.warn === "unchecked") ? "unchecked" : undefined;
    const moved = used.filter((u) => u.facts.reliableDigits !== null).map((u) => ({ name: u.name, n: u.facts.reliableDigits! }));
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
   * carries `uncDigits` (constUnc.ts). Without the table, nothing changes.
   */
  home(input: string, s: HomeSettings, consts?: ConstTable): { result: HomeResult; defs: DefChange[] } {
    if (!consts) return this.homeRun(input, s);
    const named = input;
    const out = this.homeRun(withConstValues(input, consts), s);
    const asg = simpleAssignment(named);
    if (isStateful(named) && !asg) return out;
    const n = constUncDigits(this.giac, asg ? asg.rhs : named, consts, out.result, Math.trunc(out.result.digits ?? s.digits));
    return n === undefined ? out : { ...out, result: { ...out.result, uncDigits: n } };
  }

  private homeRun(typed: string, s: HomeSettings): { result: HomeResult; defs: DefChange[] } {
    const out = this.homeRunRaw(typed, s);
    return { ...out, result: showExpResult(out.result) };
  }

  private homeRunRaw(typed: string, s: HomeSettings): { result: HomeResult; defs: DefChange[] } {
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
    const rerun = asg ? !namesIn(asg.rhs).includes(asg.name) : !isStateful(input);
    result = this.inherited(result, body, rerun ? toExactLiterals(body) : null, Math.trunc(s.digits), Math.trunc(s.digits));
    let defs: DefChange[] = [];
    if (isStateful(input)) {
      // Replay the form that actually ran: exact for the exact paths, floats for the fallbacks.
      const ran =
        result.path === "exact" || result.path === "exact-big"
          ? [toExactLiterals(input)]
          : [`Digits:=${s.workDigits}`, input, `Digits:=${s.digits}`];
      defs = this.defsAfter(input, ran, result.display, EngineHost.factsOf(result, Math.trunc(s.digits)), "home", Math.trunc(s.digits), s.angle);
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
    const text = asg ? asg.rhs : input;
    return namesIn(maskBound(text))
      .filter((n) => n !== target)
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
    let text: string;
    try {
      text = this.strict.eval(`pcasans:=(${exactInput})`);
    } catch (e) {
      if (e instanceof GiacSyntaxError) return fail(e.message, "syntax");
      throw e;
    }
    if (isError(text)) return fail(text, isTimeout(text) ? "timeout" : "engine");
    const stateful = isStateful(input);
    // An == or ≠ test on a float side: decided by its own digits, as in Home (R18f2).
    const decided = test && !stateful && this.giac.eval(EQ_INEXACT_FLAG) === "1" ? decideFloatTest(this.giac, exactInput, Math.trunc(s.digits)) : null;
    if (decided) {
      text = this.strict.eval(`pcasans:=(${exactInput})`);
      this.giac.eval(`purge(${EQ_VERDICT})`);
    }
    // G39: a divergent integral or series, or no limit, is refused as in Home; Giac's [exact, numeric] pair of a
    // definite integral is shown as Giac's text (both answers) with ⚠, never as a numeric list.
    const refused = stateful ? null : refusalOf(this.giac, exactInput, text, s.angle);
    if (refused) return fail(enEngine[`error.${refused}`], refused);
    const pair = !stateful && hasDefiniteIntegral(exactInput) && giacPair(text) !== null;
    const asg = simpleAssignment(input);
    const defsOf = (preview: string, facts: NameFacts | null): DefChange[] =>
      stateful ? this.defsAfter(input, [exactInput], preview, facts, "cas", Math.trunc(s.digits), s.angle) : [];
    // A number with a float in it: checked like Home (the value as `numeric`, its text and LaTeX from our formatter).
    // `evalf(e,n)` alone is shown with the n digits it asks for, checked at that precision (decisions M4-6).
    const shape = hasFloat(text) && !pair ? shapeOf(text) : null;
    if (shape) {
      const asked = askedDigits(input);
      const digits = asked ?? Math.trunc(s.digits);
      const facts = floatFacts(this.giac, "pcasans", stateful ? null : exactInput, shape, digits, Math.trunc(s.digits));
      if (facts) {
        let numeric = resultFromFacts(facts, shape, digits, "numeric", true, performance.now() - t0);
        if (asked !== null) numeric.digits = asked;
        const body = asg ? asg.rhs : input;
        const why = whyOf(facts, stateful ? null : exactInput);
        if (why) numeric.why = why;
        numeric = this.inherited(numeric, body, stateful ? null : exactInput, digits, Math.trunc(s.digits));
        return {
          result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric },
          defs: defsOf(numeric.display, EngineHost.factsOf(numeric, Math.trunc(s.digits))),
        };
      }
    }
    // This build leaves x*x unevaluated (no top-level "regroup" autosimplify), and latex() then draws x·x as "xx".
    if (text.includes("*")) text = regrouped(this.giac, "pcasans", text);
    // An == or ≠ test on a side with a float in it (input/emit.ts equalityTest): its true or false is approximate.
    // A float in a non-number (x-0.54764225985): nobody checked its digits, so ⚠ without a count (G27, docs/04 2.4),
    // as the definitions log records it.
    const unchecked = hasFloat(text);
    const approximate = (test && this.giac.eval(EQ_INEXACT_FLAG) === "1") || unchecked;
    const warn = decided?.warn ?? (unchecked ? "unchecked" : undefined);
    const why = pair ? { differ: true } : symbolicWhy(warn, testSides(exactInput));
    const tex = this.giac.eval("latex(pcasans)");
    if (isError(tex)) return fail(tex, isTimeout(tex) ? "timeout" : "engine");
    return {
      result: { ok: true, text, latex: unquote(tex), timedOut: false, engineMs: performance.now() - t0, ...(approximate ? { approximate } : {}), ...(warn ? { warn } : {}), ...(why ? { why } : {}) },
      defs: defsOf(text, unchecked ? { reliableDigits: null, warn: "unchecked" } : null),
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
      this.giac.eval(`angle_radian:=${s.angle === "rad" ? 1 : 0}`);
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
          post({ id: req.id, type: "home", ...host.home(req.input, req.settings, req.consts) });
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
