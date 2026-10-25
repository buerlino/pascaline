// SPDX-License-Identifier: GPL-3.0-or-later
// Honest precision on the engine side (docs/04 sections 2.4, 2.5): read a result's value out of Giac, decide how many
// of its digits are confirmed, and whether it is an exact rational. The formatter (format.ts) turns these facts into
// the mark and the digits shown. Synchronous, UI-free; runs next to the engine. Only erasable TypeScript syntax.
//
// Three ways a number is checked:
// - symbolic (rule 2): an exact non-rational value (sqrt(2), Si(1), (1-erf(10/sqrt(2)))/2) is printed by `evalf` at
//   P and at P+20 digits; the digits on which the two agree are confirmed. When fewer than the digits setting agree,
//   one more step (P+20 against P+40) is tried, because a cancellation (UTPN(10)) only needs more working digits.
// - re-evaluated (rule 3): Giac's numeric code returned a float on the exact path (romberg, normald_icdf, BesselJ,
//   fsolve, or evalf typed by the user). The input is run again: with a double (Digits ≤ 14) and with MPFR at P when a
//   function in it is not audited (two different routines), or at P and P+20 when every function is audited.
// - float fallback: the input was evaluated in floating point at W and again at W+20.
// An `evalf(e,n)` typed in the input would pin every evaluation to n digits, so the two would agree on whatever n digits
// give: each evaluation raises it with its own precision (decisions M4-6). A stored variable holding a float carries the
// facts it was stored with (defs.ts); a result computed from it inherits them, and is checked again with the variable
// moved in its last confirmed digit (decisions M4-7).
import type { ValueFacts } from "./types.ts";
import {
  confirmedDigits,
  decimalFromRational,
  decimalFromString,
  isZero,
  roundSignificant,
  type ComplexValue,
  type DecimalValue,
  type PrecisionWarn,
  type PrecisionWhy,
} from "./format.ts";
import { ICDF_DIGITS, ICDF_FAILED, erfValueText, icdfCalls, icdfPolished } from "./icdf.ts";
import type { GiacValue } from "./bridge.ts";
import { callsOf, functionsIn, type Quoting, splitList, topLevelArgs, wholeCall } from "./giacPrint.ts";
import { complexReads, complexReplacedIn, complexSafe, forValue, nonReal, purgeReads } from "./complex.ts";

export interface Giac {
  eval(input: string): string;
  /** G97: the last eval printed Giac's "^ is ambiguous on non square matrices" (a power met a list that is not a square
   *  matrix); absent when the messages are not read (then unknown). */
  ambiguousPower?(): boolean;
  /** G102: sets Giac's Digits through bridge-1 (`giac_ctx_set` of decimal_digits) before the next Giac call, so two sets
   *  with no call between them are one (host.ts gated); absent: `Digits:=` as text. */
  digits?(d: number): void;
  /** G103: bridge-3 (`giac_value`): one evaluation of `text`, with its kind, print, num/den, elements and the parts of
   *  each element at every precision asked (`at[P]`). Every engine has it. */
  value(text: string, precisions: readonly number[], tree?: boolean): GiacValue;
}

/** Digits a Giac double prints with (Digits ≤ 14 selects doubles; they never print more than 14). */
export const DOUBLE_DIGITS = 14;

/** Value precision P = max(40, digits+10) (docs/04 section 2.5). */
export function valuePrecision(digits: number): number {
  return Math.max(40, digits + 10);
}

/**
 * Functions whose floats the agreement check may trust without a second routine (docs/04 section 2.4 rule 3): the
 * decimal conversion itself and the elementary functions, which Giac evaluates with MPFR at any precision and which
 * every `≈` result of home.yaml already goes through (checked against the oracle). Every other function that returns
 * a float on the exact path is "unaudited" and gets ⚠ until it is in Find's tier 0 with a golden case (G4, EN7).
 * Audited for real arguments and for complex ones (G50, `tools/probes/complex-audit.ts`: sqrt, exp, ln, log,
 * log10, sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, abs, arg and sign on 12 complex
 * arguments at 12, 30 and 50 digits). Giac's complex atan takes the other side of its cut, so it is evaluated through
 * COMPLEX_DEFINITIONS (complex.ts); complex tanh was coth until patch 0003 (G75), and ln of a negative MPFR real and
 * acos met pi as a double until patch 0005 (G60). Any part Giac still prints as a double where MPFR digits were asked
 * confirms one digit fewer than it prints (shortDigits). Giac runs in radians in every mode (G46), so DEG reads
 * the same routines (the probe's DEG rows).
 */
export const AUDITED_FUNCTIONS: ReadonlySet<string> = new Set([
  "evalf", "approx",
  "sqrt", "exp", "ln", "log", "log10", "sin", "cos", "tan", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "abs", "re", "im", "conj", "arg", "sign", "floor", "ceil", "round", "frac", "max", "min",
  "sigfig", "par", "eseries", "pasmedian", "paspercentile",
]);

const FLOAT_LITERAL = /(?<![A-Za-z_0-9.])(?:\d+\.\d*|\.\d+|\d+(?=e[+-]?\d))(?:e[+-]?\d+)?/;

/** Giac printed a float somewhere in this text (its exact results never contain one). */
export function hasFloat(text: string): boolean {
  return FLOAT_LITERAL.test(text);
}

/**
 * G38: `text` (Giac's print of a value computed at P digits) with every float printed as Giac prints it at the display
 * digits `n` (the host's Digits must be `n`): each literal is rounded to n significant digits here and read back by
 * Giac, which prints it in its own style (`3.33333333333e+19`, `0.5`). The input is not run again, so no decision
 * made at P is redone at n (`piecewise(sin(10^50)>0,x,evalf(1/2)*x)` stays 0.5*x).
 */
