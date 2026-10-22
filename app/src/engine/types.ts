// SPDX-License-Identifier: GPL-3.0-or-later
// The only way UI code talks to maths (CLAUDE.md). Implementations run Giac off the main thread.
import type { HomeResult, HomeSettings } from "./homeEval.ts";
import type { DefEntry } from "./defs.ts";
import type { ConstEntry, ConstTable } from "./constUnc.ts";
import type { ChipEntry, ChipFactsTable } from "./chipFacts.ts";
import type { PrecisionWarn, PrecisionWhy } from "./format.ts";
import type { Refusal } from "./converge.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";

export type { ChipEntry, ChipFactsTable, ConstEntry, ConstTable, HomeResult, HomeSettings };

/**
 * What the engine knows about how far one value can be trusted (docs/04 2.4, 8.2; G76): the one shape every carrier of
 * a value's facts uses, whole (HomeResult and CasResult as `facts`; NameFacts, ChipEntry, Chip, ElementFacts,
 * PrecisionFacts and ResultFacts are it plus their own fields). A carrier passes it on as it is, never field by field,
 * so a new fact reaches every view without a change to the carriers.
 */
export interface ValueFacts {
  /** The value is exact: an integer or p/q in re and im (the old `exactRational`), or a chip's exact text. A `warn`
   *  still stands over it (markOf reads `warn` first). False claims nothing: a float, or a result that is not a number. */
  exact: boolean;
  /** Significant digits confirmed by the agreement check; null: not limited (an exact value, or one whose only doubt is
   *  `warn` or `inexact`). */
  reliableDigits: number | null;
  /** ⚠ although the digits agree: an un-audited function's float, or a value that could be evaluated only once. */
  warn?: PrecisionWarn;
  /** The reasons behind the ⚠ (R36, docs/04 8.2). Only on a whole result, never on a list's elements. */
  why?: PrecisionWhy;
  /** G49: the value prints as an exact rational but is not exact (from an input that held a constant with an
   *  uncertainty, a chip that is not exact, or a result shown with ⚠): never `=`. A float needs no flag. */
  inexact?: true;
  /** G26: significant digits of the shown value before the digit position of the first-order σ that the inexact
   *  constants of the input leave (constUnc.ts); the digits from there on are uncertain. Absent when no inexact
   *  constant went in by name, or the result is not one real number. */
  uncDigits?: number;
}

/** Every key of ValueFacts (a new fact fails to compile here until it is listed, and then every copy below has it). */
const VALUE_FACT_KEYS = { exact: true, reliableDigits: true, warn: true, why: true, inexact: true, uncDigits: true } as const satisfies Record<keyof ValueFacts, true>;

/** The ValueFacts of `x`, which may carry more (a value, items): every fact, nothing else. */
export function valueFactsOf(x: ValueFacts): ValueFacts {
  const out: ValueFacts = { exact: x.exact, reliableDigits: x.reliableDigits };
  for (const k of Object.keys(VALUE_FACT_KEYS) as (keyof ValueFacts)[]) if (x[k] !== undefined) Object.assign(out, { [k]: x[k] });
  return out;
}

/** A stored PrecisionWhy: an object with only its keys, each of its type. */
function isWhy(x: unknown): x is PrecisionWhy {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const names = (v: unknown): boolean => Array.isArray(v) && v.every((n) => typeof n === "string");
  const flag = (v: unknown): boolean => typeof v === "boolean";
  const check: Record<keyof PrecisionWhy, (v: unknown) => boolean> = { unaudited: names, inherited: names, once: flag, decided: flag, differ: flag };
  return Object.entries(x).every(([k, v]) => Object.hasOwn(check, k) && check[k as keyof PrecisionWhy](v));
}

/**
 * Stored facts (history, chips, definitions) read back as ValueFacts: the one mapping for an item stored before G76,
 * whose keys stay as they were written. `exactRational` is the old name of `exact`; a missing `exact` claims nothing
 * (false), a missing `reliableDigits` is null (not limited). Null when a field that is there has the wrong type.
 */
export function readValueFacts(x: unknown): ValueFacts | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  const exact = f["exact"] ?? f["exactRational"] ?? false;
  const d = f["reliableDigits"] ?? null;
  if (typeof exact !== "boolean" || !(d === null || (typeof d === "number" && Number.isFinite(d)))) return null;
  const { warn, why, inexact, uncDigits } = f;
  if (warn !== undefined && warn !== "unaudited" && warn !== "unchecked") return null;
  if (inexact !== undefined && inexact !== true) return null;
  if (uncDigits !== undefined && !(typeof uncDigits === "number" && Number.isInteger(uncDigits) && uncDigits >= 0)) return null;
  if (why !== undefined && !isWhy(why)) return null;
  return {
    exact,
    reliableDigits: d,
    ...(warn ? { warn } : {}),
    ...(why ? { why: why as PrecisionWhy } : {}),
    ...(inexact ? { inexact } : {}),
    ...(uncDigits !== undefined ? { uncDigits } : {}),
  };
}

