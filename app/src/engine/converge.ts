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
import { hasFloat, type Giac } from "./numeric.ts";
import { callsOf, functionsIn, isName, splitList, topLevelArgs, wordsOf } from "./giacPrint.ts";

/** Why a result is refused; the UI shows `error.<code>` from the i18n table (enEngine.ts). */
/** `undecided` (G57) comes from decisions.ts decideTwice: a decision on a cut Giac cannot make. `divisionByZero`,
 *  `overflow` and `noValue` (G78) come from novalue.ts: a value through an infinity, or a number asked for and not found;
 *  `underflow` (G84) too: a value that reads as 0 while Giac's exact answer is not 0. `notSquare` (G97) comes from
 *  nonsquare.ts: a power, inverse or division of a matrix that is not square. `listPlusNumber` (G106) comes from
 *  polyvec.ts: Giac's polynomial of a list plus a number. */
export type Refusal = "integralDiverges" | "seriesDiverges" | "noLimit" | "undecided" | "divisionByZero" | "overflow" | "underflow" | "noValue" | "notSquare" | "listPlusNumber";

/** A check's answer: the result stands, it is refused, or the check could not finish (an error or Giac's timeout), in
 *  which case the result stands with ⚠ (nothing confirmed that it exists). */
type Verdict = "ok" | "diverges" | "unchecked";

type Kind = "int" | "sum" | "limit";

const KIND: Readonly<Record<string, Kind>> = { int: "int", integrate: "int", sum: "sum", limit: "limit" };
const KINDS = Object.keys(KIND);
const REFUSAL: Readonly<Record<Kind, Refusal>> = { int: "integralDiverges", sum: "seriesDiverges", limit: "noLimit" };

interface Call {
  kind: Kind;
  text: string;
  args: string[];
}

/** Every int/integrate/sum/limit call in `input` (nested ones too), in text order; strings are skipped. */
export function callsIn(input: string): Call[] {
  const out: Call[] = [];
  // A name that merely ends in the word (`myint(`) is not a call of it.
  for (const { name, at, open, close } of callsOf(input, KINDS)) {
    if (close >= 0) out.push({ kind: KIND[name]!, text: input.slice(at, close + 1), args: topLevelArgs(input.slice(open + 1, close)).map((a) => a.trim()) });
  }
  return out;
}

const isError = (t: string): boolean => t.startsWith("GIAC_ERROR");
/** Giac's text for "no finite number": undef, or an infinity anywhere in it. */
const notFinite = (t: string): boolean => t === "undef" || /infinity|\binf\b/.test(t);
/** A result that is a value we may test: no infinity, no undef, no unevaluated call of the same kind left in it. */
const finiteValue = (t: string): boolean => !isError(t) && !notFinite(t) && !callsOf(t, KINDS, "printed").length;

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

/** The series check: the term of `sum(t,k,a,b)` tends to 0 at each infinite end. Runs in radians. */
function seriesCheck(giac: Giac, c: Call): Verdict {
  const [t, k, a, b] = c.args as [string, string, string, string];
  const ends = [realOf(giac, b) === Infinity ? "inf" : null, realOf(giac, a) === -Infinity ? "-inf" : null].filter((e): e is string => e !== null);
  for (const end of ends) {
    const l = giac.eval(`limit(${t},${k},${end})`).trim();
    if (l === "0") continue;
    if (isError(l)) return "unchecked";
    if (limitNonZero(giac, l)) return "diverges";
    // Anything else (`1/((+infinity)!)` for 1/k!, an unevaluated limit) is not a proof of divergence: kept.
  }
  return "ok";
}

/** Giac's limit text `l` is not 0: bounded_function(…) (no limit), undef, ±infinity, or a non-zero number. */
function limitNonZero(giac: Giac, l: string): boolean {
  if (/bounded_function/.test(l) || l === "undef" || /^[+-]?infinity$/.test(l)) return true;
  const v = giac.eval(`evalf(abs(${l}),30)`).trim();
  return /^[\d.]+(e[+-]?\d+)?$/.test(v) && Number(v) !== 0;
}

