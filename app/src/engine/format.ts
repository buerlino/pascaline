// SPDX-License-Identifier: GPL-3.0-or-later
// Home number formatting (D5): STD, SCI and ENG from our own decimal value, never JS `Number`.
//
// The engine side turns a result into a DecimalValue: its leading significant digits, truncated
// (not rounded) at DECIMAL_KEEP digits, plus a sticky flag for anything non-zero beyond them.
// Rounding to n ≤ DECIMAL_KEEP digits from that is exact for both tie rules, so every display
// mode rounds once, from the same value, and the history can be re-formatted after a settings
// change without asking the engine again. Only erasable TypeScript syntax (Node runs it directly).
//
// The display conventions are our own; the reference's differ (G2 item 15, tracked as backlog G9):
//   STD n: up to n significant digits, trailing zeros dropped; plain notation for
//          1e-4 ≤ |x| < 10^n, otherwise mantissa and exponent.
//   SCI n: n significant digits, one before the point, exponent always shown.
//   ENG n: n significant digits, exponent a multiple of 3, 1 ≤ |mantissa| < 1000.
//   FIX f: f digits after the point, plain notation (the Format key's optional "Fixed" mode).
//   PFX n: as ENG, with the exponent shown as an SI prefix (f p n µ m, none, k M G T P; docs/04 section 2.7);
//          outside 10^-15 … 10^15 it is ENG.
// Marks (docs/04 section 2.4): the engine reports facts (exactRational, reliableDigits, warn); markOf() and
// formatConfirmed() below decide, for the format on screen, which digits may be shown and which mark goes first.
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
export type NumberFormat = "STD" | "SCI" | "ENG" | "FIX" | "PFX";

export interface FormatOptions {
  format: NumberFormat;
  /** Significant digits (CLAUDE.md: 12 by default). */
  digits: number;
  rounding?: Rounding;
  /** Decimals after the point; only used by FIX (default 4). */
  fixed?: number;
}

