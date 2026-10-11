// SPDX-License-Identifier: GPL-3.0-or-later
// Home number formatting (D5): STD, SCI and ENG from our own decimal value, never JS `Number`.
//
// The engine side turns a result into a DecimalValue: its leading significant digits, truncated
// (not rounded) at DECIMAL_KEEP digits, plus a sticky flag for anything non-zero beyond them.
// Rounding to n ≤ DECIMAL_KEEP digits from that is exact for both tie rules, so every display
// mode rounds once, from the same value, and the history can be re-formatted after a settings
// change without asking the engine again. Only erasable TypeScript syntax (Node runs it directly).
//
// The display conventions are our own until G2 checklist item 15 is answered (`assumed`):
//   STD n: up to n significant digits, trailing zeros dropped; plain notation for
//          1e-4 ≤ |x| < 10^n, otherwise mantissa and exponent.
//   SCI n: n significant digits, one before the point, exponent always shown.
//   ENG n: n significant digits, exponent a multiple of 3, 1 ≤ |mantissa| < 1000.
// Rounding is half away from zero; half to even is available for G2 item 8.

/** Significant digits a DecimalValue keeps (evalf strings from the engine carry 40). */
export const DECIMAL_KEEP = 40;

export interface DecimalValue {
  neg: boolean;
  /** Leading significant digits without leading or trailing zeros; "" means zero. */
  digits: string;
  /** Decimal exponent of the first digit: value = 0.d1d2… × 10^(exp+1). */
  exp: number;
  /** Non-zero digits were cut off after `digits`. */
  sticky: boolean;
}

export const ZERO_VALUE: DecimalValue = { neg: false, digits: "", exp: 0, sticky: false };

export type Rounding = "half-away" | "half-even";
export type NumberFormat = "STD" | "SCI" | "ENG";

export interface FormatOptions {
  format: NumberFormat;
  /** Significant digits (CLAUDE.md: 12 by default). */
  digits: number;
  rounding?: Rounding;
}

/** A formatted real number. The view draws it (e.g. the exponent as ×10^k); toText gives the canonical text. */
export interface FormattedNumber {
  neg: boolean;
  /** Digits with an optional decimal point, e.g. "1.25" or "120". */
  mantissa: string;
  /** Power of ten, or null for plain notation. */
  exponent: number | null;
}

export interface ComplexValue {
  re: DecimalValue;
  im: DecimalValue;
}

function pow10(k: number): bigint {
  return 10n ** BigInt(k);
}

function trimZeros(digits: string): string {
  return digits.replace(/0+$/, "");
}

/** p/q (q > 0) as a DecimalValue, exactly (BigInt long division). */
export function decimalFromRational(p: bigint, q: bigint, keep: number = DECIMAL_KEEP): DecimalValue {
  if (q <= 0n) throw new RangeError("denominator must be positive");
  if (p === 0n) return ZERO_VALUE;
  const neg = p < 0n;
  if (neg) p = -p;
  let e = p.toString().length - q.toString().length;
  // Make 10^e ≤ p/q < 10^(e+1).
  const below = (k: number) => (k >= 0 ? p < q * pow10(k) : p * pow10(-k) < q);
  if (below(e)) e -= 1;
  const shift = keep - 1 - e;
  const N = shift >= 0 ? p * pow10(shift) : p;
  const D = shift >= 0 ? q : q * pow10(-shift);
  const m = N / D;
  return { neg, digits: trimZeros(m.toString()), exp: e, sticky: N % D !== 0n };
}

/** A printed Giac float (`-0.3141e6`, `1.414…`, `2.5e-07`) as a DecimalValue; null if it is not one. */
export function decimalFromString(s: string, keep: number = DECIMAL_KEEP): DecimalValue | null {
  const m = /^(-?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(s.trim());
  if (!m) return null;
  const [, sign = "", ip = "", fp = "", ex] = m;
  if (ip === "" && fp === "") return null;
  const all = ip + fp;
  const lead = all.search(/[1-9]/);
  if (lead < 0) return ZERO_VALUE;
  const sig = trimZeros(all.slice(lead));
  return {
    neg: sign === "-",
    digits: sig.slice(0, keep),
    exp: ip.length - 1 - lead + (ex ? parseInt(ex, 10) : 0),
    sticky: /[1-9]/.test(sig.slice(keep)),
  };
}

export function isZero(v: DecimalValue): boolean {
  return v.digits === "";
}

/** v rounded to n significant digits: exactly n digits (zero: "0"), exp of the first digit. */
export function roundSignificant(
  v: DecimalValue,
  n: number,
  rounding: Rounding = "half-away",
): { neg: boolean; digits: string; exp: number } {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`digits must be a positive integer: ${n}`);
  if (isZero(v)) return { neg: false, digits: "0", exp: 0 };
  const head = v.digits.slice(0, n).padEnd(n, "0");
  const next = v.digits.charAt(n);
  let up: boolean;
  if (rounding === "half-away" || next !== "5") {
    up = next >= "5";
  } else {
    const beyond = v.sticky || /[1-9]/.test(v.digits.slice(n + 1));
    up = beyond || Number(head.charAt(n - 1)) % 2 === 1;
  }
  let d = BigInt(head) + (up ? 1n : 0n);
  let e = v.exp;
  if (d === pow10(n)) {
    d = pow10(n - 1);
    e += 1;
  }
  return { neg: v.neg, digits: d.toString(), exp: e };
}