const PERIODIC = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);
/** Periods tried for a trig integrand: 2π/n (in radians; a DEG integrand is rewritten first), largest n first, so the
 *  smallest period is found. */
const PERIOD_DIVISORS = [12, 10, 8, 6, 5, 4, 3, 2, 1];

/** The smallest period 2π/n of `f` among PERIOD_DIVISORS, as Giac text; null when none fits. Tested at two points at
 *  30 digits (a wrong period only costs a second integral at a point that is not singular). */
function periodOf(giac: Giac, f: string, x: string, scale: string): string | null {
  if (!functionsIn(f).some((n) => PERIODIC.has(n))) return null;
  // Exact test points: a float literal would make Giac compute in doubles, whose 1e-14 error exceeds the 1e-20 margin,
  // so no period (not even tan's π) was ever found.
  const points = ["3171/10000", "11937/10000"].map((p) => `(${p})*${scale}`);
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

/** Most points near which ∫|f| is checked; more singular points in [a, b] leave the result unchecked (⚠). */
const MAX_POINTS = 8;

/** The trig calls of `f` (`tan(2*x)` in `x*tan(2*x)`), outermost first; strings skipped. */
function periodicCalls(f: string): string[] {
  const out: string[] = [];
  for (const { at, close } of callsOf(f, PERIODIC)) if (close >= 0) out.push(f.slice(at, close + 1));
  return out;
}

/** f has no finite value at `q` (a pole, or a point Giac cannot evaluate): read as a singular point. */
function singularAt(giac: Giac, f: string, x: string, q: string): boolean {
  const t = giac.eval(`evalf(subst(${f},${x},${q}),30)`).trim();
  return isError(t) || t === "undef" || /infinity/.test(t);
}

/** The integral check: near every real singular point of f in [a, b], ∫|f| is finite. */
function integralCheck(giac: Giac, c: Call): Verdict {
  // A DEG integrand holds the degree factor (sin(pasdeg*x), R64), so its period is 2π/n over pasdeg (G46: Giac runs in
  // radians and pasdeg is π/180 in DEG, 1 in RAD).
  const [f, x, a0, b0] = c.args as [string, string, string, string];
  const sing = giac.eval(`singular(${f},${x})`);
  const pts = isError(sing) ? null : splitList(sing);
  if (!pts || pts.length === 0) return "ok";
  const A = realOf(giac, a0);
  const B = realOf(giac, b0);
  if (A === null || B === null) return "ok";
  const [lo, hi, a, b] = A <= B ? [A, B, a0, b0] : [B, A, b0, a0];
  const scale = "(1/pasdeg)";
  const T = periodOf(giac, f, x, scale);
  const Tv = T === null ? null : realOf(giac, T);
  // f holds a trig function but is not periodic itself (tan(x)+x, x*tan(x)): singular() lists the points of one period
  // only, and the shifts are not alike (x·tan x and (x−3π/2)·tan x differ at 3π/2), so every shift inside [a, b] by the
  // period of each trig subterm is checked; too many, or infinitely many, leave the result unchecked.
  const subPeriods: { T: string; v: number }[] = [];
  if (T === null) {
    for (const g of periodicCalls(f)) {
      const Tg = periodOf(giac, g, x, scale);
      const v = Tg === null ? null : realOf(giac, Tg);
      if (Tg !== null && v !== null && v > 0 && !subPeriods.some((s) => Math.abs(s.v - v) < 1e-12 * v)) subPeriods.push({ T: Tg, v });
    }
  }
  let overflow = false;
  const near: string[] = [];
  const nearV: number[] = [];
  const add = (q: string, v: number): void => {
    if (nearV.some((w) => Math.abs(w - v) <= 1e-12 * Math.max(1, Math.abs(v)))) return;
    if (near.length >= MAX_POINTS) overflow = true;
    else {
      near.push(q);
      nearV.push(v);
    }
  };
  for (const p of pts) {
    if (!onlyNames(giac, p, [])) continue;
    const pv = realOf(giac, p);
    if (pv === null) continue; // a complex singular point (1/(2+cos x)) is not on the path
    if (T === null || Tv === null || Tv <= 0) {
      if (pv >= lo && pv <= hi) add(p, pv);
      for (const s of subPeriods) {
        // A shift where f is finite (sin(x)/x at 2π) shows the subterm brings no pole there: no shifts for it.
        if (!singularAt(giac, f, x, `(${p})+${s.T}`) && !singularAt(giac, f, x, `(${p})-${s.T}`)) continue;
        const n0 = Math.ceil((lo - pv) / s.v);
        const n1 = Math.floor((hi - pv) / s.v);
        if (!(n0 <= n1)) continue;
        if (!Number.isFinite(n0) || !Number.isFinite(n1) || n1 - n0 + 1 > MAX_POINTS) {
          overflow = true;
          continue;
        }
        for (let n = n0; n <= n1; n++) if (n !== 0) add(`(${p})+(${n})*${s.T}`, pv + n * s.v);
      }
      continue;
    }
    // f(x+T) = f(x): every shift of p behaves like p, so one shift inside (a, b) is enough; an end point counts too.
    const n0 = Math.ceil((lo - pv) / Tv);
    const n1 = Math.floor((hi - pv) / Tv);
    if (!(n0 <= n1)) continue;
    const ns = Number.isFinite(n0) && Number.isFinite(n1) ? (n1 - n0 >= 2 ? [n0 + 1] : [n0, n1]) : [Number.isFinite(n0) ? n0 + 1 : Number.isFinite(n1) ? n1 - 1 : 0];
    for (const n of new Set(ns)) add(n === 0 ? p : `(${p})+(${n})*${T}`, pv + n * Tv);
  }
  // Points past MAX_POINTS were not checked, so the result is never "ok" then (a dropped pole may be the divergent one).
  let verdict: Verdict = overflow ? "unchecked" : "ok";
  for (const q of near) {
    const qv = realOf(giac, q)!;
    // Cheap and sufficient first: (x−q)·f(x) tending to a non-zero value or ∞ at q means |f| ≥ c/|x−q| near q, which is
    // not integrable (1/x, tan at π/2, 1/x³). From the side that lies in [a, b] when q is an end point.
    const dir = qv <= lo ? ",1" : qv >= hi ? ",-1" : "";
    const l = giac.eval(`limit((${x}-(${q}))*(${f}),${x},${q}${dir})`).trim();
    if (!isError(l) && l !== "0" && limitNonZero(giac, l)) return "diverges";
    const w1 = qv - 1 <= lo ? a : `(${q})-1`;
    const w2 = qv + 1 >= hi ? b : `(${q})+1`;
    const r = giac.eval(`int(abs(${f}),${x},${w1},${w2})`).trim();
    if (isError(r)) verdict = "unchecked";
    else if (notFinite(r)) return "diverges";
  }
  return verdict;
}

/**
 * The refusal for an input whose result `output` is a number for something that does not exist; null to keep it;
 * "unchecked" when a check could not finish (the result is kept with ⚠).
 * `input` is what ran (decimals exact). Giac's `undef` for an input that holds a definite integral, a series or a limit
 * is refused with that call's message, and so is a `bounded_function(…)` left in the result of a limit.
 */
export function refusalOf(engine: Giac, input: string, output: string, home = false): Refusal | "unchecked" | null {
  const calls = callsIn(input);
  if (!calls.length) return null;
  // Giac's timeout can stop any step of a check (singular, a limit, the second integral); a step it stopped proves
  // nothing, so the check then ends "unchecked" unless another step already proved the divergence.
  let interrupted = false;
  const giac: Giac = {
    value: (t, p, tree) => engine.value(t, p, tree),
    eval: (t) => {
      const o = engine.eval(t);
      if (/^GIAC_ERROR/.test(o) && /interrupt/i.test(o)) interrupted = true;
      return o;
    },
  };
  const verdict = check(giac, calls, input, output, home);
  return verdict === null && interrupted ? "unchecked" : verdict;
}

function check(giac: Giac, calls: Call[], input: string, output: string, home: boolean): Refusal | "unchecked" | null {
  const out = output.trim();
  if (out === "undef") {
    const c = calls.find((k) => k.kind === "limit" || k.args.length >= 4);
    if (c) return REFUSAL[c.kind];
  }
  if (/bounded_function\s*\(/.test(out) && calls.some((c) => c.kind === "limit")) return "noLimit";
  // G78 (Home only; the CAS view keeps Giac's ∞): a definite integral whose value is an infinity does not converge
  // (∫₋₁¹ 1/x² = +∞); a limit keeps its ∞.
  if (home && /^[+-]?infinity$/.test(out)) {
    const c = calls.find((k) => k.kind === "int" && k.args.length === 4 && /infinity/.test(valueOf(giac, k, input, out)));
    if (c) return "integralDiverges";
  }
  // The calls to check (Giac runs in radians in every mode, G46).
  const todo: Call[] = [];
  for (const c of calls) {
    if (c.kind === "limit" || c.args.length !== 4) continue;
    const [body, v, a, b] = c.args as [string, string, string, string];
    if (!isName(v, true)) continue;
    // Only a fully numeric call: a free name (Σ x^k = 1/(1−x)) leaves an answer with conditions, which stays.
    if (!onlyNames(giac, body, [v]) || !onlyNames(giac, a, []) || !onlyNames(giac, b, [])) continue;
    if (c.kind === "sum" && !wordsOf(`${a},${b}`).some((w) => w === "inf" || w === "infinity")) continue;
    const value = valueOf(giac, c, input, out).trim();
    if (value === "undef") return REFUSAL[c.kind];
    const pair = c.kind === "int" ? giacPair(value) : null;
    if (!pair && !finiteValue(value)) continue;
    todo.push(c);
  }
  if (!todo.length) return null;
  let unchecked = false;
  for (const c of todo) {
    const v = c.kind === "sum" ? seriesCheck(giac, c) : integralCheck(giac, c);
    if (v === "diverges") return REFUSAL[c.kind];
    if (v === "unchecked") unchecked = true;
  }
  return unchecked ? "unchecked" : null;
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

/** An unevaluated integral call in Giac's text. */
const hasIntegral = (t: string): boolean => callsOf(t, ["int", "integrate"], "printed").length > 0;

/**
 * G90 (F65, F67): `input` with each definite integral's bounds made floats (`int(f,x,evalf(a),evalf(b))`, nested ones
 * too). Giac then integrates the typed integrand numerically (intg.cc `tegral`, adaptive Gauss in a double at any
 * Digits), not the rewrite its exact attempt left (`6*pi/ln(12)+integrate(…)`, singular where the typed one is not).
 */
export function floatBounds(input: string): string {
  let out = "";
  let i = 0;
  for (const { name, at, open, close } of callsOf(input, ["int", "integrate"])) {
    if (at < i || close < 0) continue;
    const args = topLevelArgs(input.slice(open + 1, close)).map(floatBounds);
    const bounds = args.length === 4 ? [args[0]!, args[1]!, `evalf(${args[2]!.trim()})`, `evalf(${args[3]!.trim()})`] : args;
    out += `${input.slice(i, at)}${name}(${bounds.join(",")})`;
    i = close + 1;
  }
  return out + input.slice(i);
}

/**
 * G90: the value of `input` is Giac's numeric integration (docs/04 2.4 rule 3): it holds a definite integral and Giac's
 * exact answer of one keeps an unevaluated integral (no closed form). `output` is Giac's answer of the whole input: one
 * without a float is that exact answer (no Giac call); a float (`evalf(int(…))`) costs one exact run of each integral.
 */
export function integratedNumerically(giac: Giac, input: string, output: string): boolean {
  if (!hasDefiniteIntegral(input)) return false;
  if (!hasFloat(output)) return hasIntegral(output);
  return callsIn(input).some((c) => c.kind === "int" && c.args.length === 4 && hasIntegral(giac.eval(c.text)));
}
