// SPDX-License-Identifier: GPL-3.0-or-later
// Exact-first Home evaluation (spike step 5, Q3).
//
// 1. Decimal literals become exact rationals (`0.1` → `(1/10)`), so `1-0.9-0.1` is exactly 0.
// 2. Giac evaluates exactly, under Giac's own interrupt (`timeout <s>`, sub-second with patch 0002).
// 3. The value becomes a DecimalValue (format.ts) and is shown in STD at `digits`: exact rationals with BigInt
//    arithmetic, everything else from `evalf` at P = max(40, digits+10) digits, confirmed by a second evaluation
//    (numeric.ts, docs/04 section 2.4). Only confirmed digits are shown; the facts for the mark go with the result.
//    Rounding is half away from zero.
// Guards: timeout → re-evaluate in floating point at W = max(workDigits, digits+10) and at W+20, and round.
// Result over `maxExactDigits` digits → shown from the exact value, but Ans keeps a float so the
// blow-up doesn't propagate (`guardMode: "reeval-float"` re-evaluates in float instead, as a comparison).
//
// Runs synchronously next to the engine (inside the Giac worker, or in Node for tests). Only
// erasable TypeScript syntax, so Node runs this file directly.
import { refusalOf, giacPair, hasDefiniteIntegral, type Refusal } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { backInDegrees, needsDegrees } from "./degrees.ts";
import { dropAngleFactor, hasAngleFactor } from "../input/angles.ts";
import { decimalFromString, formatConfirmed, isZero, tieRisk, type ComplexValue, type PrecisionWarn, type PrecisionWhy } from "./format.ts";
import {
  askedDigits,
  AUDITED_FUNCTIONS,
  functionsIn,
  DOUBLE_DIGITS,
  doubleFallback,
  exactFacts,
  floatFacts,
  floatPathFacts,
  hasFloat,
  isAudited,
  rationalValue,
  decideTwice,
  decidingStored,
  restsOnDecision,
  notBuiltin,
  callsStateful,
  readsReplaced,
  floatsShown,
  shapeOf,
  valuePrecision,
  whyOf,
  withDigits,
  type ElementFacts,
  type Giac,
  type Shape,
} from "./numeric.ts";

export type { Giac };

export interface HomeSettings {
  /** Significant digits shown (CLAUDE.md: 12). */
  digits: number;
  angle: "rad" | "deg";
  /** Exact evaluation budget; Giac interrupts itself after this. */
  budgetMs: number;
  /** Numerator/denominator size above which the result stops being carried exactly. */
  maxExactDigits: number;
  /** Working precision of the float fallback (at least digits+10 is used, docs/04 section 2.5). */
  workDigits: number;
  guardMode: "round-exact" | "reeval-float";
  /** Exact integer powers b^n with |n·ln b| above this fail at once ("Exponent overflow") and go to
   *  the float path. The host applies it with the engine's giac_set_pow_limit(); Giac's default is 1e8.
   *  1e5 ≈ results up to ~43,000 digits. */
  powLimit: number;
}

export const defaultHomeSettings: HomeSettings = {
  digits: 12,
  angle: "rad",
  budgetMs: 300,
  maxExactDigits: 20,
  workDigits: 30,
  guardMode: "round-exact",
  powLimit: 1e5,
};

/** `numeric`: a value from a numeric method (Solve, Function analysis) at work precision, rounded for display. */
export type HomePath = "exact" | "exact-big" | "float-big" | "float-timeout" | "float-error" | "numeric";

export interface HomeResult {
  ok: boolean;
  /** Canonical text: STD at `digits` (format.ts), Giac's text for non-numbers, the error text when !ok. */
  display: string;
  /** The numeric value, for re-formatting in STD/SCI/ENG without the engine (format.ts). Absent for non-numbers. */
  value?: ComplexValue;
  /** Exact Giac result when the exact path finished (may be long). */
  exact?: string;
  path: HomePath;
  /** True when the shown value comes from floating point, not from the exact result. */
  approximate: boolean;
  /** A 40-digit expansion ended in 4999…/5000… at the rounding position (double-rounding risk). */
  tieRisk: boolean;
  exactMs: number;
  totalMs: number;
  /** Set when !ok: "syntax" (Giac could not parse the input), "engine", or a refusal of a number for something that does
   *  not exist (G39, converge.ts: a divergent integral or series, no limit); the UI shows `error.<code>`. */
  error?: "syntax" | "engine" | Refusal;
  /** The value is exactly p/q or an integer; with the format this decides "=" (docs/04 section 2.4, 8.2). */
  exactRational: boolean;
  /** Digits confirmed by the agreement check; null = exact (no digit is in doubt). */
  reliableDigits: number | null;
  /** The text to copy and the `\res` chip value: the exact text or P digits (docs/04 section 2.6, 3.6). */
  full: string;
  /** What a stateful input defined, for the live Find items (docs/04 section 3.4). */
  defined?: { name: string; kind: "var" | "fn" };
  /** Elements of a numeric list or matrix (rows flattened, with `shape`). */
  items?: HomeResult[];
  /** [rows, columns] of `items` for a matrix; absent for a list. */
  shape?: [number, number];
  /** ⚠ although the digits agree: an un-audited function's float, or a value that could be evaluated only once. */
  warn?: PrecisionWarn;
  /** The reasons behind the ⚠ as facts, for the chip that explains it (R36, docs/04 8.2). Absent for an exact result. */
  why?: PrecisionWhy;
  /** The digits the input asked for (`evalf(e,n)`, decisions M4-6): the result is shown with them, not the setting. */
  digits?: number;
  /** Giac `latex()` of a result that is not a number (raw; the view tidies it up and draws it, as in CAS). R18f3. */
  latex?: string;
  /** G26: significant digits of the shown value before the digit position of the first-order σ that the inexact
   *  constants of the input leave (EngineHost.home's table); the digits from there on are uncertain. Absent when no
   *  inexact constant went in by name, or the result is not one real number. */
  uncDigits?: number;
}