/** The digits after the rounding position look like …4999… or …5000…: a value printed by a float
 *  engine could round the other way (double rounding). Exact values (from rationals) never set it. */
export function tieRisk(v: DecimalValue, n: number): boolean {
  // `digits` has no trailing zeros, so 5000… arrives as "5".
  const rest = v.digits.slice(n, n + 20);
  return /^49+$/.test(rest) || /^50*$/.test(rest);
}

function std(v: DecimalValue, n: number, rounding: Rounding): FormattedNumber {
  const r = roundSignificant(v, n, rounding);
  if (r.digits === "0") return { neg: false, mantissa: "0", exponent: null };
  const d = trimZeros(r.digits);
  if (r.exp >= -4 && r.exp < n) {
    if (r.exp < 0) return { neg: r.neg, mantissa: `0.${"0".repeat(-r.exp - 1)}${d}`, exponent: null };
    if (d.length <= r.exp + 1) return { neg: r.neg, mantissa: d + "0".repeat(r.exp + 1 - d.length), exponent: null };
    return { neg: r.neg, mantissa: `${d.slice(0, r.exp + 1)}.${d.slice(r.exp + 1)}`, exponent: null };
  }
  return { neg: r.neg, mantissa: d.length > 1 ? `${d[0]}.${d.slice(1)}` : d, exponent: r.exp };
}

function sci(v: DecimalValue, n: number, rounding: Rounding): FormattedNumber {
  const r = roundSignificant(v, n, rounding);
  const ds = r.digits.padEnd(n, "0"); // zero comes back as "0"
  return { neg: r.neg, mantissa: n > 1 ? `${ds[0]}.${ds.slice(1)}` : ds, exponent: r.exp };
}

function eng(v: DecimalValue, n: number, rounding: Rounding): FormattedNumber {
  const r = roundSignificant(v, n, rounding);
  if (r.digits === "0") return { neg: false, mantissa: n > 1 ? `0.${"0".repeat(n - 1)}` : "0", exponent: 0 };
  // Exponent from the rounded value, so 999.96 at 4 digits becomes 1.000E3, not 1000.E0.
  const e3 = Math.floor(r.exp / 3) * 3;
  const intLen = r.exp - e3 + 1;
  const ds = r.digits.padEnd(intLen, "0");
  const mantissa = ds.length > intLen ? `${ds.slice(0, intLen)}.${ds.slice(intLen)}` : ds;
  return { neg: r.neg, mantissa, exponent: e3 };
}

export function formatReal(v: DecimalValue, o: FormatOptions): FormattedNumber {
  const rounding = o.rounding ?? "half-away";
  switch (o.format) {
    case "STD":
      return std(v, o.digits, rounding);
    case "SCI":
      return sci(v, o.digits, rounding);
    case "ENG":
      return eng(v, o.digits, rounding);
  }
}

/** Canonical text (tests, copy): `-1.25E-5`, `0.333333333333`. */
export function toText(f: FormattedNumber): string {
  return `${f.neg ? "-" : ""}${f.mantissa}${f.exponent === null ? "" : `E${f.exponent}`}`;
}

export interface FormattedComplex {
  re: FormattedNumber;
  /** null when the imaginary part is zero. */
  im: FormattedNumber | null;
  /** Canonical text: `1.5`, `2*i`, `1-1.31695789692*i`. */
  text: string;
}

export function formatComplex(v: ComplexValue, o: FormatOptions): FormattedComplex {
  const re = formatReal(v.re, o);
  if (isZero(v.im)) return { re, im: null, text: toText(re) };
  const im = formatReal(v.im, o);
  const ims = toText({ ...im, neg: false });
  if (isZero(v.re)) return { re, im, text: `${im.neg ? "-" : ""}${ims}*i` };
  return { re, im, text: `${toText(re)}${im.neg ? "-" : "+"}${ims}*i` };
}
