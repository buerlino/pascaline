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
import {
  confirmedDigits,
  decimalFromRational,
  decimalFromString,
  isZero,
  type ComplexValue,
  type DecimalValue,
  type PrecisionWarn,
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
  "sqrt", "exp", "ln", "log", "log10", "sin", "cos", "tan", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "abs", "re", "im", "conj", "arg", "sign", "floor", "ceil", "round", "frac", "max", "min",
  "sigfig",
]);

const FLOAT_LITERAL = /(?<![A-Za-z_0-9.])(?:\d+\.\d*|\.\d+|\d+(?=e[+-]?\d))(?:e[+-]?\d+)?/;

/** Giac printed a float somewhere in this text (its exact results never contain one). */
export function hasFloat(text: string): boolean {
  return FLOAT_LITERAL.test(text);
}

/** Names called in a Giac input (`romberg(exp(-x^2),x,0,1)` → romberg, exp). Strings are skipped. */
export function functionsIn(input: string): string[] {
  const out: string[] = [];
  const re = /"[^"]*"|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  for (let m = re.exec(input); m; m = re.exec(input)) if (m[1] && !out.includes(m[1])) out.push(m[1]);
  return out;
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
  let C: { re: DecimalValue; im: DecimalValue }[] | null | undefined;
  return facts.map((f, k) => {
    if (f) return f;
    let reliable = confirmedComplex(A[k]!, B[k]!, P, P);
    let value = B[k]!;
    if (reliable < digits) {
      C ??= evalfAt(P + 40);
      if (C) {
        reliable = Math.max(reliable, confirmedComplex(B[k]!, C[k]!, P + 20, P));
        value = C[k]!;
      }
    }
    return { value, exactRational: false, reliableDigits: reliable, big: false };
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
  const P = valuePrecision(digits);
  const at = (d: number, slot: string): { re: DecimalValue; im: DecimalValue }[] | null =>
    withDigits(giac, d, restoreDigits, () => {
      if (expr !== null) {
        const out = giac.eval(`${slot}:=(${expr})`);
        if (isError(out)) return null;
      }
      return readParts(giac, expr === null ? name : slot, shape, (part) => giac.eval(part), P);
    });
  const unaudited = expr === null || !isAudited(expr);
  const facts = (v: { re: DecimalValue; im: DecimalValue }[], reliable: (k: number) => number, warn?: PrecisionWarn): ElementFacts[] =>
    v.map((value, k) => ({ value, exactRational: false, reliableDigits: Math.min(reliable(k), P), big: false, ...(warn ? { warn } : {}) }));
  if (expr === null) {
    // A stateful input that cannot be run again: the value as printed, one-sided.
    const d = digits <= DOUBLE_DIGITS ? DOUBLE_DIGITS : digits;
    const v = at(d, name);
    return v && facts(v, () => Math.min(digits, d), "unchecked");
  }
  if (unaudited) {
    const D = at(DOUBLE_DIGITS, "pasd");
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
  const A = at(P, "pasm");
  const B = A && at(P + 20, "pasm2");
  if (A && B) {
    giac.eval(`${name}:=pasm2`);
    return facts(B, (k) => confirmedComplex(A[k]!, B[k]!, P, P));
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
  const run = (d: number, slot: string): string => withDigits(giac, d, digits, () => giac.eval(`${slot}:=(${expr})`));
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
  return { facts: B.map((value, k) => ({ value, exactRational: false, reliableDigits: Math.min(confirmedComplex(A[k]!, value, W, W), valuePrecision(digits)), big: false })), shape };
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