/** A formatted real number. The view draws it (e.g. the exponent as ×10^k); toText gives the canonical text. */
export interface FormattedNumber {
  neg: boolean;
  /** Digits with an optional decimal point, e.g. "1.25" or "120". */
  mantissa: string;
  /** Power of ten, or null for plain notation. */
  exponent: number | null;
  /** PFX: the SI prefix that stands for the power of ten ("" for 10^0); exponent is then null. */
  prefix?: string;
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

/** FIX: a non-zero value whose every shown decimal would be 0 falls back to SCI with f decimals (G2 item 60: 4.7ᴇ-6 → 4.7000ᴇ-6). */
function fix(v: DecimalValue, f: number, rounding: Rounding): FormattedNumber {
  const r = fixPlain(v, f, rounding);
  if (!isZero(v) && /^0(\.0*)?$/.test(r.mantissa)) return sci(v, f + 1, rounding);
  return r;
}

function fixPlain(v: DecimalValue, f: number, rounding: Rounding): FormattedNumber {
  const zero: FormattedNumber = { neg: false, mantissa: f > 0 ? `0.${"0".repeat(f)}` : "0", exponent: null };
  if (isZero(v)) return zero;
  const keep = v.exp + 1 + f; // significant digits up to the last decimal place
  if (keep < 0) return zero;
  let digits: string;
  let exp: number;
  if (keep === 0) {
    // Below the last place: rounds to one unit of it, or to zero.
    const lead = v.digits.charAt(0);
    const beyond = v.digits.length > 1 || v.sticky;
    if (!(lead > "5" || (lead === "5" && (rounding === "half-away" || beyond)))) return zero;
    digits = "1";
    exp = -f;
  } else {
    ({ digits, exp } = roundSignificant(v, keep, rounding));
  }
  const ip = exp >= 0 ? digits.padEnd(exp + 1, "0").slice(0, exp + 1) : "0";
  const fp = (exp >= 0 ? digits.slice(exp + 1) : "0".repeat(-exp - 1) + digits).padEnd(f, "0");
  return { neg: v.neg, mantissa: f > 0 ? `${ip}.${fp}` : ip, exponent: null };
}

/** SI prefixes by power of ten (µ is U+00B5, as docs/04 section 2.7 says). */
const PREFIXES: Record<number, string> = { [-15]: "f", [-12]: "p", [-9]: "n", [-6]: "\u00b5", [-3]: "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", 15: "P" };

function pfx(v: DecimalValue, n: number, rounding: Rounding): FormattedNumber {
  const e = eng(v, n, rounding);
  // Zero and values inside f … P take a prefix; the exponent comes from the rounded value (999.96 k → 1.000 M).
  const p = e.exponent === null ? undefined : PREFIXES[e.exponent];
  if (p === undefined) return e;
  return { neg: e.neg, mantissa: e.mantissa, exponent: null, prefix: p };
}

export function formatReal(v: DecimalValue, o: FormatOptions): FormattedNumber {
  const rounding = o.rounding ?? "half-away";
  switch (o.format) {
    case "PFX":
      return pfx(v, o.digits, rounding);
    case "STD":
      return std(v, o.digits, rounding);
    case "SCI":
      return sci(v, o.digits, rounding);
    case "ENG":
      return eng(v, o.digits, rounding);
    case "FIX":
      return fix(v, o.fixed ?? 4, rounding);
  }
}

/** Thin space between a PFX mantissa and its prefix (docs/04 section 2.7). */
export const PREFIX_SPACE = "\u2009";

/** Canonical text (tests, copy): `-1.25E-5`, `0.333333333333`; PFX `1.5 m` with a thin space. */
export function toText(f: FormattedNumber): string {
  const tail = f.prefix ? `${PREFIX_SPACE}${f.prefix}` : f.exponent === null ? "" : `E${f.exponent}`;
  return `${f.neg ? "-" : ""}${f.mantissa}${tail}`;
}

export interface FormattedComplex {
  re: FormattedNumber;
  /** null when the imaginary part is zero. */
  im: FormattedNumber | null;
  /** Canonical text: `1.5`, `2*i`, `1-1.31695789692*i`. */
  text: string;
}

/** The imaginary part's text: a plain 1 is just `i` (1.5+i, not 1.5+1*i). */
function imagText(im: FormattedNumber): string {
  return im.mantissa === "1" && im.exponent === null ? "i" : `${toText({ ...im, neg: false })}*i`;
}

export function formatComplex(v: ComplexValue, o: FormatOptions): FormattedComplex {
  const re = formatReal(v.re, o);
  if (isZero(v.im)) return { re, im: null, text: toText(re) };
  const im = formatReal(v.im, o);
  const ims = imagText(im);
  if (isZero(v.re)) return { re, im, text: `${im.neg ? "-" : ""}${ims}` };
  return { re, im, text: `${toText(re)}${im.neg ? "-" : "+"}${ims}` };
}

/** The value as a decimal literal the engine reads back (`0.123e1`), digits as kept (40 at most). */
export function decimalToString(v: DecimalValue): string {
  if (isZero(v)) return "0";
  return `${v.neg ? "-" : ""}0.${v.digits}e${v.exp + 1}`;
}

/** ∡ (U+2221), typed by shift + the × key. */
export const POLAR_SIGN = "∡";

export interface FormattedPolar {
  r: FormattedNumber;
  theta: FormattedNumber;
  /** Canonical text: `5∡0.927295218002`. */
  text: string;
}

/** Polar form r∡θ; both numbers use the same format. The engine computes r and θ (abs and arg). */
export function formatPolar(r: DecimalValue, theta: DecimalValue, o: FormatOptions): FormattedPolar {
  const fr = formatReal(r, o);
  const ft = formatReal(theta, o);
  return { r: fr, theta: ft, text: `${toText(fr)}${POLAR_SIGN}${toText(ft)}` };
}

export interface FormattedFraction {
  neg: boolean;
  /** Integer part of a mixed fraction, or the whole value of an integer ("" when there is none). */
  whole: string;
  /** "" when the value is an integer. */
  num: string;
  den: string;
  /** Canonical text: `-7/3`, `-2 1/3`, `6`. */
  text: string;
}

/** p/q (q > 0, as the engine gives it) as a fraction or, with `mixed`, a mixed fraction. */
export function formatFraction(p: bigint, q: bigint, mixed: boolean): FormattedFraction {
  if (q <= 0n) throw new RangeError("denominator must be positive");
  const neg = p < 0n;
  const a = neg ? -p : p;
  const sign = neg ? "-" : "";
  if (a % q === 0n) return { neg, whole: (a / q).toString(), num: "", den: "", text: `${sign}${a / q}` };
  if (mixed && a > q) {
    const w = (a / q).toString();
    const n = (a % q).toString();
    return { neg, whole: w, num: n, den: q.toString(), text: `${sign}${w} ${n}/${q}` };
  }
  return { neg, whole: "", num: a.toString(), den: q.toString(), text: `${sign}${a}/${q}` };
}

// --- Marks and confirmed digits (docs/04 sections 2.2, 2.4) --------------------------------------------------------

/** `=` the text shown is the exact value; `≈` rounded, every digit shown confirmed; `⚠` see MarkInfo.n and warn. */
export type Mark = "=" | "≈" | "⚠";

/** Why a value gets ⚠ even when its digits agree (docs/04 section 2.4 rule 3):
 *  "unaudited": a float that Giac's numeric code returned for a function not on the audited list;
 *  "unchecked": nothing could be compared: only one evaluation gave a value, or every evaluation gave 0 for a value
 *  that is not exactly 0 (numeric.ts). */
export type PrecisionWarn = "unaudited" | "unchecked";

/** The reasons behind a ⚠, as facts for the chip that explains the mark (docs/04 section 8.2; the app words them):
 *  `unaudited`: the called functions the audit does not cover; `inherited`: the stored names whose facts (a warning, or
 *  fewer confirmed digits) changed the result's mark; `once`: the value could be evaluated only once, so nothing was compared. A constant's uncertainty is
 *  not sent: the app reads it from the chip table. It sits on the top-level result only, never on `items`. */
export interface PrecisionWhy {
  unaudited?: string[];
  inherited?: string[];
  once?: boolean;
  /** G39: Giac returned its [exact, numeric] pair for a definite integral, and the two answers differ ("why.pairDiffers"). */
  differ?: boolean;
}

/** The engine's facts about one result (a subset of HomeResult, so the formatter does not depend on the engine). */
export interface PrecisionFacts {
  value?: ComplexValue;
  exactRational: boolean;
  /** Significant digits confirmed by the agreement check; null = exact, nothing in doubt. */
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  /** A numeric list or matrix: its elements (the list's own value is absent). */
  items?: PrecisionFacts[];
  /** Only read when there is no value: a true or false that rests on a float (an == or ≠ test, R18f1) is ≈. */
  approximate?: boolean;
}

export interface MarkInfo {
  mark: Mark;
  /** ⚠ with fewer confirmed digits than the format asks for: how many are confirmed (and shown). */
  n?: number;
  warn?: PrecisionWarn;
}

/** Significant digits that `o` shows for v (FIX: the digits up to the last decimal place, at least 1). */
function digitsShown(v: DecimalValue, o: FormatOptions): number {
  if (o.format !== "FIX") return o.digits;
  if (fixFallsBack(v, o)) return (o.fixed ?? 4) + 1;
  return Math.max(1, v.exp + 1 + (o.fixed ?? 4));
}

/** FIX shows a non-zero v in scientific notation (every shown decimal would be 0). */
function fixFallsBack(v: DecimalValue, o: FormatOptions): boolean {
  return o.format === "FIX" && !isZero(v) && /^0(\.0*)?$/.test(fixPlain(v, o.fixed ?? 4, o.rounding ?? "half-away").mantissa);
}

/** The text in format `o` is exactly v: nothing non-zero is cut off. */
function shownExactly(v: DecimalValue, o: FormatOptions): boolean {
  if (isZero(v)) return true;
  if (v.sticky) return false;
  if (fixFallsBack(v, o)) return v.digits.length <= (o.fixed ?? 4) + 1;
  if (o.format === "FIX") return v.digits.length - (v.exp + 1) <= (o.fixed ?? 4);
  return v.digits.length <= o.digits;
}

/**
 * The format options that show only confirmed digits of `value`: `o` itself when every digit it shows is confirmed,
 * otherwise fewer significant digits (FIX: fewer decimals; SCI when not even the integer part is confirmed).
 * One reliable digit is the least shown (a ⚠ 0 value still shows its leading digit, with the mark saying so).
 */
export function confirmedOptions(value: ComplexValue, reliableDigits: number | null, o: FormatOptions): FormatOptions {
  if (reliableDigits === null) return o;
  const n = Math.max(1, reliableDigits);
  const parts = [value.re, value.im].filter((v) => !isZero(v));
  if (parts.every((v) => digitsShown(v, o) <= n)) return o;
  if (o.format !== "FIX") return { ...o, digits: Math.min(o.digits, n) };
  let fixed = o.fixed ?? 4;
  // A part in the SCI fallback shows fixed + 1 significant digits, so fixed is n - 1 there.
  for (const v of parts) fixed = Math.min(fixed, fixFallsBack(v, o) ? n - 1 : n - (v.exp + 1));
  return fixed >= 0 ? { ...o, fixed } : { ...o, format: "SCI", digits: n };
}

const RANK: Record<Mark, number> = { "⚠": 0, "≈": 1, "=": 2 };

function weakest(a: MarkInfo, b: MarkInfo): MarkInfo {
  if (RANK[a.mark] !== RANK[b.mark]) return RANK[a.mark] < RANK[b.mark] ? a : b;
  if (a.mark !== "⚠") return a;
  const n = a.n === undefined ? b.n : b.n === undefined ? a.n : Math.min(a.n, b.n);
  return { mark: "⚠", ...(n === undefined ? {} : { n }), ...((a.warn ?? b.warn) ? { warn: a.warn ?? b.warn } : {}) };
}

/**
 * The mark for a result shown in format `o` (docs/04 section 2.4); null for a non-number.
 * A non-number gets none, except a true or false resting on a float (`approximate`, R18f1), which is `≈`.
 * `=` needs an exact rational shown in full; `⚠ n` when fewer than the shown digits are confirmed; `⚠` with
 * `warn` for an un-audited or unchecked float; `≈` otherwise. A list or matrix gets its weakest element's mark.
 */
export function markOf(f: PrecisionFacts, o: FormatOptions): MarkInfo | null {
  if (f.items) {
    if (f.items.length === 0) return null;
    let m: MarkInfo | null = null;
    for (const it of f.items) {
      const x = markOf(it, o);
      if (!x) return null;
      m = m ? weakest(m, x) : x;
    }
    return m;
  }
  const v = f.value;
  // No value: an == or ≠ test resting on a float (R18f1); ⚠ when a side has an unaudited function (R18f2).
  if (!v) return f.approximate === true ? (f.warn ? { mark: "⚠", warn: f.warn } : { mark: "≈" }) : null;
  const parts = [v.re, v.im].filter((p) => !isZero(p));
  if (f.reliableDigits !== null && parts.some((p) => digitsShown(p, o) > Math.max(1, f.reliableDigits!))) {
    return { mark: "⚠", n: Math.max(0, f.reliableDigits), ...(f.warn ? { warn: f.warn } : {}) };
  }
  if (f.warn) return { mark: "⚠", warn: f.warn };
  if (f.exactRational && parts.every((p) => shownExactly(p, o))) return { mark: "=" };
  return { mark: "≈" };
}

/** The value formatted in `o`, showing confirmed digits only (canonical text: lists `[a,b]`; with `shape`, a matrix `[[a,b],[c,d]]`). */
export function formatConfirmed(f: PrecisionFacts & { shape?: [number, number] }, o: FormatOptions): string | null {
  if (f.items) {
    const texts: string[] = [];
    for (const it of f.items) {
      const t = formatConfirmed(it, o);
      if (t === null) return null;
      texts.push(t);
    }
    if (f.shape && f.shape[0] * f.shape[1] === texts.length && f.shape[1] > 0) {
      const [rows, cols] = f.shape;
      const rs: string[] = [];
      for (let r = 0; r < rows; r++) rs.push(`[${texts.slice(r * cols, (r + 1) * cols).join(",")}]`);
      return `[${rs.join(",")}]`;
    }
    return `[${texts.join(",")}]`;
  }
  if (!f.value) return null;
  return formatComplex(f.value, confirmedOptions(f.value, f.reliableDigits, o)).text;
}

// --- The agreement check (docs/04 section 2.4 rule 2) ---------------------------------------------------------------

/** v as m·10^e (m a signed BigInt). */
function scaled(v: DecimalValue): { m: bigint; e: number } {
  if (isZero(v)) return { m: 0n, e: 0 };
  const m = BigInt(v.digits);
  return { m: v.neg ? -m : m, e: v.exp + 1 - v.digits.length };
}

function fromScaled(m: bigint, e: number, keep: number): DecimalValue {
  return e >= 0 ? decimalFromRational(m * pow10(e), 1n, keep) : decimalFromRational(m, pow10(-e), keep);
}

/**
 * How many significant digits of `b` are confirmed by a second evaluation `a` (docs/04 section 2.4 rule 2).
 * `b` is the more precise of the two; `a` was printed with `aPrecision` significant digits. The error of `b` is taken
 * to be at most d = |a − b| + one unit in the last place of `a`, and n is the largest digit count (≤ cap) at which
 * every value in [b − d, b + d] rounds to the same n digits: then rounding `b` to n digits is right.
 * Two zeros confirm each other (the value cancelled to zero at both precisions); a zero and a non-zero confirm nothing.
 */
export function confirmedDigits(a: DecimalValue, b: DecimalValue, aPrecision: number, cap: number = DECIMAL_KEEP): number {
  if (isZero(a) && isZero(b)) return cap;
  if (isZero(a) || isZero(b)) return 0;
  const A = scaled(a);
  const B = scaled(b);
  // Common scale, one digit below a's last printed place.
  const ulpExp = a.exp + 1 - aPrecision;
  const e = Math.min(A.e, B.e, ulpExp);
  const am = A.m * pow10(A.e - e);
  const bm = B.m * pow10(B.e - e);
  const diff = am > bm ? am - bm : bm - am;
  const d = diff + pow10(ulpExp - e);
  const keep = cap + 2;
  const lo = fromScaled(bm - d, e, keep);
  const hi = fromScaled(bm + d, e, keep);
  if (isZero(lo) || isZero(hi) || lo.neg !== hi.neg) return 0;
  for (let n = cap; n >= 1; n--) {
    const x = roundSignificant(lo, n);
    const y = roundSignificant(hi, n);
    if (x.digits === y.digits && x.exp === y.exp) return n;
  }
  return 0;
}
