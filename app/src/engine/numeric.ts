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
import {
  confirmedDigits,
  decimalFromRational,
  decimalFromString,
  isZero,
  type ComplexValue,
  type DecimalValue,
  type PrecisionWarn,
  type PrecisionWhy,
} from "./format.ts";

export interface Giac {
  eval(input: string): string;
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
 */
export const AUDITED_FUNCTIONS: ReadonlySet<string> = new Set([
  "evalf", "approx",
  "sqrt", "exp", "pasexp", "ln", "log", "log10", "sin", "cos", "tan", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "abs", "re", "im", "conj", "arg", "sign", "floor", "ceil", "round", "frac", "max", "min",
  "sigfig", "par", "eseries",
]);

const FLOAT_LITERAL = /(?<![A-Za-z_0-9.])(?:\d+\.\d*|\.\d+|\d+(?=e[+-]?\d))(?:e[+-]?\d+)?/;

/** Giac printed a float somewhere in this text (its exact results never contain one). */
export function hasFloat(text: string): boolean {
  return FLOAT_LITERAL.test(text);
}

// --- evalf(e,n), approx(e,n): the precision an input asks for (decisions M4-6) ---------------------------------------

/** Index of the bracket that closes the one at `open` (`(`, `[` or `{`), skipping strings; -1 when there is none. */
function closing(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === '"') {
      const end = s.indexOf('"', k + 1);
      if (end < 0) return -1;
      k = end;
    } else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/** The top-level comma-separated parts of an argument list. */
function topLevelArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === '"') {
      const end = s.indexOf('"', k + 1);
      k = end < 0 ? s.length : end;
    } else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(s.slice(start, k));
      start = k + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

const PRECISION_CALL = /"[^"]*"|\b(?:evalf|approx)\s*\(/g;
const INTEGER = /^\s*\d+\s*$/;

/** Every `evalf(e,n)` and `approx(e,n)` in `input` whose n is an integer literal, with n replaced by `at(n)`. */
export function withAskedPrecision(input: string, at: (n: number) => number): string {
  let out = "";
  let i = 0;
  for (;;) {
    PRECISION_CALL.lastIndex = i;
    const m = PRECISION_CALL.exec(input);
    if (!m) return out + input.slice(i);
    const end = PRECISION_CALL.lastIndex;
    if (m[0].startsWith('"')) {
      out += input.slice(i, end);
      i = end;
      continue;
    }
    const open = end - 1;
    const close = closing(input, open);
    if (close < 0) return out + input.slice(i);
    const args = topLevelArgs(input.slice(open + 1, close));
    out += input.slice(i, open + 1);
    out +=
      args.length === 2 && INTEGER.test(args[1]!)
        ? `${withAskedPrecision(args[0]!, at)},${at(parseInt(args[1]!, 10))}`
        : withAskedPrecision(input.slice(open + 1, close), at);
    out += ")";
    i = close + 1;
  }
}

/** Most digits an `evalf(e,n)` may ask the display for (beyond it the digits setting applies). */
export const MAX_ASKED_DIGITS = 1000;

/** n when the whole input is `evalf(e,n)` or `approx(e,n)` with an integer literal 1 ≤ n ≤ MAX_ASKED_DIGITS: the
 *  digits CAS shows the result with (decisions M4-6); null otherwise. */