/** Giac prints a string result in double quotes; latex() returns one. */
export function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** Placeholder precision facts until the engine fills them (docs/04 section 8.2): no claim of exactness, `full` = the display. */
export function safePrecision(display: string): Pick<HomeResult, "exactRational" | "reliableDigits" | "full"> {
  return { exactRational: false, reliableDigits: null, full: display };
}

/**
 * Our definitions, by name, loaded into Giac on the first input that mentions the name (EngineHost.need): defining
 * them costs ~10 ms on the desktop, which must not land on the engine-ready path.
 * `sigfig(x,n)` (docs/04 section 2.5): x rounded to n significant digits, half away from zero, as an exact rational,
 * so `sigfig(1/3,3)` is exactly 333/1000. The power of ten is found by exact comparisons (a float log10 can land on
 * the wrong side at 999.95); an irrational x is first evaluated with n+30 digits.
 */
export const ENGINE_DEFINITIONS: Readonly<Record<string, string>> = {
  // Find's `mod` (input/emit.ts): Euclidean, never negative. Giac's irem is an error on a rational (irem(15/2,2)), and
  // typed decimals are exact rationals, so mod(7.5,2) fell to the float path and was marked ≈ (G14).
  pasmod:
    "pasmod(a,b):={ if (type(a)==integer and type(b)==integer) return irem(a,b); " +
    "if (b==0) return a; return a-abs(b)*floor(a/abs(b)); }",
  sigfig:
    "sigfig(x,n):={ local a,p,k,m; " +
    'if (type(n)!=integer or n<1) throw("sigfig: n must be a positive integer"); ' +
    "if (x==0) return 0; " +
    'if (type(x)!=integer and type(x)!=rational) { x:=evalf(x,n+30); if (type(x)!=real) throw("sigfig: x must be a real number"); } ' +
    "a:=abs(x); p:=floor(evalf(log10(a),30)); while (10^p>a) p:=p-1; while (10^(p+1)<=a) p:=p+1; " +
    "k:=n-1-p; m:=floor(a*10^k+1/2); return sign(x)*m/10^k; }",
  // G42: Giac's median of an even list is the lower middle, as a float; `median` is also a reserved word, so the
  // parser renames the written word (input/emit.ts CALL_NAME). Sorted, the middle value or the mean of the two middle ones.
  pasmedian:
    "pasmedian(l):={ local s,n,k; if (type(l)!=DOM_LIST) throw(\"median: needs a list of values\"); " +
    "for (k:=0;k<size(l);k:=k+1) { if (type(l[k])!=integer and type(l[k])!=rational and type(evalf(l[k]))!=DOM_FLOAT) throw(\"median: needs a list of real numbers\"); } " +
    "s:=sort(l); n:=size(s); if (n==0) throw(\"median: needs at least one value\"); " +
    "if (irem(n,2)==1) return s[(n-1)/2]; return (s[n/2-1]+s[n/2])/2; }",
  // G42: Giac leaves percentile unevaluated. Linear interpolation between the closest ranks: rank r = p/100·(n−1) on
  // the sorted list (the inclusive method, Excel's PERCENTILE.INC), 0 ≤ p ≤ 100.
  paspercentile:
    "paspercentile(l,p):={ local s,n,r,k; if (type(l)!=DOM_LIST) throw(\"percentile: needs a list of values\"); " +
    "for (k:=0;k<size(l);k:=k+1) { if (type(l[k])!=integer and type(l[k])!=rational and type(evalf(l[k]))!=DOM_FLOAT) throw(\"percentile: needs a list of real numbers\"); } " +
    "s:=sort(l); n:=size(s); " +
    "if (type(p)!=integer and type(p)!=rational and type(evalf(p))!=DOM_FLOAT) throw(\"percentile: needs a list of real numbers\"); " +
    "if (n==0 or p<0 or p>100) throw(\"percentile: needs a list and 0 <= p <= 100\"); " +
    "r:=p/100*(n-1); k:=floor(r); if (k>=n-1) return s[n-1]; return s[k]+(r-k)*(s[k+1]-s[k]); }",
  // G30 (EN7a): n resistors in parallel, 1/(1/a+1/b+…), exact; a zero argument gives exactly 0. Giac hands the
  // arguments of a call to a one-parameter function as one sequence, which [a] makes a list.
  par:
    "par(a):={ local l,s,k; l:=[a]; if (size(l)==0) throw(\"par: needs at least one value\"); " +
    "for (k:=0;k<size(l);k:=k+1) { if (l[k]==0) return 0; } " +
    "s:=0; for (k:=0;k<size(l);k:=k+1) s:=s+1/l[k]; return normal(1/s); }",
};

