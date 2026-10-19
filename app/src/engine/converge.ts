// SPDX-License-Identifier: GPL-3.0-or-later
// G39 (deep check 2026-10-19 E2, E6, E9): Giac answers some inputs with a number for something that does not exist: the
// principal value of a divergent integral (∫₋₁¹ 1/x = 0), the Abel sum of a divergent series (Σ cos k = −1/2), and
// unevaluated words (`bounded_function(2)` for lim sin x). Rule (default, deep check 2026-10-19): such a number is
// refused, by the cheapest necessary check Giac offers, and Giac's own `undef` for the same kinds gets the same message:
// - a series Σ t over k up to ±∞ with a finite result: the term must tend to 0 (`limit(t,k,inf)` is 0);
// - an integral ∫ f dx over [a, b] with a finite result: near each real singular point of f inside [a, b] (`singular`,
//   and for a periodic f its shifts by the period) ∫|f| must be finite. The window is the point ± 1, cut to [a, b], so a
//   conditionally convergent integral (∫₀^∞ sin x / x) is not refused for its tail, which is not the singular point.
// Only inputs that hold one of these calls pay, and an integral pays for the second integral only when f has a real
// singular point in [a, b]. The checks run next to the engine, synchronously; only erasable TypeScript syntax.
import { closing, functionsIn, hasFloat, splitList, topLevelArgs, type Giac } from "./numeric.ts";

/** Why a result is refused; the UI shows `error.<code>` from the i18n table (enEngine.ts). */
export type Refusal = "integralDiverges" | "seriesDiverges" | "noLimit";

type Kind = "int" | "sum" | "limit";

const KIND: Readonly<Record<string, Kind>> = { int: "int", integrate: "int", sum: "sum", limit: "limit" };
const REFUSAL: Readonly<Record<Kind, Refusal>> = { int: "integralDiverges", sum: "seriesDiverges", limit: "noLimit" };

interface Call {
  kind: Kind;
  text: string;
  args: string[];
}

/** Every int/integrate/sum/limit call in `input` (nested ones too), in text order; strings are skipped. */
export function callsIn(input: string): Call[] {
  const out: Call[] = [];
  const re = /"[^"]*"|\b(int|integrate|sum|limit)\s*\(/g;
  for (let m = re.exec(input); m; m = re.exec(input)) {
    if (!m[1]) continue;
    const open = m.index + m[0].length - 1;
    const close = closing(input, open);
    if (close < 0) continue;
    // A name that merely ends in the word (`myint(`) is not a call of it: \b sees `myint` as one word, so no match.
    out.push({ kind: KIND[m[1]]!, text: input.slice(m.index, close + 1), args: topLevelArgs(input.slice(open + 1, close)).map((a) => a.trim()) });
  }
  return out;
}