export function askedDigits(input: string): number | null {
  const t = input.trim();
  const m = /^(?:evalf|approx)\s*\(/.exec(t);
  if (!m) return null;
  const open = m[0].length - 1;
  if (closing(t, open) !== t.length - 1) return null;
  const args = topLevelArgs(t.slice(open + 1, -1));
  if (args.length !== 2 || !INTEGER.test(args[1]!)) return null;
  const n = parseInt(args[1]!, 10);
  return n >= 1 && n <= MAX_ASKED_DIGITS ? n : null;
}

/** Names called in a Giac input (`romberg(exp(-x^2),x,0,1)` → romberg, exp). Strings are skipped. */
export function functionsIn(input: string): string[] {
  const out: string[] = [];
  const re = /"[^"]*"|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  for (let m = re.exec(input); m; m = re.exec(input)) if (m[1] && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Names in an input that are not called (`B*2+f(x)` → B, x). Strings are skipped. */
export function namesIn(input: string): string[] {
  const out: string[] = [];
  // Number literals first, so the exponent of 2e5 is not read as a name.
  const re = /"[^"]*"|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?/g;
  for (let m = re.exec(input); m; m = re.exec(input)) if (m[1] && !m[2] && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Why the facts of a float result carry a warning (`why` of HomeResult); undefined when nothing is to be said.
 *  `expr`: the input as it was run again, null when it could not be (a value evaluated once). */
export function whyOf(facts: readonly ElementFacts[], expr: string | null): PrecisionWhy | undefined {
  const unaudited = expr !== null && facts.some((f) => f.warn === "unaudited") ? functionsIn(expr).filter((f) => !AUDITED_FUNCTIONS.has(f)) : [];
  const once = facts.some((f) => f.warn === "unchecked" && !(isZero(f.value.re) && isZero(f.value.im))) || (expr === null && facts.some((f) => f.warn));
  if (!unaudited.length && !once) return undefined;
  return { ...(unaudited.length ? { unaudited } : {}), ...(once ? { once: true } : {}) };
}

/** Every function in the input is on the audited list. */
export function isAudited(input: string): boolean {
  return functionsIn(input).every((f) => AUDITED_FUNCTIONS.has(f));
}

// --- shapes: a scalar, a list, a matrix ------------------------------------------------------------------------------

export type Shape = { kind: "scalar" } | { kind: "list"; n: number } | { kind: "matrix"; rows: number; cols: number };

/** The elements of a bracketed Giac list (`[a,b]`, `list[a,b]`, the `solve` form), top level only; null otherwise. */
export function splitList(text: string): string[] | null {
  const t = text.trim();
  const body = t.startsWith("list[") ? t.slice(4) : t;
  if (!body.startsWith("[") || !body.endsWith("]")) return null;
  const inner = body.slice(1, -1);
  if (inner.trim() === "") return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < inner.length; k++) {
    const ch = inner.charAt(k);
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(inner.slice(start, k).trim());
      start = k + 1;
    }
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  parts.push(inner.slice(start).trim());
  return parts;
}

function hasTopLevelComma(t: string): boolean {
  let depth = 0;
  for (const ch of t) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

/** Elements above which a list or matrix is shown as Giac's text, unchecked (keeps Enter fast). */
export const MAX_ITEMS = 400;

/** The shape of a printed result; null when it is not a scalar, a flat list or a rectangular matrix of scalars. */
export function shapeOf(text: string): Shape | null {
  const t = text.trim();
  if (!t.startsWith("[") && !t.startsWith("list[")) {
    // A sequence (`1,2`), a set or a vector with another prefix is not a number we format.
    return /^\w+\[/.test(t) || hasTopLevelComma(t) ? null : { kind: "scalar" };
  }
  const els = splitList(t);
  if (!els || els.length === 0 || els.length > MAX_ITEMS) return null;
  const rows = els.map(splitList);
  if (rows.every((r) => r === null)) return { kind: "list", n: els.length };
  if (t.startsWith("list[")) return null;
  const cols = rows[0]?.length ?? 0;
  if (cols === 0 || rows.some((r) => r === null || r.length !== cols || r.some((x) => splitList(x) !== null))) return null;
  if (els.length * cols > MAX_ITEMS) return null;
  return { kind: "matrix", rows: els.length, cols };
}

/** The printed elements of `text` in shape order (rows flattened); null when it does not have that shape. */
export function flatten(text: string, shape: Shape): string[] | null {
  if (shape.kind === "scalar") return [text.trim()];
  const els = splitList(text);
  if (!els) return null;
  if (shape.kind === "list") return els.length === shape.n ? els : null;
  if (els.length !== shape.rows) return null;
  const out: string[] = [];
  for (const e of els) {
    const r = splitList(e);
    if (!r || r.length !== shape.cols) return null;
    out.push(...r);
  }
  return out;
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

/** A printed number (rational or float) as a DecimalValue; null if it is not one. */
function anyValue(text: string, keep: number): DecimalValue | null {
  const t = text.trim();
  return rationalValue(t, keep)?.v ?? decimalFromString(t.replace(/^-0\.0*$/, "0"), keep);
}

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** Runs fn with Giac's Digits set to d, then sets it back to `restore`. */
export function withDigits<T>(giac: Giac, d: number, restore: number, fn: () => T): T {
  giac.eval(`Digits:=${d}`);
  try {
    return fn();
  } finally {
    giac.eval(`Digits:=${restore}`);
  }
}

/** The real and imaginary parts of every element of `expr` (a stored value), printed by `print(part)`. */
export function readParts(
  giac: Giac,
  expr: string,
  shape: Shape,
  print: (part: string) => string,
  keep: number,
): { re: DecimalValue; im: DecimalValue }[] | null {
  const reT = print(`re(${expr})`);
  const imT = print(`im(${expr})`);
  if (isError(reT) || isError(imT)) return null;
  const re = flatten(reT, shape);
  const im = flatten(imT, shape);
  if (!re || !im || re.length !== im.length) return null;
  const out: { re: DecimalValue; im: DecimalValue }[] = [];
  for (let k = 0; k < re.length; k++) {
    const a = anyValue(re[k]!, keep);
    const b = anyValue(im[k]!, keep);
    if (!a || !b) return null;
    out.push({ re: a, im: b });
  }
  return out;
}

/** One element's facts (the scalar form of HomeResult's precision fields). */
export interface ElementFacts {
  value: ComplexValue;
  exactRational: boolean;
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  /** The exact numerator or denominator has more than maxExactDigits digits. */
  big: boolean;
}

/** Confirmed digits of a complex value: the weaker of its two parts (an exactly zero part needs no check). */
function confirmedComplex(a: ComplexValue, b: ComplexValue, aPrecision: number, cap: number): number {
  let n = cap;
  for (const k of ["re", "im"] as const) {
    if (isZero(a[k]) && isZero(b[k])) continue;
    n = Math.min(n, confirmedDigits(a[k], b[k], aPrecision, cap));
  }
  return n;
}

/**
 * A value that is 0 in every evaluation but not known to be exactly 0 (not an exact rational) has no confirmed digit:
 * `exp(10^-70)-1` is 0 at any working precision. It gets ⚠ without a count, never ≈ 0 (owner, 2026-10-13, G3).
 */
function zeroUnconfirmed(f: ElementFacts): ElementFacts {
  return !f.exactRational && !f.warn && isZero(f.value.re) && isZero(f.value.im) ? { ...f, warn: "unchecked" } : f;
}

/** Most working digits an agreement step uses, and the time the steps beyond P+40 may take per result (G23). */
export const MAX_EVAL_DIGITS = 1000;
const EXTRA_BUDGET_MS = 50;

/**
 * Facts for every element of the stored exact result `name` (its printed text is `exactText`): exact rationals by
 * BigInt, everything else by the symbolic agreement check (P against P+20, then P+20 against P+40). Null when some
 * element is not a number.
 */
export function exactFacts(giac: Giac, name: string, shape: Shape, digits: number, maxExactDigits: number): ElementFacts[] | null {
  const P = valuePrecision(digits);
  const reT = giac.eval(`re(${name})`);
  const imT = giac.eval(`im(${name})`);
  if (isError(reT) || isError(imT)) return null;
  const re = flatten(reT, shape);
  const im = flatten(imT, shape);
  if (!re || !im || re.length !== im.length) return null;
  const facts: (ElementFacts | null)[] = re.map((r, k) => {
    const a = rationalValue(r, P);
    const b = rationalValue(im[k]!, P);
    if (!a || !b) return null;
    const big = [a.p, a.q, b.p, b.q].some((x) => (x < 0n ? -x : x).toString().length > maxExactDigits);
    return { value: { re: a.v, im: b.v }, exactRational: true, reliableDigits: null, big };
  });
  if (facts.every((f) => f !== null)) return facts as ElementFacts[];
  const evalfAt = (prec: number) => readParts(giac, name, shape, (part) => giac.eval(`evalf(${part},${prec})`), P);
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
    let value = B[k]!;
    for (let i = 2; reliable < digits && more(i); i++) {
      const next = levels[i];
      if (!next) break;
      reliable = Math.max(reliable, confirmedComplex(levels[i - 1]![k]!, next[k]!, precs[i - 1]!, P));
      value = next[k]!;
    }
    return zeroUnconfirmed({ value, exactRational: false, reliableDigits: reliable, big: false });
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
): ElementFacts[] | null {
  // SB4: an element that is an exact rational in the stored result keeps its own facts (= or ≈), not the mark of the
  // weakest element. Read before the checks below, which store their values in `name`.
  const exact = shape.kind === "scalar" ? null : exactElements(giac, name, shape, valuePrecision(digits));
  const facts = floatFactsOf(giac, name, expr, shape, digits, restoreDigits);
  return facts && exact && exact.length === facts.length ? facts.map((f, k) => exact[k] ?? f) : facts;
}

/** The facts of each element of the stored list or matrix `name` that is an exact rational; null for the others. */
function exactElements(giac: Giac, name: string, shape: Shape, P: number): (ElementFacts | null)[] | null {
  const reT = giac.eval(`re(${name})`);
  const imT = giac.eval(`im(${name})`);
  if (isError(reT) || isError(imT)) return null;
  const re = flatten(reT, shape);
  const im = flatten(imT, shape);
  if (!re || !im || re.length !== im.length) return null;
  return re.map((r, k) => {
    const a = rationalValue(r, P);
    const b = rationalValue(im[k]!, P);
    return a && b ? { value: { re: a.v, im: b.v }, exactRational: true, reliableDigits: null, big: false } : null;
  });
}

function floatFactsOf(
  giac: Giac,
  name: string,
  expr: string | null,
  shape: Shape,
  digits: number,
  restoreDigits: number,
): ElementFacts[] | null {
  const P = valuePrecision(digits);
  // `asked`: the precision an evalf(e,n) in the input runs at in this evaluation (M4-6).
  const at = (d: number, slot: string, asked: (n: number) => number = (n) => Math.max(n, d)): { re: DecimalValue; im: DecimalValue }[] | null =>
    withDigits(giac, d, restoreDigits, () => {
      if (expr !== null) {
        const out = giac.eval(`${slot}:=(${withAskedPrecision(expr, asked)})`);
        if (isError(out)) return null;
      }
      return readParts(giac, expr === null ? name : slot, shape, (part) => giac.eval(part), P);
    });
  const unaudited = expr === null || !isAudited(expr);
  const facts = (v: { re: DecimalValue; im: DecimalValue }[], reliable: (k: number) => number, warn?: PrecisionWarn): ElementFacts[] =>
    v.map((value, k) => zeroUnconfirmed({ value, exactRational: false, reliableDigits: Math.min(reliable(k), P), big: false, ...(warn ? { warn } : {}) }));
  if (expr === null) {
    // A stateful input that cannot be run again: the value as printed, one-sided.
    const d = digits <= DOUBLE_DIGITS ? DOUBLE_DIGITS : digits;
    const v = at(d, name);
    return v && facts(v, () => Math.min(digits, d), "unchecked");
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
  const A = at(P, "pasm", (n) => Math.max(n, P));
  const B = A && at(P + 20, "pasm2", (n) => Math.max(n, P) + 20);
  if (A && B) {
    const reliable = B.map((b, k) => confirmedComplex(A[k]!, b, P, P));
    if (reliable.some((n) => n < digits)) {
      // Rule 2: once more, P+20 against P+40 (a cancellation only needs more working digits).
      const C = at(P + 40, "pasm3", (n) => Math.max(n, P) + 40);
      if (C) {
        giac.eval(`${name}:=pasm3`);
        return facts(C, (k) => Math.max(reliable[k]!, confirmedComplex(B[k]!, C[k]!, P + 20, P)));
      }
    }
    giac.eval(`${name}:=pasm2`);
    return facts(B, (k) => reliable[k]!);
  }
  if (A) {
    giac.eval(`${name}:=pasm`);
    return facts(A, () => Math.min(digits, DOUBLE_DIGITS), "unchecked");
  }
  return null;
}

/**
 * The double fallback for an exact result that has no MPFR value (docs/04 section 2.3 #5: `BesselJ(1,2)` at 30
 * digits comes back as text): `evalf` of the stored result with a double. Null when that is not a number either
 * (a symbolic result such as `x+1`). On success the double becomes Ans.
 */
export function doubleFallback(giac: Giac, name: string, input: string, digits: number, restoreDigits: number): ElementFacts | null {
  const out = withDigits(giac, DOUBLE_DIGITS, restoreDigits, () => {
    const t = giac.eval(`pasd:=evalf(${name})`);
    if (isError(t) || !hasFloat(t)) return null;
    return readParts(giac, "pasd", { kind: "scalar" }, (part) => giac.eval(part), DOUBLE_DIGITS);
  });
  if (!out) return null;
  giac.eval(`${name}:=pasd`);
  return {
    value: out[0]!,
    exactRational: false,
    reliableDigits: Math.min(digits, DOUBLE_DIGITS),
    warn: isAudited(input) ? "unchecked" : "unaudited",
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
  const run = (d: number, slot: string): string =>
    withDigits(giac, d, digits, () => giac.eval(`${slot}:=(${withAskedPrecision(expr, (n) => Math.max(n, W) + (d - W))})`));
  const read = (d: number, slot: string, shape: Shape) =>
    withDigits(giac, d, digits, () => readParts(giac, slot, shape, (part) => giac.eval(part), valuePrecision(digits)));
  const outA = run(W, once ? name : "pasf");
  if (isError(outA)) return { error: outA };
  const shape = shapeOf(outA);
  if (!shape) return { error: outA };
  const A = read(W, once ? name : "pasf", shape);
  if (!A) return { error: outA };
  if (once) return { facts: A.map((value) => ({ value, exactRational: false, reliableDigits: Math.min(digits, W - 10), warn: "unchecked", big: false })), shape };
  const outB = run(W + 20, name);
  const B = isError(outB) ? null : read(W + 20, name, shape);
  if (!B) {
    giac.eval(`${name}:=pasf`);
    return { facts: A.map((value) => ({ value, exactRational: false, reliableDigits: Math.min(digits, W - 10), warn: "unchecked", big: false })), shape };
  }
  return { facts: B.map((value, k) => zeroUnconfirmed({ value, exactRational: false, reliableDigits: Math.min(confirmedComplex(A[k]!, value, W, W), valuePrecision(digits)), big: false })), shape };
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
      const out = giac.eval(`paspt:=(${expr})`);
      if (isError(out)) return null;
      const v = readParts(giac, "paspt", shape, (part) => giac.eval(part), P);
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

// --- G38: decisions Giac makes inside an exact evaluation (docs/04 2.4 rule 2) --------------------------------------

/**
 * Functions whose result rests on a numeric decision Giac makes at `Digits` inside the exact evaluation: the sign of a
 * value, its place between two integers, or a branch (deep check 2026-10-19 E1). `int`, `sum`, `limit` and `solve`
 * decide signs inside. An input that calls one of them is evaluated again at P + 20 (decideTwice).
 */
export const DECISION_FUNCTIONS: ReadonlySet<string> = new Set([
  "floor", "ceil", "round", "frac", "fPart", "iPart", "sign", "abs", "max", "min", "piecewise", "when", "ifte",
  "int", "integrate", "sum", "limit", "solve",
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
  "sum", "product", "floor", "ceil", "round", "frac", "fPart", "iPart", "sign", "abs", "max", "min", "piecewise", "when",
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

/** The result of `input` (printed as `result`) may rest on a decision Giac made at `Digits`: the input calls a
 *  decision function or holds a comparison, or the result holds `abs(` (sqrt of an even power comes back as one).
 *  An input of rationals only (rationalOnly) decides exactly. */
export function restsOnDecision(input: string, result: string): boolean {
  if (rationalOnly(input)) return false;
  return functionsIn(input).some((f) => DECISION_FUNCTIONS.has(f)) || hasComparison(input) || result.includes("abs(");
}

/** A quantity whose sign (`zero`), distance to the nearest integer (`int`) or to the nearest half-integer (`half`)
 *  decides a discrete result. */
interface Cut {
  q: string;
  kind: "zero" | "int" | "half";
  /** The call it decides (floor, ceil, iPart, frac, fPart, sign): its name and [start, end) in the input. */
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

/** The cuts of every discrete decision in `expr`: floor, ceil, iPart, frac, fPart (an integer), round (a
 *  half-integer), sign and every comparison (zero). abs, max and min are continuous: a wrong branch at a tie gives the
 *  same value, and away from one the second evaluation finds it. */
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
    if ((name === "floor" || name === "ceil" || name === "iPart" || name === "frac" || name === "fPart") && args.length === 1) {
      cuts.push({ q: args[0]!, kind: "int", call });
    } else if (name === "round" && (args.length === 1 || args.length === 2)) {
      cuts.push({ q: args.length === 1 ? args[0]! : `(${args[0]!})*10^(${args[1]!})`, kind: "half" });
    } else if (name === "sign" && args.length === 1) cuts.push({ q: args[0]!, kind: "zero", call });
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
 * by its value exactly on the cut (floor(1) = 1, sign(0) = 0). Any other hit is `undecided`: the distance may be tiny
 * and not 0 (`floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2-10^-100)` is 0, Giac gives 0 at 40 and 60 digits and 1 at
 * 80), so neither text can be trusted. So is a proven tie on a comparison or a round (no value to put in its place).
 * `floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)` (exactly 1) is undecided too: Giac does not prove the sum is 1/2.
 * A quantity that is not a real number (a free name, a bound variable) is skipped.
 */
export function onCut(giac: Giac, expr: string, digits: number, restore: number): { tie: string } | { undecided: true } | null {
  if (/:=|=>|\bsto\s*\(/.test(expr)) return null;
  const P = valuePrecision(digits);
  const cuts = decisionCuts(expr);
  if (!cuts.length) return null;
  return withDigits(giac, P + 40, restore, () => {
    const hits: { cut: Cut; n: string; proven: boolean }[] = [];
    try {
      for (const c of cuts) {
        const x = giac.eval(`pasbx:=(${c.q})`);
        if (isError(x) || RATIONAL.test(x.trim())) continue;
        const near =
          c.kind === "zero" ? "0" : c.kind === "int" ? `round(evalf(pasbx,${P + 20}))` : `floor(evalf(pasbx,${P + 20}))+1/2`;
        const n = giac.eval(`pasbn:=${near}`);
        const d = giac.eval("pasbd:=pasbx-pasbn");
        if (isError(n) || isError(d) || RATIONAL.test(d.trim())) continue;
        const a = giac.eval(`pasba:=evalf(pasbd,${P + 20})`);
        const b = giac.eval(`pasbb:=evalf(pasbd,${P + 40})`);
        if (isError(a) || isError(b) || giac.eval("type(pasbb)") !== "real" || giac.eval("type(pasba)") !== "real") continue;
        if (giac.eval("when(abs(pasba-pasbb)<abs(pasbb)/2,0,1)") !== "1") continue;
        // The tie must be proven: a distance below the noise of both precisions need not be 0.
        const proven = ["simplify", "normal"].some((f) => giac.eval(`${f}(pasbd)`).trim() === "0");
        hits.push({ cut: c, n: n.trim(), proven });
      }
    } finally {
      giac.eval("purge(pasbx,pasbn,pasbd,pasba,pasbb)");
    }
    if (!hits.length) return null;
    if (hits.some((h) => !h.proven || !h.cut.call || !RATIONAL.test(h.n))) return { undecided: true };
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
  });
}

/** What the second decision found: the text stands (`from` set when it is another evaluation's, stored in `pasdec2`),
 *  or the evaluations disagree (`undecided`). */
export type Decision = { text: string; from?: string } | { undecided: true };

/**
 * G38 (docs/04 2.4 rule 2): `expr`, whose exact evaluation at P printed `text`, is computed again at P + 20 and must
 * print the same; if not, once more at P + 40, and the P + 20 and P + 40 texts must agree (the P + 40 value is kept in
 * `pasdec2`). An agreed text keeps its mark (a rational one stays `=`). A floor, ceil, iPart, frac, fPart or sign that
 * sits on its cut (onCut) takes the value it has exactly there when Giac proves the tie; an unproven one is undecided,
 * because Giac decides it by its rounding error and both precisions can agree on a wrong text.
 */
export function decideTwice(giac: Giac, expr: string, text: string, digits: number, restore: number): Decision {
  const P = valuePrecision(digits);
  const run = (d: number, slot: string, e: string = expr): string | null =>
    withDigits(giac, d, restore, () => {
      const t = giac.eval(`${slot}:=(${e})`);
      return isError(t) ? null : t;
    });
  const t2 = run(P + 20, "pasdec");
  let out: Decision;
  if (t2 === text) out = { text };
  else {
    const t3 = t2 === null ? null : run(P + 40, "pasdec2");
    out = t3 !== null && t3 === t2 ? { text: t3, from: "pasdec2" } : { undecided: true };
  }
  giac.eval("purge(pasdec)");
  if ("undecided" in out) return out;
  const cut = onCut(giac, expr, digits, restore);
  if (!cut) return out;
  if ("undecided" in cut) return cut;
  const tie = run(P + 40, "pasdec2", cut.tie);
  return tie === null || hasFloat(tie) ? out : { text: tie, from: "pasdec2" };
}