/** Definitions whose text is built engine-side (host.ts) so their tables stay out of the start chunk: G30 `eseries`
 *  (IEC 60063 preferred value nearest to x in x's decade, eseries.ts). Only the names are known here. */
export const WORKER_DEFINITION_NAMES: readonly string[] = ["eseries"];

/** Set to 1 by an == or ≠ test that met a float (input/emit.ts equalityTest, which spells the same name). Purged, not
 *  set to 0, before an input runs: `sto` inside the test's function would read a value as the place to store to.
 *  EQ_DIFF below is purged with it for the same reason. */
export const EQ_INEXACT_FLAG = "pasinexact";
/** R18f2: where a float-side test leaves its difference, and the verdict it reads (input/emit.ts spells the same). */
export const EQ_DIFF = "pasdiff";
export const EQ_VERDICT = "pasverdict";

/**
 * R18f2: the verdict for an input holding one == or ≠ test with a float side (EQ_INEXACT_FLAG set by its first run).
 * A float can only be compared to its own digits (decisions "2026-10-14 R18 defaults" point 6), so the test runs again
 * at the double precision and at P, and the two differences decide, like a value's confirmed digits (docs/04 2.4):
 * the difference is 0 within its own spread → equal; the two agree to their first digit → not equal; else open (the
 * test stays as typed). A side with an unaudited function can hide its own error from this check (normald_icdf is a
 * double inside at any precision), so it never answers "not equal", and the result carries ⚠.
 * Sets EQ_VERDICT for the caller's final run; null (nothing set) for a stateful input or more than one test.
 */
export function decideFloatTest(giac: Giac, input: string, digits: number): { warn?: "unaudited" } | null {
  if (input.split(`sto(1,${EQ_INEXACT_FLAG})`).length !== 2) return null;
  const run = (d: number, slot: string): boolean =>
    withDigits(giac, d, digits, () => {
      giac.eval(`purge(${EQ_DIFF})`);
      return !isError(giac.eval(input)) && !isError(giac.eval(`${slot}:=${EQ_DIFF}`));
    });
  const P = valuePrecision(digits);
  const ran = run(DOUBLE_DIGITS, "pasdd") && run(P, "pasdm");
  const v = ran
    ? withDigits(giac, P, digits, () => giac.eval("when(abs(pasdd-pasdm)<abs(pasdm)/2,1,when(abs(pasdm)<=abs(pasdd-pasdm),0,2))"))
    : "2";
  const unaudited = !isAudited(testSides(input));
  const verdict = v === "0" ? 0 : v === "1" && !unaudited ? 1 : 2;
  giac.eval(`purge(pasdd,pasdm,${EQ_DIFF})`);
  giac.eval(`${EQ_VERDICT}:=${verdict}`);
  return unaudited ? { warn: "unaudited" } : {};
}

/** The two sides of the test form in `input` (`(a_-b_))(A,B)`), the test helpers left out. */
export function testSides(input: string): string {
  const k = input.indexOf("(a_-b_))(");
  return k < 0 ? input : input.slice(k + 9);
}

/** The `why` of a symbolic result's `warn`: the unaudited functions of the test sides (R18f2), or that nothing was
 *  compared ("unchecked"); undefined when there is nothing to say. */
export function symbolicWhy(warn: PrecisionWarn | undefined, sides: string): PrecisionWhy | undefined {
  if (warn === "unchecked") return { once: true };
  if (warn !== "unaudited") return undefined;
  const unaudited = functionsIn(sides).filter((n) => !AUDITED_FUNCTIONS.has(n));
  return unaudited.length ? { unaudited } : undefined;
}

/** The names of our definitions that `input` mentions. */
export function definitionsUsedBy(input: string): string[] {
  return [...Object.keys(ENGINE_DEFINITIONS), ...WORKER_DEFINITION_NAMES].filter((name) => new RegExp(`\\b${name}\\b`).test(input));
}

/** Giac's latex() of the result in `slot`, whose text is `text`; R64: one that holds the degree factor (a function
 *  body, which Giac prints as given) is drawn from its text without it, as typed. */
export function latexShown(giac: Giac, slot: string, text: string): string {
  return hasAngleFactor(text) ? giac.eval(`latex(quote(${dropAngleFactor(text)}))`) : giac.eval(`latex(${slot})`);
}

/** R64, G46 (route R): the degree factor our parser puts in every angle (input/angles.ts): pi/180 in DEG, 1 in RAD.
 *  Giac itself always runs in radians, so every path inside it (exp, the hyperbolics, inverse trig, integration,
 *  desolve, limit, series) reads radians, the only mode each was written for (S14, docs/04 2.12). */
export function pasdegCommand(angle: "rad" | "deg"): string {
  return `pasdeg:=${angle === "deg" ? "pi/180" : "1"}`;
}

/** Giac in radians and the degree factor of the mode in one engine call (a mode switch costs no extra call). */
export function angleCommand(angle: "rad" | "deg"): string {
  return `angle_radian:=1;${pasdegCommand(angle)}`;
}