const isError = (t: string): boolean => t.startsWith("GIAC_ERROR");
/** Giac's text for "no finite number": undef, or an infinity anywhere in it. */
const notFinite = (t: string): boolean => t === "undef" || /infinity|\binf\b/.test(t);
/** A result that is a value we may test: no infinity, no undef, no unevaluated call of the same kind left in it. */
const finiteValue = (t: string): boolean => !isError(t) && !notFinite(t) && !/\b(int|integrate|sum|limit)\s*\(/.test(t);

/** Giac's free names of `e` are among `vars` (Giac lists ∞ as the name `infinity`, which is not free). */
function onlyNames(giac: Giac, e: string, vars: string[]): boolean {
  const t = giac.eval(`lname(${e})`);
  if (isError(t)) return false;
  const names = splitList(t);
  return names !== null && names.every((n) => n === "infinity" || vars.includes(n));
}

/** A real number of Giac's text `e` at 30 digits (±Infinity for ±∞); null when it is not a real number. */
function realOf(giac: Giac, e: string): number | null {
  const t = giac.eval(`evalf(${e},30)`).trim();
  if (t === "+infinity" || t === "inf") return Infinity;
  if (t === "-infinity") return -Infinity;
  if (!/^-?[\d.]+(e[+-]?\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** The value of `call` alone: the whole input's output when the call is the whole input, else one more evaluation. */
function valueOf(giac: Giac, call: Call, input: string, output: string): string {
  return call.text === input.trim() ? output : giac.eval(call.text);
}

/** The series check: the term of `sum(t,k,a,b)` tends to 0 at each infinite end. False = refuse. Runs in radians. */
function seriesOk(giac: Giac, c: Call): boolean {
  const [t, k, a, b] = c.args as [string, string, string, string];
  const ends = [realOf(giac, b) === Infinity ? "inf" : null, realOf(giac, a) === -Infinity ? "-inf" : null].filter((e): e is string => e !== null);
  for (const end of ends) {
    const l = giac.eval(`limit(${t},${k},${end})`).trim();
    if (l === "0") continue;
    // bounded_function(…), undef, ±infinity or a non-zero number: the term does not tend to 0.
    if (/bounded_function/.test(l) || l === "undef" || /^[+-]?infinity$/.test(l)) return false;
    const v = giac.eval(`evalf(abs(${l}),30)`).trim();
    if (/^[\d.]+(e[+-]?\d+)?$/.test(v) && Number(v) !== 0) return false;
    // Anything else (`1/((+infinity)!)` for 1/k!, an unevaluated limit) is not a proof of divergence: kept.
  }
  return true;
}

const TRIG = /"[^"]*"|\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|asec|acsc|acot|arcsin|arccos|arctan)\s*\(/g;

/**
 * `text` read in DEG, written for RAD: the argument of a trig function is multiplied by π/180, the result of an inverse
 * one by 180/π, and the ° template's `(pi/180)^angle_radian()` (input/emit.ts) is 1. Giac in DEG leaves ∫|f| unevaluated
 * and refuses the limit of a trig term ("works only in radian mode"), so the checks run in radians on this text.
 */
export function inRadians(text: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    TRIG.lastIndex = i;
    const m = TRIG.exec(text);
    if (!m) return (out + text.slice(i)).replace(/\(pi\/180\)\^angle_radian\(\)/g, "1");
    const end = TRIG.lastIndex;
    const close = m[1] ? closing(text, end - 1) : -1;
    if (close < 0) {
      out += text.slice(i, end);
      i = end;
      continue;
    }
    const arg = inRadians(text.slice(end, close));
    const name = m[1]!;
    out += text.slice(i, m.index);
    out += /^(a|arc)/.test(name) ? `(180/pi*${name}(${arg}))` : `${name}(pi/180*(${arg}))`;
    i = close + 1;
  }
}

const PERIODIC = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);
/** Periods tried for a trig integrand: 2π/n (in radians; a DEG integrand is rewritten first), largest n first, so the
 *  smallest period is found. */
const PERIOD_DIVISORS = [12, 10, 8, 6, 5, 4, 3, 2, 1];

/** The smallest period 2π/n of `f` among PERIOD_DIVISORS, as Giac text; null when none fits. Tested at two points at
 *  30 digits (a wrong period only costs a second integral at a point that is not singular). */
function periodOf(giac: Giac, f: string, x: string, scale: string): string | null {
  if (!functionsIn(f).some((n) => PERIODIC.has(n))) return null;
  const points = ["0.3171", "1.1937"].map((p) => `${p}*${scale}`);
  for (const n of PERIOD_DIVISORS) {
    const T = `(2*pi*${scale}/${n})`;
    const same = points.every((p) => {
      const r = giac.eval(`evalf(abs(subst(${f},${x},${p}+${T})-subst(${f},${x},${p}))-10^-20*(1+abs(subst(${f},${x},${p}))),30)`).trim();
      return /^-/.test(r);
    });
    if (same) return T;
  }
  return null;
}

/** Most points near which ∫|f| is checked (one per singular point of a periodic f, each of the others). */
const MAX_POINTS = 8;

/** The integral check: near every real singular point of f in [a, b], ∫|f| is finite. False = refuse. */
function integralOk(giac: Giac, c: Call, angle: "rad" | "deg"): boolean {
  // A DEG integrand rewritten for radians still takes x in degrees, so its period is 360/n: 2π/n times 180/π.
  const [f, x, a0, b0] = c.args as [string, string, string, string];
  const sing = giac.eval(`singular(${f},${x})`);
  const pts = isError(sing) ? null : splitList(sing);
  if (!pts || pts.length === 0) return true;
  const A = realOf(giac, a0);
  const B = realOf(giac, b0);
  if (A === null || B === null) return true;
  const [lo, hi, a, b] = A <= B ? [A, B, a0, b0] : [B, A, b0, a0];
  const T = periodOf(giac, f, x, angle === "deg" ? "(180/pi)" : "1");
  const Tv = T === null ? null : realOf(giac, T);
  const near: string[] = [];
  for (const p of pts) {
    if (!onlyNames(giac, p, [])) continue;
    const pv = realOf(giac, p);
    if (pv === null) continue; // a complex singular point (1/(2+cos x)) is not on the path
    if (T === null || Tv === null || Tv <= 0) {
      if (pv >= lo && pv <= hi) near.push(p);
      continue;
    }
    // f(x+T) = f(x): every shift of p behaves like p, so one shift inside (a, b) is enough; an end point counts too.
    const n0 = Math.ceil((lo - pv) / Tv);
    const n1 = Math.floor((hi - pv) / Tv);
    if (!(n0 <= n1)) continue;
    const ns = Number.isFinite(n0) && Number.isFinite(n1) ? (n1 - n0 >= 2 ? [n0 + 1] : [n0, n1]) : [Number.isFinite(n0) ? n0 + 1 : Number.isFinite(n1) ? n1 - 1 : 0];
    for (const n of new Set(ns)) near.push(n === 0 ? p : `(${p})+(${n})*${T}`);
  }
  for (const q of near.slice(0, MAX_POINTS)) {
    const qv = realOf(giac, q)!;
    const w1 = qv - 1 <= lo ? a : `(${q})-1`;
    const w2 = qv + 1 >= hi ? b : `(${q})+1`;
    const r = giac.eval(`int(abs(${f}),${x},${w1},${w2})`).trim();
    if (!isError(r) && notFinite(r)) return false;
  }
  return true;
}

/**
 * The refusal for an input whose result `output` is a number for something that does not exist; null to keep it.
 * `input` is what ran (decimals exact). Giac's `undef` for an input that holds a definite integral, a series or a limit
 * is refused with that call's message, and so is a `bounded_function(…)` left in the result of a limit.
 */
export function refusalOf(giac: Giac, input: string, output: string, angle: "rad" | "deg"): Refusal | null {
  const calls = callsIn(input);
  if (!calls.length) return null;
  const out = output.trim();
  if (out === "undef") {
    const c = calls.find((k) => k.kind === "limit" || k.args.length >= 4);
    if (c) return REFUSAL[c.kind];
  }
  if (/bounded_function\s*\(/.test(out) && calls.some((c) => c.kind === "limit")) return "noLimit";
  // The calls to check, with their values in the input's own mode; then the checks, in radians.
  const todo: Call[] = [];
  for (const c of calls) {
    if (c.kind === "limit" || c.args.length !== 4) continue;
    const [body, v, a, b] = c.args as [string, string, string, string];
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) continue;
    // Only a fully numeric call: a free name (Σ x^k = 1/(1−x)) leaves an answer with conditions, which stays.
    if (!onlyNames(giac, body, [v]) || !onlyNames(giac, a, []) || !onlyNames(giac, b, [])) continue;
    if (c.kind === "sum" && !/\binf\b|infinity/.test(`${a},${b}`)) continue;
    const value = valueOf(giac, c, input, out).trim();
    if (value === "undef") return REFUSAL[c.kind];
    const pair = c.kind === "int" ? giacPair(value) : null;
    if (!pair && !finiteValue(value)) continue;
    todo.push(angle === "deg" ? { ...c, args: c.args.map(inRadians) } : c);
  }
  if (!todo.length) return null;
  if (angle === "deg") giac.eval("angle_radian:=1");
  try {
    for (const c of todo) if (!(c.kind === "sum" ? seriesOk(giac, c) : integralOk(giac, c, angle))) return REFUSAL[c.kind];
  } finally {
    if (angle === "deg") giac.eval("angle_radian:=0");
  }
  return null;
}

/**
 * Giac's [exact, numeric] pair (E6): when its own check of an antiderivative fails, a definite integral returns both
 * answers as a two-element list, the exact one first. The two elements, or null when `output` is not that shape.
 */
export function giacPair(output: string): { exact: string; numeric: string } | null {
  const els = splitList(output);
  if (!els || els.length !== 2) return null;
  const [e, n] = els as [string, string];
  if (hasFloat(e) || !/^-?\d+(\.\d*)?(e[+-]?\d+)?$/.test(n) || !n.includes(".")) return null;
  return { exact: e, numeric: n };
}

/** The input holds a definite integral (four arguments): only then is a two-element list read as Giac's pair. */
export function hasDefiniteIntegral(input: string): boolean {
  return callsIn(input).some((c) => c.kind === "int" && c.args.length === 4) && !input.trim().startsWith("[");
}