export function floatsAtDigits(giac: Giac, text: string, n: number): string {
  return text.replace(new RegExp(FLOAT_LITERAL.source, "g"), (lit) => {
    const m = /^(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(lit);
    if (!m) return lit;
    const all = m[1]! + m[2]!;
    const lead = all.search(/[1-9]/);
    if (lead < 0) return "0.0";
    let digits = all.slice(lead);
    let exp = m[1]!.length - lead + Number(m[3] ?? 0); // value = 0.<digits> × 10^exp
    if (digits.length <= n) return lit;
    let kept = BigInt(digits.slice(0, n)) + (digits.charAt(n) >= "5" ? 1n : 0n);
    if (kept.toString().length > n) {
      kept /= 10n;
      exp += 1;
    }
    digits = kept.toString();
    const out = giac.eval(`0.${digits}e${exp}`);
    return isError(out) ? lit : out.trim();
  });
}

/** G58: the longest text Home runs Giac's regroup on. regroup does not look at its interrupt, and on long texts it ran
 *  past 20 s (DEG acos(10^400) before G46, r16 A.3); a longer text is shown as Giac printed it. */
export const REGROUP_MAX = 2048;

/** G38: Giac's text `text` of a non-number computed at P, read back into `slot` with its floats at the display digits
 *  `n` (floatsAtDigits; the host's Digits must be `n`), so Giac orders and prints it as at n (`x^2-2.0`, where the P
 *  floats print `-2.000…+x^2`; regroup sorts the terms). Null when it does not read back. */
export function floatsShown(giac: Giac, text: string, n: number, slot: string): string | null {
  const t = giac.eval(`${slot}:=(${floatsAtDigits(giac, text, n)})`);
  if (isError(t)) return null;
  // Reading back keeps the P order of the terms; regroup sorts them as Giac does for doubles (not on a long text, G58).
  if (t.length > REGROUP_MAX) return t;
  const r = giac.eval(`regroup(${slot})`);
  if (isError(r) || r === "undef") return t;
  giac.eval(`${slot}:=regroup(${slot})`);
  return r;
}

// --- evalf(e,n), approx(e,n): the precision an input asks for (decisions M4-6) ---------------------------------------

const PRECISION_FNS = ["evalf", "approx"];
const INTEGER = /^\s*\d+\s*$/;

/** A precision text that is an integer literal (`20`, ` 15 `): the one form the readers of n take as typed. */
export function isLiteral(n: string): boolean {
  return INTEGER.test(n);
}

/** Every `evalf(e,n)` and `approx(e,n)` in `input` with its precision text n replaced by `f(n)`; one for which `f`
 *  gives null is kept, and its arguments are walked as they are. */
export function mapPrecisions(input: string, f: (n: string) => string | null): string {
  let out = "";
  let i = 0;
  for (const c of callsOf(input, PRECISION_FNS, "typed")) {
    if (c.at < i) continue;
    if (c.close < 0) return out + input.slice(i);
    const args = topLevelArgs(input.slice(c.open + 1, c.close), "typed");
    const n = args.length === 2 ? f(args[1]!) : null;
    out += input.slice(i, c.open + 1);
    out += n !== null ? `${mapPrecisions(args[0]!, f)},${n}` : mapPrecisions(input.slice(c.open + 1, c.close), f);
    out += ")";
    i = c.close + 1;
  }
  return out + input.slice(i);
}

/** Every `evalf(e,n)` and `approx(e,n)` in `input` whose n is an integer literal, with n replaced by `at(n)`. */
export function withAskedPrecision(input: string, at: (n: number) => number): string {
  return mapPrecisions(input, (n) => (isLiteral(n) ? String(at(parseInt(n, 10))) : null));
}

/** G91: `input` holds an `evalf(e,n)` or `approx(e,n)` whose n is no integer literal (a name, `2.5`; askedLiterals in
 *  asked.ts has made every other one a literal): the check cannot raise that precision, so the value is unchecked. */
export function unreadPrecision(input: string): boolean {
  let unread = false;
  mapPrecisions(input, (n) => {
    if (!isLiteral(n)) unread = true;
    return null;
  });
  return unread;
}

/** G91: the facts of a value whose input holds an unread precision (unreadPrecision): ⚠ without a count, why
 *  "unchecked" (a warning it already has is kept). */
export function unreadFacts(facts: readonly ElementFacts[]): ElementFacts[] {
  return facts.map((f) => (f.exact ? f : { ...f, reliableDigits: null, warn: f.warn ?? ("unchecked" as const) }));
}

/** Most digits an `evalf(e,n)` may ask the display for (beyond it the digits setting applies). */
export const MAX_ASKED_DIGITS = 1000;

/** n when the whole input is `evalf(e,n)` or `approx(e,n)` with an integer literal 1 ≤ n ≤ MAX_ASKED_DIGITS: the
 *  digits CAS shows the result with (decisions M4-6); null otherwise. */
export function askedDigits(input: string): number | null {
  const args = wholeCall(input, "evalf", "typed") ?? wholeCall(input, "approx", "typed");
  if (!args || args.length !== 2 || !isLiteral(args[1]!)) return null;
  const n = parseInt(args[1]!, 10);
  return n >= 1 && n <= MAX_ASKED_DIGITS ? n : null;
}

/** Why the facts of a float result carry a warning (`why` of HomeResult); undefined when nothing is to be said.
 *  `expr`: the input as it was run again, null when it could not be (a value evaluated once). */
export function whyOf(facts: readonly ElementFacts[], expr: string | null): PrecisionWhy | undefined {
  const off = expr !== null && facts.some((f) => f.warn === "unaudited") ? unauditedIn(expr, "typed") : [];
  // Every name audited but the facts unaudited: a non-real value of a function COMPLEX_DEFINITIONS replaces, not read
  // through ours (DEG, or a stored name: complexReads).
  const complex = [...new Set(facts.flatMap((f) => f.complexFns ?? []))];
  const unaudited =
    off.length || !facts.some((f) => f.warn === "unaudited") ? off : complex.length ? complex : expr === null ? [] : complexReplacedIn(expr, "typed");
  const once = facts.some((f) => f.warn === "unchecked" && !(isZero(f.value.re) && isZero(f.value.im))) || (expr === null && facts.some((f) => f.warn));
  if (!unaudited.length && !once) return undefined;
  return { ...(unaudited.length ? { unaudited } : {}), ...(once ? { once: true } : {}) };
}

/**
 * G71 (bug hunt N7): the calls Giac computes in a double whatever `Digits` is, by their name and argument count. Its
 * two-argument round and trunc evaluate x as a double (sin(10^50) is the sine of the double 1e50) and round in about 19
 * digits at most (`round(2/3,20)`, `round(10^17+1/3,2)` = 1e+17): Giac's `_round` and `_trunc` in usual.cc call
 * `_evalf` on x and then work on a C double or giac's `fPart` of a float. One-argument round stays audited (exact).
 */
const DOUBLE_FORMS: Readonly<Record<string, number>> = { round: 2, trunc: 2 };

/** The names of the DOUBLE_FORMS calls in `input` (`round(x,5)` → round; `round(x)` → none). Strings are skipped. */
export function doubleFormsIn(input: string, q: Quoting): string[] {
  const out: string[] = [];
  for (const { name, open, close } of callsOf(input, Object.keys(DOUBLE_FORMS), q)) {
    if (!out.includes(name) && close >= 0 && topLevelArgs(input.slice(open + 1, close), q).length === DOUBLE_FORMS[name]) out.push(name);
  }
  return out;
}

/** The functions of `input` that are not audited: off AUDITED_FUNCTIONS, or called in a DOUBLE_FORMS form. */
export function unauditedIn(input: string, q: Quoting): string[] {
  return [...new Set([...functionsIn(input, q).filter((f) => !AUDITED_FUNCTIONS.has(f)), ...doubleFormsIn(input, q)])];
}

/** Every function in the input is audited (unauditedIn), or in `also` (G44: the inverse functions an input's polish
 *  covers, a fact of that input only). */
export function isAudited(input: string, q: Quoting, also: readonly string[] = []): boolean {
  return unauditedIn(input, q).every((f) => also.includes(f));
}

// --- shapes: a scalar, a list, a matrix ------------------------------------------------------------------------------

export type Shape = { kind: "scalar" } | { kind: "list"; n: number } | { kind: "matrix"; rows: number; cols: number };

/** Elements above which a list or matrix is shown as Giac's text, unchecked (keeps Enter fast). */
export const MAX_ITEMS = 400;

/**
 * G103: the shape of a value from its kind (bridge-3): a sequence or a set is no number we format, nor a vector with
 * another prefix (`poly1[…]`; `list[…]` is the solve form, a list only), nor a list whose elements are lists of
 * different lengths or hold lists themselves (api.cc flattens every element, so their count is not the shape's). Every
 * other kind is a scalar. Null too for a list bridge-3 gave no elements (a print past 2 kB with over 400 of them).
 */
export function shapeOfValue(v: GiacValue): Shape | null {
  if (v.kind === "sequence" || v.kind === "set" || v.kind === "error") return null;
  if (v.kind !== "list" && v.kind !== "matrix") return { kind: "scalar" };
  const [n = 0, cols = 0] = v.shape ?? [];
  const els = v.elements;
  if (!els || n === 0 || n > MAX_ITEMS) return null;
  const listForm = v.text.startsWith("list[");
  if (!v.text.startsWith("[") && !listForm) return null;
  if (v.kind === "list") return els.length === n ? { kind: "list", n } : null;
  if (listForm || cols === 0 || n * cols > MAX_ITEMS || els.length !== n * cols) return null;
  return { kind: "matrix", rows: n, cols };
}

export function size(shape: Shape): number {
  return shape.kind === "scalar" ? 1 : shape.kind === "list" ? shape.n : shape.rows * shape.cols;
}

// --- reading values -------------------------------------------------------------------------------------------------

const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;

/** A printed rational (`-7/3`, `12`) as a DecimalValue, with its numerator and denominator lengths. */
export function rationalValue(text: string, keep?: number): { v: DecimalValue; p: bigint; q: bigint } | null {
  const m = RATIONAL.exec(text.trim());
  if (!m) return null;
  const p = BigInt(m[1] ?? "0");
  const q = BigInt(m[2] ?? "1");
  return { v: decimalFromRational(p, q, keep), p, q };
}

/**
 * G50: the digits a part printed as a double confirms when MPFR digits were asked (`asked` > DOUBLE_DIGITS + 1): one
 * fewer than it prints, since Giac rounds the double to 14 digits for print (asin(i) printed …955, the value is
 * …9543). Undefined for a rational, a zero, or a part printed with MPFR's digits. Giac's complex acos at 40 digits
 * printed its real part as 0.90455689430238 and both precisions agreed on it.
 */
export function shortDigits(text: string, asked: number): number | undefined {
  if (asked <= DOUBLE_DIGITS + 1) return undefined;
  const m = /^\s*-?(\d*)\.(\d*)(?:e[+-]?\d+)?\s*$/.exec(text);
  if (!m) return undefined;
  const sig = (m[1]! + m[2]!).replace(/^0+/, "");
  // Fewer than 14 digits: Giac drops trailing zeros, so a short print is a value that fits (round(-2.25,1) prints -2.2).
  if (sig.length < DOUBLE_DIGITS || sig.length > DOUBLE_DIGITS + 1) return undefined;
  return Math.max(0, sig.length - 1);
}

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** Runs fn with Giac's Digits set to d, then sets it back to `restore` (G102: through bridge-1 when the Giac has it). */
export function withDigits<T>(giac: Giac, d: number, restore: number, fn: () => T): T {
  const set = (n: number): void => (giac.digits ? giac.digits(n) : void giac.eval(`Digits:=${n}`));
  set(d);
  try {
    return fn();
  } finally {
    set(restore);
  }
}

type Parts = { re: DecimalValue; im: DecimalValue; short?: number };

/** A part bridge-3 gave (api.cc partText: an integer or `p/q` in base 10, a float as Giac prints it) as a DecimalValue
 *  of `keep` digits; null if it is not one. */
function partValue(text: string, keep: number): DecimalValue | null {
  const t = text.trim();
  const q = /^(-?\d+)(?:\/(\d+))?$/.exec(t);
  if (q) return decimalFromRational(BigInt(q[1]!), BigInt(q[2] ?? "1"), keep);
  // `0.-000…`: Giac's print of a negative zero part (asin(2*i) at 40 digits).
  return decimalFromString(t.replace(/^-?0\.-?0*$/, "0"), keep);
}

/**
 * G103: the parts bridge-3 gave for every element of `v` at `prec` digits (`at[prec]`: evalf of each element), as
 * decimals of `keep` digits; null when there are none of `n` elements. A part bridge-3 says is a C double where MPFR
 * digits were asked (`doubles`) is read from the element's kind: an element that is a number already (a stored double,
 * Giac's complex acos) confirms one digit fewer than it prints (shortDigits); for one that is not, "double": at[]'s
 * evalf evaluated its argument at Digits first, and Giac's own evalf(…,P) of the stored value is what decides (it errs
 * for BesselJ(1,2), which stays symbolic at 40 digits and has no MPFR path, and gives 3*x^2 with x a stored double).
 */
export function atParts(v: GiacValue, prec: number, keep: number, n: number): Parts[] | null | "double" {
  const at = v.at?.[String(prec)];
  if (!at || at.length !== n) return null;
  const dbl = v.doubles?.[String(prec)] ?? [];
  const out: Parts[] = [];
  for (let k = 0; k < n; k++) {
    const [reT, imT] = at[k]!;
    const a = partValue(reT, keep);
    const b = partValue(imT, keep);
    if (!a || !b) return null;
    const d = dbl[k] ?? 0;
    const kind = v.kinds?.[k] ?? v.kind;
    if (d && prec > DOUBLE_DIGITS + 1 && kind !== "float" && kind !== "complex") return "double";
    const short = [d & 1 ? shortDigits(reT, prec) : undefined, d & 2 ? shortDigits(imT, prec) : undefined].filter((x): x is number => x !== undefined);
    out.push(short.length ? { re: a, im: b, short: Math.min(...short) } : { re: a, im: b });
  }
  return out;
}

/** atParts where a value that is no number yet has none (the float paths, which read numbers Giac computed). */
export function numbersAt(v: GiacValue, prec: number, keep: number, n: number): Parts[] | null {
  const at = atParts(v, prec, keep, n);
  return at === "double" ? null : at;
}

/** G103: the value of `text` evaluated once (bridge-3) with its parts at `prec`, when it is a number of `shape`; the
 *  value too (its print, its kind). */
function valueAt(giac: Giac, text: string, shape: Shape, prec: number, keep: number): { v: GiacValue; parts: Parts[] | null } {
  const v = giac.value(text, [prec]);
  const s = shapeOfValue(v);
  const same = s !== null && size(s) === size(shape) && s.kind === shape.kind;
  return { v, parts: same ? numbersAt(v, prec, keep, size(shape)) : null };
}

/** G103: an exact rational from bridge-3's [num, den] (a sign in the denominator, Giac's 1/-2, is moved up). */
function rationalOf(nd: readonly [string, string] | null | undefined, keep: number): { v: DecimalValue; p: bigint; q: bigint } | null {
  if (!nd) return null;
  const sign = BigInt(nd[1]) < 0n ? -1n : 1n;
  const p = sign * BigInt(nd[0]);
  const q = sign * BigInt(nd[1]);
  return q === 0n ? null : { v: decimalFromRational(p, q, keep), p, q };
}

/** G103: Giac's symbolic re() and im() of every element of `expr` (bridge-3, one call) as exact rationals where they
 *  are (null where not); null when Giac gave no such parts (an error, a time-out). */
function splitParts(giac: Giac, expr: string, n: number, keep: number): { re: ReturnType<typeof rationalOf>[]; im: ReturnType<typeof rationalOf>[] } | null {
  const v = giac.value(`(pasz->[re(pasz),im(pasz)])(${expr})`, []);
  const ex = v.exact;
  if (v.kind === "error" || !ex || ex.length !== 2 * n) return null;
  return { re: ex.slice(0, n).map((x) => rationalOf(x, keep)), im: ex.slice(n).map((x) => rationalOf(x, keep)) };
}

/** One element's facts (ValueFacts with its value; `why` is the whole result's, never an element's). */
export interface ElementFacts extends ValueFacts {
  value: ComplexValue;
  /** The exact numerator or denominator has more than maxExactDigits digits. */
  big: boolean;
  /** G50f1: the functions Giac gets wrong on complex arguments that made this value unaudited (why.unaudited). */
  complexFns?: readonly string[];
  /** G59: the working digits the value of an exact non-rational element was read at (its last agreement level). */
  at?: number;
}

/** G60: a part this many decades below the other one at aPrecision digits is within the rounding of the value. */
const NOISE_MARGIN = 10;
/** G60: decades a noise part falls by when the precision rises by 20 digits (the rounding falls by 20). */
const NOISE_DROP = 10;

/**
 * G60 (r16 F6): part `k` of a non-real value is rounding noise: at aPrecision digits it is NOISE_MARGIN decades or
 * fewer above the rounding of the other part, and in `b` (more digits) it fell by NOISE_DROP decades or more, or is 0.
 * sqrt(asinh(cos(10))) is 7.4E-41+0.873…*i at 40 digits and 1E-61+0.873…*i at 60; mpmath's real part is 0. A true
 * small part keeps its size when the precision rises (tanh(1E-40+i) = 3.4E-40+1.557…*i).
 */
function noisePart(a: ComplexValue, b: ComplexValue, k: "re" | "im", aPrecision: number): boolean {
  const o = k === "re" ? "im" : "re";
  if (isZero(a[k]) || isZero(a[o]) || isZero(b[o])) return false;
  return a[k].exp <= a[o].exp - (aPrecision - NOISE_MARGIN) && (isZero(b[k]) || b[k].exp <= a[k].exp - NOISE_DROP);
}

const ZERO: DecimalValue = { neg: false, digits: "", exp: 0, sticky: false };

/** `b` with its noise parts (noisePart against `a`) set to 0: a part below the rounding is not shown (G60). */
function denoised<T extends ComplexValue>(a: ComplexValue, b: T, aPrecision: number): T {
  const re = noisePart(a, b, "re", aPrecision);
  const im = noisePart(a, b, "im", aPrecision);
  return re || im ? { ...b, ...(re ? { re: ZERO } : {}), ...(im ? { im: ZERO } : {}) } : b;
}

/** Confirmed digits of a complex value: the weaker of its two parts (an exactly zero part and a noise part need no
 *  check). */
function confirmedComplex(a: ComplexValue, b: ComplexValue, aPrecision: number, cap: number): number {
  let n = cap;
  for (const k of ["re", "im"] as const) {
    if ((isZero(a[k]) && isZero(b[k])) || noisePart(a, b, k, aPrecision)) continue;
    n = Math.min(n, confirmedDigits(a[k], b[k], aPrecision, cap));
  }
  return n;
}

/**
 * A value that is 0 in every evaluation but not known to be exactly 0 (not an exact rational) has no confirmed digit:
 * `exp(10^-70)-1` is 0 at any working precision. It gets ⚠ without a count, never ≈ 0 (owner, 2026-10-13, G3).
 */
function zeroUnconfirmed(f: ElementFacts): ElementFacts {
  return !f.exact && !f.warn && isZero(f.value.re) && isZero(f.value.im) ? { ...f, warn: "unchecked" } : f;
}

/** Digits of an integer literal from which a root beside it makes Giac's symbolic re and im unsafe (G58: acos(120^7.5)
 *  holds sqrt(30) times a 15-digit integer, and its im() did not return in 20 s; with a 4-digit one it takes 66 ms). */
export const HEAVY_INT_DIGITS = 13;
const ROOT_POWER = /\^\(\d+\/\d+\)/;
const HEAVY_INT = new RegExp(`(?<![\\w.])\\d{${HEAVY_INT_DIGITS},}(?![\\w.])`);

/** G58: `text` (an exact result) holds a root and an integer of HEAVY_INT_DIGITS or more digits. */
export function heavySplit(text: string): boolean {
  return (callsOf(text, ["sqrt"], "printed").length > 0 || ROOT_POWER.test(text)) && HEAVY_INT.test(text);
}

/** Most working digits an agreement step uses, and the time the steps beyond P+40 may take per result (G23). */
export const MAX_EVAL_DIGITS = 1000;
const EXTRA_BUDGET_MS = 50;

/** Digits a value's confirmed digits must end before, to look like a rational (endsEarly). */
const ENDS_MARGIN = 10;

/**
 * G103: `x` rounded to its `reliable` confirmed digits ends ENDS_MARGIN digits early (90.000…, 0.125, or 0): it may be
 * a rational Giac can prove. bridge-3's evalf at P+20 can print such a value one unit off in its last place
 * (89.999…9e0 for pi/2/(pi/180), where `evalf(…,60)` printed 90.000…), so its digits are not cut off at P+20 alone.
 */
export function endsEarly(x: DecimalValue, reliable: number): boolean {
  if (isZero(x)) return true;
  if (reliable < 1) return false;
  const d = roundSignificant(x, reliable).digits;
  let k = d.length;
  while (k > 0 && d.charAt(k - 1) === "0") k--;
  return k <= reliable - ENDS_MARGIN;
}

/** An exact element from its numerator and denominator (`big`: either has more than `maxExactDigits` digits). */
function exactElement(re: { v: DecimalValue; p: bigint; q: bigint }, im: { v: DecimalValue; p: bigint; q: bigint }, maxExactDigits: number): ElementFacts {
  const big = [re.p, re.q, im.p, im.q].some((x) => (x < 0n ? -x : x).toString().length > maxExactDigits);
  return { value: { re: re.v, im: im.v }, exact: true, reliableDigits: null, big };
}

/**
 * Facts for every element of the stored exact result `name` (G103, F73: from bridge-3; `v` is the exact run's value,
 * its print `text`): an integer or rational is exact from its num/den, whatever Giac prints (`0xFF` under
 * integer_format(16)); an integer past 2048 digits (`Integer_too_large_for_display`) from its digits at P+20; a list's
 * element that is an integer or rational (by its kind, `exact`) is exact. The others are read in one more call,
 * `value(name, [P, P+20])`, each element's evalf (a boolean has no value, so the list is no number): the symbolic
 * agreement check, P against P+20, then P+20 against P+40. Giac's symbolic re() and im() are asked only for a value
 * that is not real, or whose digits end (it may be a rational re() finds): a part they give as a rational keeps it.
 * G44f1: erf and erfc are read through our MPFR definitions, which run at Digits: the value is evaluated from its text
 * at each precision with Digits set to it. Null when some element is not a number.
 */
export function exactFacts(
  giac: Giac,
  name: string,
  shape: Shape,
  digits: number,
  maxExactDigits: number,
  text: string,
  v: GiacValue,
): ElementFacts[] | null {
  const P = valuePrecision(digits);
  const n = size(shape);
  const zero = { v: decimalFromRational(0n, 1n, P), p: 0n, q: 1n };
  let known: (ElementFacts | null)[];
  if (shape.kind === "scalar") {
    const whole = v.kind === "integer" || v.kind === "rational" ? rationalOf(v.num !== undefined && v.den !== undefined ? [v.num, v.den] : null, P) : null;
    if (whole) return [exactElement(whole, zero, maxExactDigits)];
    known = [null];
  } else {
    if (!v.exact || v.exact.length !== n) return null;
    known = v.exact.map((nd) => {
      const r = rationalOf(nd, P);
      return r ? exactElement(r, zero, maxExactDigits) : null;
    });
    if (known.every((f) => f !== null)) return known as ElementFacts[];
  }
  // G50: a value holding a function Giac gets wrong on complex arguments is read through our definitions (forValue);
  // `name` (Ans) keeps Giac's own text. G44f1: an erf through ours, at Digits (erfValueText); a non-real argument is
  // Giac's own erf, with the flag set. The others: the exact run asked for its digits already (an input of audited
  // functions), or one call does.
  const safe = complexSafe(text, "printed") === text ? text : forValue(giac, text, "printed");
  const erf = functionsIn(text, "printed").some((f) => f === "erf" || f === "erfc") ? erfValueText(giac, safe) : safe;
  const src = erf !== safe ? `(${erf})` : safe === text ? name : `(${safe})`;
  const at = (text: string, prec: number): GiacValue =>
    erf !== safe ? withDigits(giac, prec, digits, () => giac.value(text, [prec])) : giac.value(text, [prec]);
  const read = (prec: number): GiacValue => at(src, prec);
  // a double where MPFR digits were asked, in an element that is no number yet (atParts): Giac's evalf of the value
  const whole = (prec: number): GiacValue => at(`evalf(${src},${prec})`, prec);
  if (erf !== safe) giac.eval(`${ICDF_FAILED}:=0`);
  const P2 = [P, P + 20];
  const first = erf !== safe ? null : src === name && P2.every((d) => v.at?.[String(d)] !== undefined) ? v : giac.value(src, P2);
  try {
    const out = factsFrom(giac, name, v, first, read, whole, known, shape, digits, maxExactDigits, text);
    if (erf === safe || !out) return out;
    return giac.eval(ICDF_FAILED).trim() !== "0" ? out.map((f) => (f.exact ? f : { ...f, warn: "unaudited" as const })) : out;
  } finally {
    if (erf !== safe) giac.eval(`purge(${ICDF_FAILED})`);
  }
}

/** exactFacts past the exact elements: `read` gives the value at a precision, `w` at P and P+20 when one call gave both
 *  (null: read each), `known` the facts so far. */
function factsFrom(
  giac: Giac,
  name: string,
  v: GiacValue,
  w: GiacValue | null,
  read: (prec: number) => GiacValue,
  whole: (prec: number) => GiacValue,
  known: (ElementFacts | null)[],
  shape: Shape,
  digits: number,
  maxExactDigits: number,
  text: string,
): ElementFacts[] | null {
  const P = valuePrecision(digits);
  const n = size(shape);
  const level = (prec: number): Parts[] | null => {
    const at = atParts(w && prec <= P + 20 ? w : read(prec), prec, P + 2, n);
    const again = at === "double" ? atParts(whole(prec), prec, P + 2, n) : at;
    return again === "double" ? null : again;
  };
  if (shape.kind === "scalar" && v.kind === "integer") {
    // No num/den: more than 2048 digits. The digits at P+20, cut to P as a rational's are.
    const big = level(P + 20);
    return big ? [{ value: { re: big[0]!.re, im: big[0]!.im }, exact: true, reliableDigits: null, big: true }] : null;
  }
  const A = level(P);
  const B = A && level(P + 20);
  if (!A || !B) return null;
  const real = known.every(
    (f, k) => f !== null || (isZero(A[k]!.im) && isZero(B[k]!.im) && B[k]!.re.sticky && !endsEarly(B[k]!.re, confirmedComplex(A[k]!, B[k]!, P, P))),
  );
  let parts: ReturnType<typeof splitParts> = null;
  // G58: not for a text whose symbolic re and im can loop (heavySplit); its parts are the evalf's. F73: nor for a
  // float, which is never exact (re() prints 595872309788.0 as 595872309788). G60: nor for a value that is 0 at P and
  // P+20 in every element: an exact 0 is provedRational's (simplify) to find, an underflow G84's (DEG
  // exp(cosh(asin(pi))) spent 112 ms in re() and im() once asin(pi) had a value).
  const zero = A.every((a, k) => isZero(a.re) && isZero(a.im) && isZero(B[k]!.re) && isZero(B[k]!.im));
  if (!real && !zero && !heavySplit(text) && v.kind !== "float") {
    parts = splitParts(giac, name, n, P);
    if (parts) {
      const split = parts;
      known = known.map((f, k) => {
        if (f) return f;
        const a = split.re[k];
        const b = split.im[k];
        return a && b && (shape.kind === "scalar" || v.kinds?.[k] !== "float") ? exactElement(a, b, maxExactDigits) : null;
      });
      if (known.every((f) => f !== null)) return known as ElementFacts[];
    }
  }
  const exactPart = (k: number, part: "re" | "im"): DecimalValue | undefined => {
    const r = parts?.[part][k];
    return r ? decimalFromRational(r.p, r.q, P + 2) : undefined;
  };
  const kept = (L: Parts[]): Parts[] => L.map((x, k) => ({ ...x, re: exactPart(k, "re") ?? x.re, im: exactPart(k, "im") ?? x.im }));
  const levels = new Map([
    [P, kept(A)],
    [P + 20, kept(B)],
  ]);
  return agreedFacts(known, digits, P, (prec) => {
    const at = levels.get(prec) ?? level(prec);
    return at && kept(at);
  });
}

/** The facts of the elements not known yet (`facts` null there) from the agreement of their values at P, P+20 and the
 *  further levels (`evalfAt`), see exactFacts. */
function agreedFacts(facts: readonly (ElementFacts | null)[], digits: number, P: number, evalfAt: (prec: number) => Parts[] | null): ElementFacts[] | null {
  const A = evalfAt(P);
  const B = A && evalfAt(P + 20);
  if (!A || !B) return null;
  // Further steps: P+20 against P+40, then the extra precision doubles (P+80, P+160, …, at most MAX_EVAL_DIGITS) while
  // fewer than `digits` agree and the budget lasts; the first agreement stops it (G23). Each level is read once and
  // shared by all elements.
  const levels: ({ re: DecimalValue; im: DecimalValue }[] | null)[] = [A, B];
  const precs = [P, P + 20];
  const t0 = Date.now();
  const more = (i: number): boolean => {
    if (i < levels.length) return levels[i] !== null;
    if (levels[i - 1] === null) return false;
    const prec = P + 40 * 2 ** (i - 2);
    if (prec > MAX_EVAL_DIGITS || (i > 2 && Date.now() - t0 > EXTRA_BUDGET_MS)) return false;
    levels[i] = evalfAt(prec);
    precs[i] = prec;
    return true;
  };
  return facts.map((f, k) => {
    if (f) return f;
    let reliable = confirmedComplex(A[k]!, B[k]!, P, P);
    let value = denoised(A[k]!, B[k]!, P);
    let at = P + 20;
    for (let i = 2; reliable < digits && more(i); i++) {
      const next = levels[i];
      if (!next) break;
      reliable = Math.max(reliable, confirmedComplex(levels[i - 1]![k]!, next[k]!, precs[i - 1]!, P));
      value = denoised(levels[i - 1]![k]!, next[k]!, precs[i - 1]!);
      at = precs[i]!;
    }
    reliable = Math.min(reliable, A[k]!.short ?? P, B[k]!.short ?? P);
    return zeroUnconfirmed({ value: { re: value.re, im: value.im }, exact: false, reliableDigits: reliable, big: false, at });
  });
}

/**
 * G59 (r16 F3): whether Giac's numeric evaluation of the input disagrees with the exact path's value `facts` beyond the
 * digits either confirms. `floatText(at)`: the input with its decimals as floats of `at` digits, evaluated by evalf at
 * the digits the exact value was read at. Two runs of the exact path agree on whatever it computes, and it can rewrite
 * an input into another branch ((sin(3.7)-e)^(0.001*asin(6.02e8)) became (…^(1000*…))^(1/1000)); the numeric route
 * through Giac is a second one. One Giac call; false when that route gives no number of the shape (nothing compared).
 */
export function numericDisagrees(giac: Giac, floatText: (at: number) => string, facts: readonly ElementFacts[], shape: Shape, digits: number): boolean {
  const checked = (f: ElementFacts): boolean => !f.exact && f.reliableDigits !== null && !f.warn && f.at !== undefined;
  if (!facts.some(checked)) return false;
  const at = Math.max(...facts.map((f) => f.at ?? 0));
  const F = withDigits(giac, at, digits, () => valueAt(giac, `evalf(${forValue(giac, floatText(at), "typed")},${at})`, shape, at, at + 2).parts);
  if (!F || F.length !== facts.length) return false;
  return facts.some((f, k) => {
    if (!checked(f)) return false;
    const b = F[k]!;
    // One digit of slack: the two routes round differently in their last place.
    const want = Math.min(f.reliableDigits!, digits, b.short ?? at) - 1;
    const top = Math.max(...[f.value.re, f.value.im].filter((x) => !isZero(x)).map((x) => x.exp));
    return (["re", "im"] as const).some((part) => {
      const x = f.value[part];
      const y = b[part];
      if (isZero(x) && isZero(y)) return false;
      // A part one route gives as 0 and the other as noise far below the value is no disagreement.
      if (isZero(x) || isZero(y)) return (isZero(x) ? y : x).exp > top - want;
      return confirmedDigits(x, y, f.at!, at) < want;
    });
  });
}

/**
 * Re-evaluates `expr` (the user's input, decimals exact, or null when it cannot be run twice) for a result that
 * Giac's numeric code returned as a float on the exact path (docs/04 section 2.4 rule 3). The value chosen is stored
 * in `name` (Ans). `digits` is the Home setting and the Digits Giac is left at.
 */
export function floatFacts(
  giac: Giac,
  name: string,
  expr: string | null,
  shape: Shape,
  digits: number,
  restoreDigits: number,
  typed?: string,
): ElementFacts[] | null {
  // SB4: an element that is an exact rational in the stored result keeps its own facts (= or ≈), not the mark of the
  // weakest element. Read before the checks below, which store their values in `name`.
  const exact = shape.kind === "scalar" ? null : exactElements(giac, name, shape, valuePrecision(digits));
  // G50f1: the names the input reads that hold a call Giac gets wrong on complex arguments are read through copies.
  const reads = expr === null ? null : complexReads(giac, expr);
  let facts: ElementFacts[] | null;
  try {
    facts = floatFactsOf(giac, name, expr, reads, shape, digits, restoreDigits);
  } finally {
    if (reads) purgeReads(giac, reads.copies);
  }
  if (facts && expr !== null && unreadPrecision(expr)) facts = unreadFacts(facts);
  // G50f1: an input that runs once (`typed`, expr null) keeps Giac's value, computed without our definitions: a
  // non-real one that rests on a replaced function (typed, or held by a name it reads) is not audited.
  if (facts && expr === null && typed !== undefined) {
    const complexFns = [...new Set([...complexReplacedIn(typed, "typed"), ...complexReads(giac, typed, false).hidden])];
    if (complexFns.length && nonReal(giac, name)) facts = facts.map((f) => ({ ...f, warn: "unaudited" as const, complexFns }));
  }
  return facts && exact && exact.length === facts.length ? facts.map((f, k) => exact[k] ?? f) : facts;
}

/** At most a double's digits of `v` (rounded; a shorter value is kept). */
function doubleDigits(v: DecimalValue): DecimalValue {
  if (v.digits.length <= DOUBLE_DIGITS) return v;
  const r = roundSignificant(v, DOUBLE_DIGITS);
  return { neg: r.neg, digits: r.digits.replace(/0+$/, ""), exp: r.exp, sticky: true };
}

/**
 * G90 (F65, F67): the facts of a value from Giac's numeric integration (converge.ts integratedNumerically), which is a
 * double at any Digits, so its reads at 14 digits, P and P+20 agree by construction and confirm nothing: ⚠ without a
 * count ("not audited: int"), at most a double's digits. An element that is an exact rational keeps its own facts.
 */
export function integratedFacts(facts: readonly ElementFacts[]): ElementFacts[] {
  return facts.map((f) =>
    f.exact ? f : { ...f, value: { re: doubleDigits(f.value.re), im: doubleDigits(f.value.im) }, reliableDigits: null, warn: "unaudited" as const },
  );
}

/** The facts of each element of the stored list or matrix `name` that is an exact rational; null for the others. */
function exactElements(giac: Giac, name: string, shape: Shape, P: number): (ElementFacts | null)[] | null {
  // G103: Giac's re() and im() through bridge-3, rationals by their kind (F73: a float printed without a point is none)
  const split = splitParts(giac, name, size(shape), P);
  return split && split.re.map((a, k) => {
    const b = split.im[k];
    return a && b ? { value: { re: a.v, im: b.v }, exact: true, reliableDigits: null, big: false } : null;
  });
}

function floatFactsOf(
  giac: Giac,
  name: string,
  expr: string | null,
  reads: { text: string; hidden: string[] } | null,
  shape: Shape,
  digits: number,
  restoreDigits: number,
): ElementFacts[] | null {
  const P = valuePrecision(digits);
  // G50: run with the functions Giac gets wrong on complex arguments replaced (forValue), and the names that hold them
  // read through their copies (G50f1, complexReads).
  const run = reads === null ? null : forValue(giac, reads.text, "typed");
  // `asked`: the precision an evalf(e,n) in the input runs at in this evaluation (M4-6).
  // `text`: what is run (`run`, or G44's polished text).
  const at = (
    d: number,
    slot: string,
    asked: (n: number) => number = (n) => Math.max(n, d),
    text: string | null = run,
  ): { re: DecimalValue; im: DecimalValue; short?: number }[] | null =>
    withDigits(giac, d, restoreDigits, () => valueAt(giac, text === null ? name : `${slot}:=(${withAskedPrecision(text, asked)})`, shape, d, P).parts);
  // A non-real value that rests on a replaced function not read through our definitions (DEG, complexReads' hidden).
  const hidden = reads !== null && reads.hidden.length > 0 && nonReal(giac, name) ? reads.hidden : [];
  const unaudited = expr === null || !isAudited(expr, "typed") || hidden.length > 0;
  const facts = (v: { re: DecimalValue; im: DecimalValue; short?: number }[], reliable: (k: number) => number, warn?: PrecisionWarn): ElementFacts[] =>
    v.map((value, k) =>
      zeroUnconfirmed({
        value: { re: value.re, im: value.im },
        exact: false,
        reliableDigits: Math.min(reliable(k), P, value.short ?? P),
        big: false,
        ...(warn ? { warn } : {}),
        ...(warn === "unaudited" && hidden.length ? { complexFns: hidden } : {}),
      }),
    );
  if (expr === null) {
    // A stateful input that cannot be run again: the value as printed, one-sided.
    const d = digits <= DOUBLE_DIGITS ? DOUBLE_DIGITS : digits;
    const v = at(d, name);
    return v && facts(v, () => Math.min(digits, d), "unchecked");
  }
  // Rule 2: P against P+20, and P+20 against P+40 when fewer than the digits agree (a cancellation only needs more
  // working digits). Null when P or P+20 could not be evaluated, with the facts of P alone in `once`.
  const agreed = (text: string | null): { facts: ElementFacts[] } | { once: ElementFacts[] } | null => {
    const A = at(P, "pasm", (n) => Math.max(n, P), text);
    const B = A && at(P + 20, "pasm2", (n) => Math.max(n, P) + 20, text);
    if (A && B) {
      const reliable = B.map((b, k) => Math.min(confirmedComplex(A[k]!, b, P, P), A[k]!.short ?? P));
      if (reliable.some((n) => n < digits)) {
        const C = at(P + 40, "pasm3", (n) => Math.max(n, P) + 40, text);
        if (C) {
          giac.eval(`${name}:=pasm3`);
          return { facts: facts(C, (k) => Math.max(reliable[k]!, confirmedComplex(B[k]!, C[k]!, P + 20, P))) };
        }
      }
      giac.eval(`${name}:=pasm2`);
      return { facts: facts(B, (k) => reliable[k]!) };
    }
    if (A) {
      giac.eval(`${name}:=pasm`);
      return { once: facts(A, () => Math.min(digits, DOUBLE_DIGITS), "unchecked") };
    }
    return null;
  };
  // G44 (docs/04 2.3 #2): an inverse distribution function is polished by substituting back (icdf.ts) and counts as
  // audited for this input when every call of it converged at P and at P + 20; else today's unaudited check.
  if (unaudited && run !== null && !hidden.length && icdfCalls(run).length && isAudited(expr, "typed", icdfCalls(run))) {
    const polished = icdfPolished(giac, run);
    giac.eval(`${ICDF_FAILED}:=0`);
    giac.eval(`${ICDF_DIGITS}:=${digits}`);
    const r = agreed(polished);
    const failed = giac.eval(ICDF_FAILED).trim() !== "0";
    giac.eval(`purge(${ICDF_FAILED},${ICDF_DIGITS})`);
    if (r && "facts" in r && !failed) return r.facts;
  }
  if (unaudited) {
    const D = at(DOUBLE_DIGITS, "pasd", () => DOUBLE_DIGITS);
    const M = at(P, "pasm");
    const fnWarn: PrecisionWarn = "unaudited";
    if (D && M) {
      giac.eval(`${name}:=pasm`);
      return facts(M, (k) => confirmedComplex(D[k]!, M[k]!, DOUBLE_DIGITS, P), fnWarn);
    }
    if (D) {
      giac.eval(`${name}:=pasd`);
      return facts(D, () => Math.min(digits, DOUBLE_DIGITS), fnWarn);
    }
    if (M) {
      giac.eval(`${name}:=pasm`);
      return facts(M, () => Math.min(digits, DOUBLE_DIGITS), fnWarn);
    }
    return null;
  }
  const r = agreed(run);
  return r === null ? null : "facts" in r ? r.facts : r.once;
}

/**
 * The double fallback for an exact result that has no MPFR value (docs/04 section 2.3 #5: `BesselJ(1,2)` at 30
 * digits comes back as text): `evalf` of the stored result with a double. Null when that is not a number either
 * (a symbolic result such as `x+1`). On success the double becomes Ans.
 */
export function doubleFallback(giac: Giac, name: string, input: string, digits: number, restoreDigits: number): ElementFacts | null {
  const out = withDigits(giac, DOUBLE_DIGITS, restoreDigits, () => {
    const r = valueAt(giac, `pasd:=evalf(${name})`, { kind: "scalar" }, DOUBLE_DIGITS, DOUBLE_DIGITS);
    return r.v.kind === "float" || r.v.kind === "complex" ? r.parts : null;
  });
  if (!out) return null;
  giac.eval(`${name}:=pasd`);
  return {
    value: out[0]!,
    exact: false,
    reliableDigits: Math.min(digits, DOUBLE_DIGITS),
    warn: isAudited(input, "typed") ? "unchecked" : "unaudited",
    big: false,
  };
}

/**
 * Float fallback (docs/04 section 2.4 rule 2 for the float paths): `expr` in floating point at W and at W+20.
 * The W+20 value becomes Ans. With `expr` null (a stateful input that cannot run twice) only W is used, unchecked.
 */
export function floatPathFacts(
  giac: Giac,
  name: string,
  expr: string,
  once: boolean,
  W: number,
  digits: number,
): { facts: ElementFacts[]; shape: Shape } | { error: string } {
  // G50f1: the names the input reads that hold a call Giac gets wrong on complex arguments are read through copies.
  const reads = complexReads(giac, expr, !once);
  try {
    // G44f1: erf and erfc through our MPFR definitions (Giac's erf of a float below about 1E-11 is the argument).
    const safe = forValue(giac, reads.text, "typed");
    const value = erfValueText(giac, safe);
    if (value !== safe) giac.eval(`${ICDF_FAILED}:=0`);
    let out = floatPathFactsOf(giac, name, value, once, W, digits);
    if (!("error" in out) && unreadPrecision(safe)) out = { ...out, facts: unreadFacts(out.facts) };
    if (value !== safe) {
      // A non-real argument is Giac's own erf (the flag): not audited.
      const failed = giac.eval(ICDF_FAILED).trim() !== "0";
      giac.eval(`purge(${ICDF_FAILED})`);
      if (failed && !("error" in out)) out = { ...out, facts: out.facts.map((f) => ({ ...f, warn: "unaudited" as const })) };
    }
    // A non-real value that rests on a replaced function not read through ours (DEG, a copy refused) is not audited.
    if ("error" in out || !reads.hidden.length || !nonReal(giac, name)) return out;
    const complexFns = reads.hidden;
    return { ...out, facts: out.facts.map((f) => ({ ...f, warn: "unaudited" as const, complexFns })) };
  } finally {
    purgeReads(giac, reads.copies);
  }
}

function floatPathFactsOf(
  giac: Giac,
  name: string,
  safe: string,
  once: boolean,
  W: number,
  digits: number,
): { facts: ElementFacts[]; shape: Shape } | { error: string } {
  // G103: each run stores and reads its value in one call (bridge-3), the parts at its own precision
  const run = (d: number, slot: string): GiacValue =>
    withDigits(giac, d, digits, () => giac.value(`${slot}:=(${withAskedPrecision(safe, (n) => Math.max(n, W) + (d - W))})`, [d]));
  const vA = run(W, once ? name : "pasf");
  const outA = vA.text;
  if (vA.kind === "error") return { error: outA };
  const shape = shapeOfValue(vA);
  if (!shape) return { error: outA };
  const A = numbersAt(vA, W, valuePrecision(digits), size(shape));
  if (!A) return { error: outA };
  if (once) return { facts: A.map((value) => ({ value: { re: value.re, im: value.im }, exact: false, reliableDigits: Math.min(digits, W - 10, value.short ?? W), warn: "unchecked", big: false })), shape };
  const vB = run(W + 20, name);
  const sB = shapeOfValue(vB);
  const B = sB && sB.kind === shape.kind && size(sB) === size(shape) ? numbersAt(vB, W + 20, valuePrecision(digits), size(shape)) : null;
  if (!B) {
    giac.eval(`${name}:=pasf`);
    return { facts: A.map((value) => ({ value: { re: value.re, im: value.im }, exact: false, reliableDigits: Math.min(digits, W - 10, value.short ?? W), warn: "unchecked", big: false })), shape };
  }
  return {
    facts: B.map((b, k) => {
      const value = denoised(A[k]!, b, W);
      return zeroUnconfirmed({
        value: { re: value.re, im: value.im },
        exact: false,
        reliableDigits: Math.min(confirmedComplex(A[k]!, b, W, W), valuePrecision(digits), A[k]!.short ?? W, b.short ?? W),
        big: false,
      });
    }),
    shape,
  };
}


/**
 * Decisions M4-7: the digits of each element of a result that survive the uncertainty of the stored variables it was
 * computed from. `expr` (decimals exact) is evaluated again at P with every variable in `moved` set to X·(1+10^-n), n
 * its confirmed digits, and compared with `values` (the result as computed). The variables are set back afterwards (a
 * Cancel in between restarts the engine, which replays them from the definitions log). Null when the second
 * evaluation gives no number of the same shape.
 */
export function perturbedDigits(
  giac: Giac,
  expr: string,
  shape: Shape,
  values: readonly ComplexValue[],
  moved: readonly { name: string; n: number }[],
  digits: number,
  restoreDigits: number,
): number[] | null {
  const P = valuePrecision(digits);
  return withDigits(giac, P, restoreDigits, () => {
    moved.forEach((m, k) => giac.eval(`pasq${k}:=${m.name}`));
    try {
      for (const m of moved) giac.eval(`${m.name}:=${m.name}*(1+10^(-${Math.max(0, Math.trunc(m.n))}))`);
      const v = valueAt(giac, `paspt:=(${expr})`, shape, P, P).parts;
      if (!v || v.length !== values.length) return null;
      return v.map((pv, k) => confirmedComplex(pv, values[k]!, P, P));
    } finally {
      moved.forEach((m, k) => {
        giac.eval(`${m.name}:=pasq${k}`);
        giac.eval(`purge(pasq${k})`);
      });
    }
  });
}

/** Our formatted number text (`-1.5E-7`, `1-2*i`, `[a,b]`, `[[a,b],[c,d]]`) as LaTeX for the CAS view. */
export function numberLatex(text: string): string {
  const num = (x: string): string =>
    x
      .replace(/(\d(?:\.\d+)?)E([+-]?\d+)/g, "$1\\times10^{$2}")
      .replace(/\*i\b/g, "\\mathrm{i}")
      .replace(/(^|[+-])i\b/g, "$1\\mathrm{i}");
  const els = splitList(text);
  if (!els) return num(text);
  const rows = els.map(splitList);
  if (els.length > 0 && rows.every((r) => r !== null)) {
    return `\\begin{bmatrix}${rows.map((r) => r!.map(numberLatex).join("&")).join("\\\\")}\\end{bmatrix}`;
  }
  return `\\left[${els.map(numberLatex).join(",")}\\right]`;
}

// --- G53: the prints of names (the G38 decision code is in decisions.ts) ---------------------------------------------

/** Giac's language keywords that functionsIn finds in a printed program (`if (`, `while (`): like a built-in, none
 *  can hold a value, so each prints the same all session. Every entry is checked to refuse both `k:=3` and `k(x):=x`
 *  in precision.test.ts ("G53: every KEYWORDS entry refuses a value"). `return` is left out: Giac reads
 *  `return(x):=x` as `return(x:=x)` without an error, so it is asked like a user's name. */
export const KEYWORDS: ReadonlySet<string> = new Set([
  "if", "while", "throw", "and", "or", "xor", "local", "else", "elif", "then", "try", "catch", "break", "continue",
  "repeat", "until", "switch", "case", "default", "do", "from", "to", "step", "in",
]);

/** G53: the prints of names that never change, per Giac instance (a fresh engine starts empty). */
const FIXED_PRINTS = new WeakMap<Giac, Map<string, string>>();

/** Giac's print of `name`, trimmed (`'sin'`, a stored function's definition, the name itself when free). A built-in
 *  (printed quoted) is reserved, Giac refuses to store into it, and a keyword cannot be stored into either: their
 *  prints are asked once per Giac instance (G53: notBuiltin and callsStateful asked them on every Enter). */
export function namePrint(giac: Giac, name: string): string {
  let fixed = FIXED_PRINTS.get(giac);
  if (!fixed) FIXED_PRINTS.set(giac, (fixed = new Map()));
  const known = fixed.get(name);
  if (known !== undefined) return known;
  const out = giac.eval(name).trim();
  if (out === `'${name}'` || KEYWORDS.has(name)) fixed.set(name, out);
  return out;
}

/** A predicate for "`name` is not a Giac built-in" (a stored function, or a name Giac does not know): Giac prints a
 *  built-in quoted (`sin` → `'sin'`) and a stored function as its definition (`f` → `(x)->floor(x*10^12)`). */
export function notBuiltin(giac: Giac): (name: string) => boolean {
  return (name) => namePrint(giac, name) !== `'${name}'`;
}
