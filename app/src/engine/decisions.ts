// SPDX-License-Identifier: GPL-3.0-or-later
// G38 (docs/04 2.4 rule 2): the decisions Giac makes inside an exact evaluation at `Digits` (a sign, a place between two
// integers, a branch), and their second run at P + 20 and P + 40. Split out of numeric.ts (G71). Synchronous, UI-free;
// only erasable TypeScript syntax.
import {
  closing,
  DOUBLE_DIGITS,
  functionsIn,
  hasFloat,
  namePrint,
  namesIn,
  numbersAt,
  shapeOfValue,
  size,
  topLevelArgs,
  valuePrecision,
  withDigits,
  type ElementFacts,
  type Giac,
  type Shape,
} from "./numeric.ts";

import { decimalFromString, isZero, type DecimalValue } from "./format.ts";
import type { GiacValue } from "./bridge.ts";

const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;
const INTEGER = /^\s*\d+\s*$/;

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/**
 * Functions whose result rests on a numeric decision Giac makes at `Digits` inside the exact evaluation: the sign of a
 * value, its place between two integers, or a branch (deep check 2026-10-19 E1). `int`, `sum`, `limit` and `solve`
 * decide signs inside. An input that calls one of them is evaluated again at P + 20 (decideTwice).
 */
export const DECISION_FUNCTIONS: ReadonlySet<string> = new Set([
  "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "sign", "Heaviside", "abs", "max", "min", "piecewise", "when",
  "ifte", "int", "integrate", "sum", "limit", "solve",
  // G71's census (tools/probes/tier1-decide.ts): tier-1 functions that decide a sign inside on sin(10^70) at P.
  "arg", "angle", "instphase", "norm", "normalize", "polar", "polar_coordinates", "tri", "dfc", "classes", "Psi",
]);

/** A comparison operator (`<`, `>`, `<=`, `>=`, `==`, `!=`, `<>`) at `k` in `s`, with its length; 0 when there is none.
 *  `->` and `=>` are not comparisons. */
function comparisonAt(s: string, k: number): number {
  const two = s.slice(k, k + 2);
  if (two === "<=" || two === ">=" || two === "==" || two === "!=" || two === "<>") return 2;
  const c = s.charAt(k);
  if (c === "<") return 1;
  if (c === ">" && s.charAt(k - 1) !== "-" && s.charAt(k - 1) !== "=") return 1;
  return 0;
}

/** The input holds a comparison outside strings. */
function hasComparison(input: string): boolean {
  const s = input.replace(/"[^"]*"/g, '""');
  for (let k = 0; k < s.length; k++) if (comparisonAt(s, k)) return true;
  return false;
}

/** Functions that map rationals to rationals and decide on rationals only (exactly, at any Digits). */
const RATIONAL_FUNCTIONS: ReadonlySet<string> = new Set([
  "sum", "product", "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "sign", "abs", "max", "min", "piecewise", "when",
  "ifte", "irem", "iquo", "gcd", "lcm", "comb", "factorial", "pasmod",
]);

/**
 * Every atom of `expr` (decimals already exact) is rational, so Giac's decisions in it are exact and Digits plays no
 * part: integers, the RATIONAL_FUNCTIONS, the bound variable of a finite sum or product, and powers whose exponent
 * holds no `/` (`1.1^k`, `2^-3`; not `2^(1/2)`). `sum(1/k,k,1,1000)` needs no second run; `sum(1/k^2,k,1,inf)`
 * (a name, inf) and anything with pi, sqrt or a stored name does.
 */