export interface CasSettings {
  angle: "rad" | "deg";
  /** Significant digits for approximate results inside CAS (Giac `Digits`). */
  digits: number;
  /** Giac's own interrupt as a safety net (seconds, < 1440). The user-facing limit is the Cancel key. */
  hardTimeoutS: number;
  /** Exact integer powers b^n with |n·ln b| above this fail at once. D3: Giac's default 1e8 in CAS. */
  powLimit: number;
}

/** D3: no automatic fallback in CAS; after about this long the UI makes Cancel prominent. */
export const CAS_SOFT_BUDGET_MS = 10_000;

/** A variable name: letters/digits, optionally one subscript (`x_1`, `v_c`); Giac reads these as plain identifiers. */
export const IDENT = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?$/;

export const defaultCasSettings: CasSettings = {
  angle: "rad",
  digits: 12,
  hardTimeoutS: 600,
  powLimit: 1e8,
};

export interface CasResult {
  ok: boolean;
  /** Giac's printed result (for copy/paste and tests), or the error text when !ok. Never shown as the 2D result.
   *  When `numeric` is set: its display text (our formatter, confirmed digits only), not Giac's float text. */
  text: string;
  /** G46: the radian text Ans and chips carry, when `text` (and `latex`) show it rewritten into degrees (DEG, S14
   *  option 2). Absent when they are the same. */
  full?: string;
  /** Giac `latex()` of the result (raw; the view tidies it up and renders it). Empty when !ok. With `numeric`, the
   *  LaTeX of its display text. */
  latex: string;
  /** Giac stopped itself at hardTimeoutS. */
  timedOut: boolean;
  /** Why !ok, for the UI's own (translated) message: Giac's text stays in `text`. */
  error?: "syntax" | "timeout" | "engine" | Refusal;
  engineMs: number;
  /** The stored variables (definitions log, kind var) whose names appear in the input, with the preview they hold and
   *  the view they were stored in (F28: a value stored in Home changes a CAS result). Absent when there is none; a
   *  name the input assigns itself and a called function are not listed. */
  uses?: { name: string; preview: string; view: "home" | "cas" }[];
  /** The result as a number, when it is one with a float in it (docs/04 section 2.9): the value the mark, the copy and
   *  the digits setting work on. Exact CAS results (`1/3`, `sqrt(2)`) have none: they get no mark. */
  numeric?: HomeResult;
  /** A true or false that rests on a float (an == or ≠ test, R18f1), or a non-number with a float in it (G27): drawn
   *  with the approximate mark. */
  approximate?: boolean;
  /** The facts of a non-number (G76): `warn` ⚠ when its float comes from an unaudited function (R18f2) or sits where
   *  nobody checked it (G27), with `why` its reasons (G22); `exact` claims nothing. A number's are
   *  `numeric.facts`, the same object. */
  facts: ValueFacts;
  /** G67: the input changed one of Giac's settings, which the engine put back (as HomeResult.settingReset). */
  settingReset?: true;
}

export interface EvalResult {
  /** Giac's printed result, or the error text when `ok` is false. */
  output: string;
  ok: boolean;
  /** Time spent inside the engine call, measured in the worker. */
  engineMs: number;
}

export interface EngineTimings {
  /** Fetch + compile + instantiate the wasm module. */
  instantiateMs: number;
  /** giac_init(). */
  initMs: number;
  /** Replay of the definitions: the stored ones on first launch, the log after a restart (docs/04 6.2). */
  replayMs: number;
  /** Worker construction to "ready" as seen from the caller (includes the above). */
  readyMs: number;
  /** G19: the stored definitions stopped the engine twice, so it started without them (still stored; Memory lists them). */
  safeStart?: { skipped: number };
}

// --- Solve app and Function analysis (docs/02 section 4) ------------------------------------
// All strings are Giac text from our parser (or exact decimals such as "0.1"). Numbers in results are
// HomeResults (path "numeric", approximate) so the views format them like Home and can read `.value`.

/** A variable held at a fixed value while others are solved for (Solve app Num view). */
export interface KnownValue {
  name: string;
  /** Every confirmed digit of the value (an answer's full text), or what was typed. */
  value: string;
  /** The facts of the answer the value came from (G86): `reliableDigits` its confirmed digits (G68f1: the solve is
   *  checked by a second one with the value moved by one unit in its last confirmed digit); a `warn` (a ⚠ answer) passes
   *  the ⚠ on. Absent = typed; exact facts or no confirmed digits: never moved. */
  facts?: ValueFacts;
}