/** Engine-side setup for Home; the host runs these once (and again after a settings change). */
export function homeSetupCommands(s: HomeSettings): string[] {
  return [
    angleCommand(s.angle),
    `timeout ${(s.budgetMs / 1000).toFixed(3)}`,
    // How often control_c() looks at the clock: every 10th check (engine/giac/patches/README.md, patch 0002).
    "ckevery 10",
  ];
}

// --- 1. decimal literals → exact rationals -------------------------------------------------

const DECIMAL = /(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?/y;

/** Rewrites the decimal literals of `input` that have a point or an exponent (`2.5`, `.5`, `1e-3`, `1.2E5`) with `f`.
 *  Leaves integers, identifiers (`x1`, `0x1F`) and strings alone. */
function rewriteDecimals(input: string, f: (mant: string, exp10: number) => string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c = input.charAt(i);
    if (c === '"') {
      const end = input.indexOf('"', i + 1);
      const j = end < 0 ? input.length : end + 1;
      out += input.slice(i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /[A-Za-z_0-9]+/y;
      m.lastIndex = i;
      const w = m.exec(input)![0];
      out += w;
      i += w.length;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      DECIMAL.lastIndex = i;
      const m = DECIMAL.exec(input);
      if (m && m[0] !== ".") {
        const lit = m[0];
        const mant = m[1] ?? "";
        const exp = m[2];
        if (!mant.includes(".") && !exp) out += lit;
        else out += f(mant, exp ? parseInt(exp.slice(1), 10) : 0);
        i += lit.length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** Rewrites decimal literals (`2.5`, `.5`, `1e-3`, `1.2E5`) as exact rationals. Leaves integers,
 *  identifiers (`x1`, `0x1F`) and strings alone. */
export function toExactLiterals(input: string): string {
  return rewriteDecimals(input, exactRational);
}

/** Puts the typed decimals back into a text Giac printed with the exact rationals of toExactLiterals(`typed`):
 *  a test that stays as typed shows `0.746824132812`, not `(746824132812/10^12)` (G14). Only the spelled forms are
 *  replaced, and only for literals that `typed` holds. */
export function restoreLiterals(text: string, typed: string): string {
  let out = text;
  rewriteDecimals(typed, (mant, exp10) => {
    const lit = exp10 ? `${mant}e${exp10}` : mant;
    const rat = exactRational(mant, exp10);
    if (rat.startsWith("(")) {
      out = out.split(rat).join(lit);
      // the bare m/10^k a sum or product leaves without brackets; not inside 5/10^12 or 15/10^1
      const bare = rat.slice(1, -1);
      if (bare.includes("/10^")) {
        const re = new RegExp(`(?<![\\w.^])${bare.replace(/[\\^*+?.()|[\]{}$]/g, "\\$&")}(?![\\w.])`, "g");
        out = out.replace(re, lit);
      }
    }
    return rat;
  });
  return out;
}

/**
 * Giac's printed floats as `evalf(<exact>,k)`, k their significant digits but at least 15: a stored float read back
 * with the digits it was printed with, in MPFR (a 14-digit literal would be read as a double, and a double overflows
 * above 1E308). Used for the definitions log (defs.ts): a variable's value, replayed into a fresh engine.
 */
export function floatsAsEvalf(text: string): string {
  return rewriteDecimals(text, (mant, exp10) => {
    const sig = mant.replace(".", "").replace(/^0+/, "").length;
    return `evalf(${exactRational(mant, exp10)},${Math.max(15, sig)})`;
  });
}

function exactRational(mant: string, exp10: number): string {
  const [ip, fp = ""] = mant.split(".");
  const digits = (ip + fp).replace(/^0+(?=\d)/, "");
  const e = exp10 - fp.length;
  if (e === 0) return digits;
  return e > 0 ? `(${digits}*10^${e})` : `(${digits}/10^${-e})`;
}


// --- 2. evaluation ---------------------------------------------------------------------------

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

// Inputs that change engine state and must be replayed after a restart.
const STATEFUL = /:=|=>|\b(purge|assume|additionally|sto)\s*\(/;
/** The stores of our own test helper (input/emit.ts equalityTest): not the user's state. */
const HELPER_STO = new RegExp(`\\bsto\\(\\s*[^,()]*,\\s*(?:${EQ_INEXACT_FLAG}|${EQ_DIFF})\\s*\\)`, "g");

export function isStateful(input: string): boolean {
  return STATEFUL.test(input.replace(HELPER_STO, ""));
}

/** `name:=value` with a plain variable name: evaluated as the value, then stored (so a check may run it twice). */
export function simpleAssignment(input: string): { name: string; rhs: string } | null {
  const m = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:=([\s\S]+)$/.exec(input);
  return m ? { name: m[1]!, rhs: m[2]! } : null;
}

/** What an input defines, for the live Find items (docs/04 section 3.4). */
export function definedBy(input: string): { name: string; kind: "var" | "fn" } | undefined {
  const a = simpleAssignment(input);
  if (a) return { name: a.name, kind: "var" };
  const f = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\([^()]*\)\s*:=/.exec(input);
  if (f) return { name: f[1]!, kind: "fn" };
  const t = storeTargets(input);
  return t?.form === "=>" || t?.form === "sto" ? { name: t.names[0]!, kind: "var" } : undefined;
}

const NAME_LIST = "[A-Za-z][A-Za-z0-9_]*(?:\\s*,\\s*[A-Za-z][A-Za-z0-9_]*)*";

/**
 * G48: the names a value assignment stores and the text it read, in each form: `a:=v`, `[a,b]:=v`, `a,b:=v`,
 * `v=>a`, `sto(v,a)` and `L[k]:=v` (which reads L's other elements, so `read` is the whole input). Null for anything
 * else (a function definition `f(x):=…`, purge, assume, an expression that only holds a store). Read from the text;
 * S13 studies Giac's own state instead.
 */
export function storeTargets(input: string): { names: string[]; read: string; form: ":=" | "[]:=" | ",:=" | "=>" | "sto" | "[k]:=" } | null {
  const a = simpleAssignment(input);
  if (a) return { names: [a.name], read: a.rhs, form: ":=" };
  const list = new RegExp(`^\\s*\\[\\s*(${NAME_LIST})\\s*\\]\\s*:=([\\s\\S]+)$`).exec(input);
  if (list) return { names: list[1]!.split(",").map((n) => n.trim()), read: list[2]!, form: "[]:=" };
  const seq = new RegExp(`^\\s*(${NAME_LIST})\\s*:=([\\s\\S]+)$`).exec(input);
  if (seq) return { names: seq[1]!.split(",").map((n) => n.trim()), read: seq[2]!, form: ",:=" };
  const arrow = /^([\s\S]+)=>\s*([A-Za-z][A-Za-z0-9_]*)\s*$/.exec(input);
  if (arrow) return { names: [arrow[2]!], read: arrow[1]!, form: "=>" };
  const sto = /^\s*sto\s*\(([\s\S]+),\s*([A-Za-z][A-Za-z0-9_]*)\s*\)\s*$/.exec(input);
  if (sto && closingParen(input, input.indexOf("(")) === input.trimEnd().length - 1) return { names: [sto[2]!], read: sto[1]!, form: "sto" };
  const indexed = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\[[^\]]*\]\s*:=/.exec(input);
  if (indexed) return { names: [indexed[1]!], read: input, form: "[k]:=" };
  return null;
}

/**
 * G48 (docs/04 2.4 rule 2): an input that runs once (it stores, or calls a stored function that stores) cannot be
 * decided again at P + 20. When its result rests on a decision it is ⚠ without a count, never exact. A function
 * definition, purge and assume store no value, so they are left out. A stored function the input calls counts only
 * when its own definition rests on a decision (`inc(x):={c:=c+1;c}` does not).
 */
export function onceUndecided(giac: Giac, input: string, body: string, out: string): boolean {
  if (isError(out) || hasFloat(out) || definedBy(input)?.kind === "fn" || /^\s*(purge|assume|additionally)\s*\(/.test(input)) return false;
  return restsOnDecision(body, out, decidingStored(giac));
}

/** G49f4: `name:=x->body` or `name:=(x,y)->body` (also as Giac prints it back, `name:=((x)->body)`): the name of a
 *  function written with an arrow, for the mark facts; definedBy keeps reading it as a variable for the Find items. */
export function arrowFunction(input: string): string | null {
  const a = simpleAssignment(input);
  if (!a) return null;
  let rhs = a.rhs.trim();
  while (rhs.startsWith("(") && closingParen(rhs, 0) === rhs.length - 1) rhs = rhs.slice(1, -1).trim();
  return /^(?:\([^()]*\)|[A-Za-z_][A-Za-z0-9_]*)\s*->/.test(rhs) ? a.name : null;
}

/** Index of the ) that closes the ( at `open` in `s` (strings skipped), or -1. */
function closingParen(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === '"') {
      const q = s.indexOf('"', k + 1);
      if (q < 0) return -1;
      k = q;
    } else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return k;
  }
  return -1;
}

/** Longest exact text kept as `full` (docs/04 section 2.8: ≤ 2 kB). */
export const FULL_EXACT_MAX = 2048;

/**
 * `regroup` on the stored answer `name` (x*x -> x^2), kept only when it merges equal factors, i.e. has
 * fewer "*" than `text`. Otherwise regroup would just reorder (factor's (x-1)*(x+1) -> (x+1)*(x-1))
 * and `text` and the stored answer stay as they were.
 * A text holding `==` is an equality test the rule left as typed (input/emit.ts equalityTest): regroup evaluates it as
 * Giac's structural `==`, so `cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)==1/2` (true) became 0 and `x*x==x^2` became 1 (F35,
 * R18f3). It is left alone. (`<>` comes back from regroup untouched, probe 2026-10-15.)
 */
export function regrouped(giac: Giac, name: string, text: string): string {
  if (text.includes("==")) return text;
  const out = giac.eval(`regroup(${name})`);
  if (isError(out) || out === "undef" || out.split("*").length >= text.split("*").length) return text;
  giac.eval(`${name}:=regroup(${name})`);
  return out;
}

/** The precision fields of a result built from its element facts (docs/04 section 8.2). */
interface Built {
  display: string;
  value?: ComplexValue;
  items?: HomeResult[];
  shape?: [number, number];
  exactRational: boolean;
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  tieRisk: boolean;
  /** The value as a decimal with every confirmed digit up to P (copy, chips). */
  decimal: string;
}

function element(f: ElementFacts, digits: number, P: number, path: HomePath, approximate: boolean): HomeResult {
  const facts = { value: f.value, exactRational: f.exactRational, reliableDigits: f.reliableDigits, ...(f.warn ? { warn: f.warn } : {}) };
  const display = formatConfirmed(facts, { format: "STD", digits })!;
  return {
    ok: true,
    display,
    ...facts,
    full: formatConfirmed(facts, { format: "STD", digits: P })!,
    path,
    approximate,
    tieRisk: !f.exactRational && (tieRisk(f.value.re, digits) || (!isZero(f.value.im) && tieRisk(f.value.im, digits))),
    exactMs: 0,
    totalMs: 0,
  };
}

/** A numeric HomeResult from element facts (CAS numeric results use it too). */
export function resultFromFacts(facts: ElementFacts[], shape: Shape, digits: number, path: HomePath, approximate: boolean, ms = 0): HomeResult {
  const { decimal, ...b } = build(facts, shape, digits, path, approximate);
  return { ok: true, ...b, full: decimal, path, approximate, exactMs: 0, totalMs: ms };
}

function build(facts: ElementFacts[], shape: Shape, digits: number, path: HomePath, approximate: boolean): Built {
  const P = valuePrecision(digits);
  const els = facts.map((f) => element(f, digits, P, path, approximate));
  if (shape.kind === "scalar") {
    const e = els[0]!;
    return {
      display: e.display,
      value: e.value!,
      exactRational: e.exactRational,
      reliableDigits: e.reliableDigits,
      ...(e.warn ? { warn: e.warn } : {}),
      tieRisk: e.tieRisk,
      decimal: e.full,
    };
  }
  const shp: [number, number] | undefined = shape.kind === "matrix" ? [shape.rows, shape.cols] : undefined;
  const reliable = els.reduce<number | null>((n, e) => (e.reliableDigits === null ? n : n === null ? e.reliableDigits : Math.min(n, e.reliableDigits)), null);
  const warn = els.find((e) => e.warn)?.warn;
  const fmt = (key: "display" | "full") =>
    shp ? `[${Array.from({ length: shp[0] }, (_, r) => `[${els.slice(r * shp[1], (r + 1) * shp[1]).map((e) => e[key]).join(",")}]`).join(",")}]` : `[${els.map((e) => e[key]).join(",")}]`;
  return {
    display: fmt("display"),
    items: els,
    ...(shp ? { shape: shp } : {}),
    exactRational: els.every((e) => e.exactRational),
    reliableDigits: reliable,
    ...(warn ? { warn } : {}),
    tieRisk: els.some((e) => e.tieRisk),
    decimal: fmt("full"),
  };
}

/**
 * An exact non-rational scalar whose value printed as a short decimal (`8^(1/3)` → 2.000…): Giac may prove it rational
 * with `simplify`. Then it is exact (and Ans becomes the rational). Only tried when the digits look like it, so it
 * costs nothing for ordinary irrational results.
 */
function provedRational(giac: Giac, name: string, f: ElementFacts, digits: number): ElementFacts | null {
  if (f.exactRational || f.value.re.sticky || f.value.im.sticky) return null;
  if (f.value.re.digits.length > digits || f.value.im.digits.length > digits) return null;
  const out = giac.eval(`simplify(${name})`);
  if (isError(out)) return null;
  const re = giac.eval(`re(simplify(${name}))`);
  const im = giac.eval(`im(simplify(${name}))`);
  const a = rationalValue(re);
  const b = rationalValue(im);
  if (!a || !b) return null;
  giac.eval(`${name}:=simplify(${name})`);
  return { value: { re: a.v, im: b.v }, exactRational: true, reliableDigits: null, big: false };
}

/** G38: a result whose decision did not hold at a higher precision: ⚠ without a count, elements too, with the why
 *  "decided at limited precision" (docs/04 2.4 rule 2). */
export function undecidedResult(r: HomeResult): HomeResult {
  const el = (e: HomeResult): HomeResult => ({ ...e, exactRational: false, reliableDigits: null, warn: "unchecked", approximate: true });
  return { ...el(r), ...(r.items ? { items: r.items.map(el) } : {}), why: { ...(r.why ?? {}), decided: true } };
}

export function homeEval(
  giac: Giac,
  input: string,
  s: HomeSettings = defaultHomeSettings,
  now: () => number = () => performance.now(),
): HomeResult {
  const t0 = now();
  const ans = "pasans";
  const asg = simpleAssignment(input);
  const body = asg ? asg.rhs : input;
  // Other stateful inputs (f(x):=…, purge, assume, =>) must not run twice, nor a call to a stored function that
  // stores (inc(x):={c:=c+1;c}), assigned or not.
  const once = (!asg && isStateful(input)) || callsStateful(giac, body);
  const exactBody = toExactLiterals(body);
  const test = input.includes(EQ_INEXACT_FLAG);
  if (test) giac.eval(`purge(${EQ_INEXACT_FLAG},${EQ_DIFF})`);
  // G38 (docs/04 2.4 rule 2): the exact evaluation runs at Digits = P, since Giac decides signs, comparisons and
  // floor at Digits; the host's Digits stays the display digits, which print the floats of a non-number.
  const P = valuePrecision(s.digits);
  const exactRun = (): string => withDigits(giac, P, s.digits, () => giac.eval(`${ans}:=(${exactBody})`));
  let exactOut = exactRun();
  // An == or ≠ test on a side with a float in it (input/emit.ts equalityTest): its true or false is approximate, and
  // decided by its own digits (R18f2): run once more with the verdict set.
  const inexactTest = test && giac.eval(EQ_INEXACT_FLAG) === "1";
  const decided = inexactTest && !once ? decideFloatTest(giac, exactBody, s.digits) : null;
  if (decided) {
    exactOut = exactRun();
    giac.eval(`purge(${EQ_VERDICT})`);
  }
  const exactMs = now() - t0;
  // G38: a result that rests on a numeric decision is decided again at P + 20 (and P + 40), see decideTwice. Not for
  // an input that cannot run twice, a test with a float side (decideFloatTest decided it, and its verdict is gone), or a
  // float result, whose value check runs it at two precisions anyway. An exact == or ≠ test is a decision too.
  // G48: an input that runs once and rests on a decision is ⚠ (it cannot be decided again).
  let undecided = once && !inexactTest && onceUndecided(giac, input, exactBody, exactOut);
  // G57: a decision the precisions do not agree on, or a tie Giac cannot prove, is refused (any value would be a guess).
  let refusedCut = false;
  if (!once && !inexactTest && !isError(exactOut) && !hasFloat(exactOut) && restsOnDecision(exactBody, exactOut, notBuiltin(giac))) {
    const d = decideTwice(giac, exactBody, exactOut, s.digits, s.digits);
    if ("undecided" in d) undecided = true;
    if ("undecided" in d && d.refused) refusedCut = true;
    if (!("undecided" in d) && d.from !== undefined) {
      giac.eval(`${ans}:=${d.from}`);
      exactOut = d.text;
    }
    giac.eval("purge(pasdec2)");
  }
  const W = Math.max(s.workDigits, s.digits + 10);
  const defined = definedBy(input);
  const store = () => {
    if (asg) giac.eval(`${asg.name}:=${ans}`);
  };

  // G39: set when a convergence check could not finish: the result stands, with ⚠ (nothing confirmed it exists).
  let unverified = false;
  const done = (r: Omit<HomeResult, "exactMs" | "totalMs" | "full"> & { full?: string }): HomeResult => {
    const out: HomeResult = {
      ...r,
      ...(unverified && r.ok ? { warn: r.warn ?? "unchecked", approximate: true } : {}),
      full: r.full ?? r.display,
      ...(r.ok && defined ? { defined } : {}),
      exactMs,
      totalMs: now() - t0,
    };
    return undecided && out.ok ? undecidedResult(out) : out;
  };
  const fromBuilt = (b: Built, path: HomePath, approximate: boolean, exact: string | undefined, full: string, why?: PrecisionWhy): HomeResult => {
    const { decimal: _d, ...rest } = b;
    return done({ ok: true, ...rest, ...(why ? { why } : {}), ...(exact !== undefined ? { exact } : {}), path, approximate, full });
  };
  const failed = (display: string, path: HomePath, exact?: string): HomeResult =>
    done({ ok: false, display, ...(exact !== undefined ? { exact } : {}), path, approximate: true, tieRisk: false, exactRational: false, reliableDigits: null });

  const viaFloat = (path: HomePath, exact?: string): HomeResult => {
    const f = floatPathFacts(giac, ans, asg ? asg.rhs : input, once, W, s.digits);
    if ("error" in f) return failed(f.error, path, exact);
    // G39: the float of a divergent integral or series (the principal value 0 of ∫₋₁¹ 1/x) is refused as on the exact path.
    const refused = once ? null : refusalOf(giac, exactBody, giac.eval(ans));
    if (refused === "unchecked") unverified = true;
    else if (refused) return { ...failed(enEngine[`error.${refused}`], path), error: refused, approximate: false };
    store();
    const b = build(f.facts, f.shape, s.digits, path, true);
    return fromBuilt(b, path, true, exact, b.decimal, whyOf(f.facts, once ? null : asg ? asg.rhs : input));
  };

  if (isTimeout(exactOut)) return viaFloat("float-timeout");
  if (isError(exactOut)) return viaFloat("float-error");

  // G39: a number for something that does not exist (a principal value, an Abel sum, a bounded_function) is refused.
  if (!once) {
    const refused = refusalOf(giac, exactBody, exactOut);
    if (refused === "unchecked") unverified = true;
    else if (refused) return { ...failed(enEngine[`error.${refused}`], "exact"), error: refused, approximate: false };
  }
  // G57: after G39's refusals, whose message says more (Giac's bounded_function of limit(sin(x),x,inf) decides too).
  if (refusedCut) return { ...failed(enEngine["error.undecided"], "exact"), error: "undecided", approximate: false };
  // G39: Giac's [exact, numeric] pair of a definite integral is never a list. The two answers differ, so neither is
  // confirmed: the float is the value, with no digit confirmed (⚠, docs/04 2.4), and the why-line says the pair differs.
  const pair = !once && hasDefiniteIntegral(exactBody) ? giacPair(exactOut) : null;
  if (pair) {
    const P = valuePrecision(s.digits);
    const re = decimalFromString(pair.numeric, P);
    if (re) {
      giac.eval(`${ans}:=${pair.numeric}`);
      store();
      const f: ElementFacts = { value: { re, im: decimalFromString("0", P)! }, exactRational: false, reliableDigits: 0, big: false };
      const b = build([f], { kind: "scalar" }, s.digits, "exact", true);
      return fromBuilt(b, "exact", true, undefined, b.decimal, { differ: true });
    }
  }

  const shape = shapeOf(exactOut);
  const symbolic = (): HomeResult => {
    // Not a number (symbolic, a set, a nested list…): show Giac's text. This build does not apply the
    // "regroup" autosimplify at the top level (x*x stays x*x), so collect equal factors here.
    // G38: a float in a non-number prints with the precision it was computed at (P). Ans keeps the P result; the text
    // shown prints its floats at the display digits (floatsAtDigits), never by running the input again, which would
    // redo its decisions at the display digits; so it holds for an input that cannot run twice and for a test too.
    const atN = hasFloat(exactOut) ? floatsShown(giac, exactOut, s.digits, "pasfl") : null;
    const slot = atN === null ? ans : "pasfl";
    const base = atN ?? exactOut;
    const shown = base.includes("*") ? regrouped(giac, slot, base) : base;
    // An open test shows its decimals as typed, not as the exact rationals the engine read (G14).
    const text = /==|<>/.test(shown) ? restoreLiterals(shown, body) : shown;
    store();
    // G46: in DEG drawn as a DEG engine prints it (degrees.ts); exact and full keep the radian text for Ans and chips.
    const deg = s.angle === "deg" && needsDegrees(text) ? backInDegrees(giac, text) : null;
    // Drawn from Giac's latex() as in CAS (owner, 2026-10-15): cos(pi/7) and pi come out as textbook maths.
    const tex = deg !== null ? giac.eval(`latex(quote(${deg}))`) : latexShown(giac, slot, text);
    if (atN !== null) giac.eval("purge(pasfl)");
    const latex = isError(tex) ? {} : { latex: unquote(tex) };
    // A float in a non-number (x-0.54764225985): nobody checked its digits, so ⚠ without a count (G27, docs/04 2.4).
    const unchecked = hasFloat(text);
    const warn = decided?.warn ?? (unchecked ? "unchecked" : undefined);
    const why = symbolicWhy(warn, testSides(exactBody));
    return done({ ok: true, display: deg ?? dropAngleFactor(text), exact: text, ...(deg !== null ? { full: text } : {}), ...latex, path: "exact", approximate: inexactTest || unchecked, ...(warn ? { warn } : {}), ...(why ? { why } : {}), tieRisk: false, exactRational: false, reliableDigits: null });
  };
  // A list holding an open == or ≠ test (R18f3): its numeric value would be Giac's structural verdict, 0 or 1.
  if (!shape || /==|<>/.test(exactOut)) return symbolic();

  if (hasFloat(exactOut)) {
    // Giac's numeric code returned a float on the exact path (rule 3). `evalf(e,n)` alone is shown with the n digits it
    // asks for, checked at that precision, as in CAS (decisions M4-6; owner, 2026-10-13).
    const asked = askedDigits(input);
    const digits = asked ?? s.digits;
    const facts = floatFacts(giac, ans, once ? null : exactBody, shape, digits, s.digits, exactBody);
    if (!facts) return symbolic();
    store();
    const b = build(facts, shape, digits, "exact", true);
    // G50: Giac's printed float is not kept when its value was computed again through our definitions (forValue):
    // evalf(tanh(i)) printed coth(i); so did approx(w) with w holding Giac's exact tanh(i) (G50f1, readsReplaced).
    const giacText = once || !readsReplaced(giac, exactBody) ? exactOut : undefined;
    const r = fromBuilt(b, "exact", true, giacText, b.decimal, whyOf(facts, once ? null : exactBody));
    return asked !== null ? { ...r, digits: asked } : r;
  }

  let facts = exactFacts(giac, ans, shape, s.digits, s.maxExactDigits);
  if (!facts) {
    const d = shape.kind === "scalar" ? doubleFallback(giac, ans, body, s.digits, s.digits) : null;
    if (!d) return symbolic();
    const b = build([d], shape, s.digits, "exact", true);
    store();
    return fromBuilt(b, "exact", true, exactOut, b.decimal, { once: true });
  }
  let exactText = exactOut;
  if (shape.kind === "scalar" && !facts[0]!.exactRational) {
    const proved = provedRational(giac, ans, facts[0]!, valuePrecision(s.digits));
    if (proved) {
      facts = [proved];
      exactText = giac.eval(ans);
    }
  }
  const b = build(facts, shape, s.digits, "exact", false);
  store();
  const full = exactText.length <= FULL_EXACT_MAX ? exactText : b.decimal;
  const big = shape.kind === "scalar" && facts[0]!.big;
  if (!big) return fromBuilt(b, "exact", false, exactText, full);
  if (s.guardMode === "reeval-float") return viaFloat("float-big", exactText);
  // Shown from the exact value (already computed); Ans continues as a float.
  giac.eval(`${ans}:=evalf(${ans},${W})`);
  return fromBuilt(b, "exact-big", false, exactText, full);
}