export function rationalOnly(expr: string): boolean {
  if (expr.includes('"') || /[.]/.test(expr)) return false;
  if (!functionsIn(expr).every((f) => RATIONAL_FUNCTIONS.has(f))) return false;
  const bound = new Set<string>();
  const re = /\b(?:sum|product)\s*\(/g;
  for (let m = re.exec(expr); m; m = re.exec(expr)) {
    const close = closing(expr, re.lastIndex - 1);
    if (close < 0) return false;
    const args = topLevelArgs(expr.slice(re.lastIndex, close));
    if (args.length !== 4 || !/^\s*[A-Za-z_][A-Za-z0-9_]*\s*$/.test(args[1]!)) return false;
    if (!INTEGER.test(args[2]!.replace(/^\s*-/, "")) || !INTEGER.test(args[3]!.replace(/^\s*-/, ""))) return false;
    bound.add(args[1]!.trim());
  }
  if (!namesIn(expr).every((n) => bound.has(n))) return false;
  // A power's exponent: a parenthesised one holding `/`, or a name that is not a bound variable, can be irrational.
  const pow = /\^\s*(\(|-?\s*[A-Za-z_0-9]+)/g;
  for (let m = pow.exec(expr); m; m = pow.exec(expr)) {
    if (m[1] === "(") {
      const close = closing(expr, pow.lastIndex - 1);
      if (close < 0 || expr.slice(pow.lastIndex, close).includes("/")) return false;
    }
  }
  return true;
}

/** G48: a name the input calls is a stored function whose printed definition rests on a decision, directly or through
 *  another stored function (recursion ends: a name being visited counts as not deciding). */
export function decidingStored(giac: Giac): (name: string) => boolean {
  const known = new Map<string, boolean>();
  const decides = (name: string): boolean => {
    const k = known.get(name);
    if (k !== undefined) return k;
    known.set(name, false);
    const def = namePrint(giac, name);
    const r = def !== `'${name}'` && /->/.test(def) && restsOnDecision(def, "", decides);
    known.set(name, r);
    return r;
  };
  return decides;
}

/** The result of `input` (printed as `result`) may rest on a decision Giac made at `Digits`: the input calls a
 *  decision function, or a name that is not a Giac built-in (`stored`: a stored function's body may decide,
 *  `f(x):=floor(x*10^12)` then `f(sin(10^60))`), or holds a comparison, or the result holds `abs(` (sqrt of an even
 *  power comes back as one). An input of rationals only (rationalOnly) decides exactly. */
export function restsOnDecision(input: string, result: string, stored: (name: string) => boolean = () => false): boolean {
  if (rationalOnly(input)) return false;
  const calls = functionsIn(input);
  return calls.some((f) => DECISION_FUNCTIONS.has(f)) || hasComparison(input) || result.includes("abs(") || calls.some(stored);
}

/** A quantity whose sign (`zero`), distance to the nearest integer (`int`) or to the nearest half-integer (`half`)
 *  decides a discrete result. */
interface Cut {
  q: string;
  kind: "zero" | "int" | "half";
  /** The call it decides (floor, ceil, trunc, iPart, frac, fPart, sign): its name and [start, end) in the input. */
  call?: { name: string; at: [number, number] };
}

/** The one top-level comparison of `seg` as `(lhs)-(rhs)`; null when it has none or more than one. */
function comparisonCut(seg: string): string | null {
  let depth = 0;
  let at = -1;
  let len = 0;
  for (let k = 0; k < seg.length; k++) {
    const ch = seg.charAt(k);
    if (ch === '"') {
      const end = seg.indexOf('"', k + 1);
      if (end < 0) return null;
      k = end;
    } else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (depth === 0) {
      const n = comparisonAt(seg, k);
      if (n) {
        if (at >= 0) return null;
        at = k;
        len = n;
        k += n - 1;
      }
    }
  }
  if (at < 0) return null;
  const lhs = seg.slice(0, at).trim();
  const rhs = seg.slice(at + len).trim();
  return lhs && rhs ? `(${lhs})-(${rhs})` : null;
}

/** The cuts of every discrete decision in `expr`: floor, ceil, trunc, iPart, frac, fPart (an integer), round (a
 *  half-integer), sign, Heaviside and every comparison (zero); the two-argument trunc(x,n) cuts x·10^n at an integer.
 *  abs, max and min are continuous: a wrong branch at a tie gives the same value, and away from one the second
 *  evaluation finds it. */
export function decisionCuts(expr: string): Cut[] {
  const cuts: Cut[] = [];
  const segments = [expr];
  const opening = /"[^"]*"|(?:\b([A-Za-z_][A-Za-z0-9_]*)\s*)?\(/g;
  for (let m = opening.exec(expr); m; m = opening.exec(expr)) {
    if (m[0].startsWith('"')) continue;
    const open = opening.lastIndex - 1;
    const close = closing(expr, open);
    if (close < 0) continue;
    const args = topLevelArgs(expr.slice(open + 1, close));
    segments.push(...args);
    const name = m[1];
    const call = name ? { name, at: [m.index, close + 1] as [number, number] } : undefined;
    if ((name === "floor" || name === "ceil" || name === "trunc" || name === "iPart" || name === "frac" || name === "fPart") && args.length === 1) {
      cuts.push({ q: args[0]!, kind: "int", call });
    } else if (name === "trunc" && args.length === 2) {
      cuts.push({ q: `(${args[0]!})*10^(${args[1]!})`, kind: "int" });
    } else if (name === "round" && (args.length === 1 || args.length === 2)) {
      cuts.push({ q: args.length === 1 ? args[0]! : `(${args[0]!})*10^(${args[1]!})`, kind: "half" });
    } else if (name === "sign" && args.length === 1) cuts.push({ q: args[0]!, kind: "zero", call });
    // Heaviside(0) has no value to put in its place (conventions differ): a proven tie on it stays ⚠.
    else if (name === "Heaviside" && args.length === 1) cuts.push({ q: args[0]!, kind: "zero" });
  }
  for (const seg of segments) {
    const q = comparisonCut(seg);
    if (q) cuts.push({ q, kind: "zero" });
  }
  return cuts;
}

/**
 * The decisions of `expr` that sit on their cut: the quantity is not an exact rational, and its distance to the cut
 * does not agree with itself at P + 20 and P + 40 digits (it is 0, or below the noise of both). Giac then decides by
 * its rounding error, and both precisions can agree on a wrong text. Only a distance Giac proves to be 0 (`simplify` or
 * `normal` gives 0) is a tie: `tie` is `expr` with every such floor, ceil, iPart, frac, fPart and sign call replaced
 * by its value exactly on the cut (floor(1) = trunc(1) = 1, sign(0) = 0). Any other hit is `undecided`: the distance may be tiny
 * and not 0 (`floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2-10^-100)` is 0, Giac gives 0 at 40 and 60 digits and 1 at
 * 80), so neither text can be trusted. So is a proven tie on a comparison or a round (no value to put in its place).
 * `floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)` (exactly 1) is undecided too: Giac does not prove the sum is 1/2.
 * A quantity that is not a real number (a free name, a bound variable) is skipped.
 */
export function onCut(giac: Giac, expr: string, digits: number, restore: number): { tie: string } | Undecided | null {
  if (/:=|=>|\bsto\s*\(/.test(expr)) return null;
  const P = valuePrecision(digits);
  const cuts = decisionCuts(expr);
  if (!cuts.length) return null;
  return withDigits(giac, P + 40, restore, () => {
    const hits: { cut: Cut; n: string; proven: boolean }[] = [];
    try {
      for (const c of cuts) {
        const h = cutHit(giac, c, P);
        if (h) hits.push(h);
      }
    } finally {
      giac.eval("purge(pasbx)");
    }
    return tieOf(expr, hits);
  });
}

/** onCut's answer from the decisions that sat on their cut (`hits`). */
function tieOf(expr: string, hits: readonly { cut: Cut; n: string; proven: boolean }[]): { tie: string } | Undecided | null {
  if (!hits.length) return null;
  // G57: a tie Giac cannot prove is refused; a proven one with no value to put in its place stays ⚠.
  if (hits.some((h) => !h.proven)) return { undecided: true, refused: true };
  if (hits.some((h) => !h.cut.call || !RATIONAL.test(h.n))) return { undecided: true };
  // Outermost calls first; one inside a replaced call goes with it.
  const calls = hits.map((h) => ({ ...h.cut.call!, n: h.n })).sort((u, v) => u.at[0] - v.at[0] || v.at[1] - u.at[1]);
  let tie = "";
  let k = 0;
  for (const c of calls) {
    if (c.at[0] < k) continue;
    const value = c.name === "frac" || c.name === "fPart" || c.name === "sign" ? "0" : c.n;
    tie += `${expr.slice(k, c.at[0])}(${value})`;
    k = c.at[1];
  }
  return { tie: tie + expr.slice(k) };
}

/** A decimal as n / 10^k. */
function scaled(v: DecimalValue): { n: bigint; k: number } {
  if (isZero(v)) return { n: 0n, k: 0 };
  const k = v.digits.length - (v.exp + 1);
  const d = BigInt(v.digits) * 10n ** BigInt(Math.max(0, -k));
  return { n: v.neg ? -d : d, k: Math.max(0, k) };
}

/** ⌊n / 10^k⌋. */
function floorOf(x: { n: bigint; k: number }): bigint {
  const q = 10n ** BigInt(x.k);
  const f = x.n / q;
  return x.n < 0n && f * q !== x.n ? f - 1n : f;
}

/** |a - b| < |b|/2: the distance to the cut agrees with itself at the two precisions. */
function agrees(a: DecimalValue, b: DecimalValue): boolean {
  const A = scaled(a);
  const B = scaled(b);
  const k = Math.max(A.k, B.k);
  const at = (x: { n: bigint; k: number }): bigint => x.n * 10n ** BigInt(k - x.k);
  const d = at(A) - at(B);
  const m = at(B);
  return 2n * (d < 0n ? -d : d) < (m < 0n ? -m : m);
}

/**
 * G103: one cut of onCut through bridge-3: the quantity (stored in pasbx) with its digits at P + 20, its nearest cut n
 * from them (here, not by Giac's round or floor: away from the cut any n gives a distance that agrees with itself), and
 * the distance pasbx - n at P + 20 and P + 40 (bridge-3's at[]), compared here. Two calls, a third and a fourth only to
 * prove a tie; null when the decision is not on its cut, or cannot be on one (a rational quantity or distance, no real
 * number).
 */
function cutHit(giac: Giac, c: Cut, P: number): { cut: Cut; n: string; proven: boolean } | null {
  const value = (text: string, precisions: readonly number[]): GiacValue => giac.value(text, precisions);
  const exactly = (v: GiacValue): boolean => isError(v.text) || v.kind === "integer" || v.kind === "rational";
  const real = (v: GiacValue, prec: number): DecimalValue | null => {
    const at = v.at?.[String(prec)];
    const re = at?.length === 1 ? decimalFromString(at[0]![0], P + 60) : null;
    return re && at![0]![1] === "0" ? re : null;
  };
  const x = value(`pasbx:=(${c.q})`, [P + 20]);
  if (exactly(x)) return null;
  const x20 = real(x, P + 20);
  if (!x20) return null;
  // G103f1: the powers of ten below grow with the exponent (floor(exp(10^8)) made a BigInt of 43 million digits, past
  // the deadline, and past V8's limit a RangeError). With no fractional digit known, or a distance out of reach, the
  // place is not known: an unproven hit, refused as an unproven tie is.
  const unknown = { cut: c, n: "", proven: false };
  if (c.kind !== "zero" && !isZero(x20) && x20.exp >= P + 20) return unknown;
  // the nearest integer, ⌊x + 1/2⌋ = ⌊⌊2x + 1⌋ / 2⌋, or the nearest half-integer ⌊x⌋ + 1/2; for a quantity below
  // 10^-(P+60) they are 0 (the distance is then the quantity, out of reach below) and ±1/2, with no power of ten
  const nearOf = (kind: "int" | "half"): string => {
    if (!isZero(x20) && x20.exp < -(P + 60)) return kind === "int" ? "0" : x20.neg ? "-1/2" : "1/2";
    const s = scaled(x20);
    if (kind === "half") return `${(2n * floorOf(s) + 1n).toString()}/2`;
    const twice = floorOf({ n: 2n * s.n + 10n ** BigInt(s.k), k: s.k });
    return (twice >= 0n ? twice / 2n : -((1n - twice) / 2n)).toString();
  };
  const near = c.kind === "zero" ? "0" : nearOf(c.kind);
  const d = value(`pasbx-(${near})`, [P + 20, P + 40]);
  if (exactly(d)) return null;
  const a = real(d, P + 20);
  const b = real(d, P + 40);
  if (!a || !b) return null;
  if ([a, b].some((v) => !isZero(v) && Math.abs(v.exp) > P + 60)) return unknown;
  if (agrees(a, b)) return null;
  // The tie must be proven: a distance below the noise of both precisions need not be 0.
  const proven = ["simplify", "normal"].some((f) => giac.eval(`${f}(pasbx-(${near}))`).trim() === "0");
  return { cut: c, n: near, proven };
}

/** A decision that did not hold. `refused` (G57): the two precisions printed different texts, or the decision sits on
 *  a cut Giac cannot prove a tie on, so any value shown would be a guess and the result is refused (`error.undecided`);
 *  without it (a higher precision failed to run, a proven tie with no value to put in its place) the result is ⚠. */
export type Undecided = { undecided: true; refused?: true };

/** What the second decision found: the text stands (`from` set when it is another evaluation's, stored in `pasdec2`,
 *  which the caller purges, with its `value` from bridge-3), or the evaluations disagree (`undecided`). */
export type Decision = { text: string; from?: string; value?: GiacValue } | Undecided;

/**
 * G38 (docs/04 2.4 rule 2): `expr`, whose exact evaluation at P printed `text`, is computed again at P + 20 and must
 * print the same; if not, once more at P + 40, and the P + 20 and P + 40 texts must agree (the P + 40 value is kept in
 * `pasdec2`). An agreed text keeps its mark (a rational one stays `=`). A floor, ceil, iPart, frac, fPart or sign that
 * sits on its cut (onCut) takes the value it has exactly there when Giac proves the tie; an unproven one is undecided,
 * because Giac decides it by its rounding error and both precisions can agree on a wrong text. G57: an undecided result
 * whose texts differ or whose tie is unproven is `refused`.
 */
export function decideTwice(giac: Giac, expr: string, text: string, digits: number, restore: number): Decision {
  const P = valuePrecision(digits);
  // G103: the P + 20 text is only compared, so it goes through bridge-3 (nothing stored, nothing to purge; no `=` read
  // as a store, as giac_eval's equaltosto would). A print bridge-3 cut at 2 kB is read whole.
  const compared = (d: number): string | null =>
    withDigits(giac, d, restore, () => {
      const v = giac.value(`(${expr})`, []);
      if (isError(v.text)) return null;
      return v.cut ? giac.eval(`(${expr})`) : v.text;
    });
  // The P + 40 text may be kept: in pasdec2, which the caller reads and purges when `from` names it.
  let pasdec2 = false;
  // G103: with its value (bridge-3), which the caller reads instead of Ans's print (`value` of the decision)
  let keptValue: GiacValue | undefined;
  const kept = (e: string): string | null =>
    withDigits(giac, P + 40, restore, () => {
      pasdec2 = true;
      const v = giac.value(`pasdec2:=(${e})`, []);
      keptValue = v;
      if (isError(v.text)) return null;
      return v.cut ? giac.eval("pasdec2") : v.text;
    });
  const decided = (d: Decision): Decision => {
    if (pasdec2 && ("undecided" in d || d.from === undefined)) giac.eval("purge(pasdec2)");
    return d;
  };
  const t2 = compared(P + 20);
  let out: Decision;
  if (t2 === text) out = { text };
  else {
    const t3 = t2 === null ? null : kept(expr);
    out = t3 !== null && t3 === t2 ? { text: t3, from: "pasdec2", value: keptValue! } : t3 !== null ? { undecided: true, refused: true } : { undecided: true };
  }
  if ("undecided" in out) return decided(out);
  const cut = onCut(giac, expr, digits, restore);
  if (!cut) return decided(out);
  if ("undecided" in cut) return decided(cut);
  const tie = kept(cut.tie);
  return decided(tie === null || hasFloat(tie) ? out : { text: tie, from: "pasdec2", value: keptValue! });
}

/**
 * G71 (F59): `expr` evaluated with a double (Digits ≤ 14) into `name`, for an input whose evaluations at P and at W are
 * both errors. A function with no MPFR path (BesselJ, Airy_Ai) is an error at Digits > 14 ("Bad Argument Value") as
 * soon as a decision or a comparison needs its value (`round(BesselJ(1,2))`, `BesselJ(1,2)>0.5`); alone it stays as
 * text and doubleFallback reads it. Every decision is then made at the double and nothing confirms it: a number comes
 * back as facts with warn "unaudited" (its digits are the double's, at most DOUBLE_DIGITS), any other result (true,
 * false) as its text. Null when the double fails too, or when it gives no number and no plain text (a symbolic
 * result keeps the error).
 */
export function decidedAtDouble(
  giac: Giac,
  name: string,
  expr: string,
  digits: number,
): { facts: ElementFacts[]; shape: Shape } | { text: string } | null {
  return withDigits(giac, DOUBLE_DIGITS, digits, () => {
    // G103: stored and read in one call (bridge-3)
    const v = giac.value(`${name}:=(${expr})`, [DOUBLE_DIGITS]);
    if (v.kind === "error") return null;
    const t = v.text;
    const shape = shapeOfValue(v);
    const parts = shape ? numbersAt(v, DOUBLE_DIGITS, DOUBLE_DIGITS, size(shape)) : null;
    if (shape && parts) {
      const facts = parts.map((v): ElementFacts => ({ value: { re: v.re, im: v.im }, exact: false, reliableDigits: Math.min(digits, DOUBLE_DIGITS), warn: "unaudited", big: false }));
      return { facts, shape };
    }
    return t.trim() === "true" || t.trim() === "false" ? { text: t.trim() } : null;
  });
}