export type SolveRequest =
  /** N equations in N unknowns from guesses: N = 1 uses the 1-D strategy (bracket + Brent, else
   *  Newton), N > 1 Giac `fsolve` (GSL hybridsj, hybrids, then Giac's Newton), every candidate
   *  polished at work precision and substituted back. */
  | { kind: "equations"; equations: string[]; unknowns: string[]; guesses: string[]; knowns?: KnownValue[] }
  /** All roots (complex included) of one polynomial equation: Giac `proot`, then substituted back. */
  | { kind: "poly"; equation: string; unknown: string; knowns?: KnownValue[] };

export type SolveMethod = "exact-zero" | "brent" | "newton" | "hybridsj" | "hybrids" | "giac-newton" | "proot" | "none";

export interface SolveRoot {
  /** The unknown (kind "equations"); absent for polynomial roots. */
  name?: string;
  result: HomeResult;
}

export interface SolveOutcome {
  ok: boolean;
  /** kind "equations": one per unknown, in request order. kind "poly": every root (reals first, ascending). */
  roots: SolveRoot[];
  method: SolveMethod;
  /** The info line: which method found the root and what happened on the way. */
  info: string;
  /** Largest relative residual after substituting back (work precision). */
  residualRel?: number;
  /** The residual check failed: show ⚠. */
  warn: boolean;
  /** Why !ok, for the UI's own message. */
  error?: "syntax" | "engine" | "no-root" | "bad-input";
  ms: number;
}

export type AnalysisRequest =
  /** Root of f, or extremum (root of f'), nearest x0; inside [lo, hi] when given (the visible window). */
  | { kind: "root" | "extremum"; f: string; x0: string; lo?: string; hi?: string; variable?: string }
  | { kind: "intersection"; f: string; g: string; x0: string; lo?: string; hi?: string; variable?: string }
  | { kind: "slope"; f: string; x0: string; variable?: string }
  /** Signed area ∫_a^b (f − g), g = 0 when absent. */
  | { kind: "area"; f: string; g?: string; a: string; b: string; variable?: string };

export interface AnalysisResult {
  ok: boolean;
  /** root / extremum / intersection / slope: the point. */
  x?: HomeResult;
  y?: HomeResult;
  /** slope: f'(x); area: the integral. */
  value?: HomeResult;
  extremum?: "min" | "max" | "flat";
  warn: boolean;
  info: string;
  method: string;
  error?: "syntax" | "engine" | "no-root" | "bad-input";
  ms: number;
}

export interface TableRequest {
  fns: string[];
  /** Exact decimals, e.g. "0.1". */
  xs: string[];
  /** Default "x". */
  variable?: string;
}

/** G24: the engine ran out of memory (an allocation failed or the worker crashed); it was restarted. */
export class EngineMemoryError extends Error {
  constructor(detail = "out of memory") {
    super(detail);
    this.name = "EngineMemoryError";
  }
}

export class EngineCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "EngineCancelled";
  }
}

export interface MathEngine {
  /** Resolves once the engine can take calls. */
  ready(): Promise<EngineTimings>;
  /** Exact-first Home evaluation: a decimal result rounded to `settings.digits`. `consts` (G26): the constants the
   *  input holds by name (`pasc_<id>`), with value and uncertainty; a result from an inexact one carries `uncDigits`.
   *  `chips` (G49): the chips it holds by name (`pasr_<k>`), with value and facts; a result from one that is not exact
   *  inherits its facts (chipFacts.ts). */
  home(input: string, settings: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): Promise<HomeResult>;
  /** Exact CAS evaluation plus `latex()` of the result. */
  cas(input: string, settings: CasSettings): Promise<CasResult>;
  /** Solve app: equations from guesses, or all roots of a polynomial. Residual-checked. */
  solve(req: SolveRequest, settings: HomeSettings): Promise<SolveOutcome>;
  /** The variables in the equations (Giac `lname`, constants excluded), in order of appearance. */
  unknowns(equations: string[]): Promise<string[]>;
  /** Function analysis for the Plot menu: root, extremum, intersection, slope, signed area. */
  analyze(req: AnalysisRequest, settings: HomeSettings): Promise<AnalysisResult>;
  /** Num table: rows by x, each cell what Home shows for fn at x. One engine call. */
  table(req: TableRequest, settings: HomeSettings): Promise<HomeResult[][]>;
  /** The unit view (G16, docs/04 4.2): a job built by units/build.ts, evaluated in Home's mode. */
  units(job: UnitJob, settings: HomeSettings): Promise<Quantity | UnitError>;
  /** Raw Giac call in whatever mode the engine is in (tools and benchmarks; not the UI). */
  eval(input: string): Promise<EvalResult>;
  /** The definitions log (docs/04 6.2): what the user defined, the stored log included once it has been read. */
  definitions(): Promise<readonly DefEntry[]>;
  /**
   * Abort whatever is running: terminates the worker, starts a new one and replays the variable
   * definitions. Pending calls reject with EngineCancelled. Mode settings are re-applied on the next call.
   */
  cancel(): Promise<EngineTimings>;
  dispose(): void;
}
