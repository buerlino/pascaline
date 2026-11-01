// SPDX-License-Identifier: GPL-3.0-or-later
// G140 (be-9): whether a part Giac printed with MPFR's digits holds only a double's bits. Exact BigInt arithmetic on
// binary64 values; UI-free, only erasable TypeScript syntax (Node runs it directly).
import { decimalToString, isZero, roundSignificant, type DecimalValue } from "./format.ts";

/** A print with fewer significant digits than this says nothing about a double (a double needs 17 to be told apart;
 *  numeric.ts DOUBLE_DIGITS, 14, plus 10). */
const BINARY64_PRINT_MIN = 24;
/** A double whose exact decimal expansion is this short or shorter (0.5, 2.25) is also a short MPFR value. */
const BINARY64_SHORT = 20;

/** The exact decimal expansion of a finite nonzero double `x` (its absolute value), trailing zeros dropped. */
function binary64Expansion(x: number): { digits: string; exp: number } {
  const bits = new BigUint64Array(new Float64Array([Math.abs(x)]).buffer)[0]!;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const m = biased === 0 ? frac : frac | (1n << 52n);
  const e2 = (biased === 0 ? 1 : biased) - 1075;
  const k = e2 < 0 ? -e2 : 0;
  const s = (e2 >= 0 ? m << BigInt(e2) : m * 5n ** BigInt(k)).toString();
  return { digits: s.slice(0, endOfDigits(s)), exp: s.length - 1 - k };
}

/** The length of `s` without its trailing zeros. */
function endOfDigits(s: string): number {
  let end = s.length;
  while (end > 0 && s[end - 1] === "0") end--;
  return end;
}

/** The double next to `x` towards +∞ (`up`) or −∞. */
function nextDouble(x: number, up: boolean): number {
  const f = new Float64Array([x]);
  const b = new BigInt64Array(f.buffer);
  b[0] = b[0]! + ((x > 0) === up ? 1n : -1n);
  return f[0]!;
}

/**
 * G140 (be-9): the double `v` is, a part Giac printed with `n` digits (`v` read with them, partValue), when it is exactly a
 * binary64 rounded to n digits: Giac's MPFR value of Zeta((1+2*i)/2) at 60 digits is the double's exact binary expansion,
 * then zeros, so its two precisions agree with each other and confirm nothing. Exact BigInt arithmetic on the double
 * nearest `v` (and its two neighbours): a plain dyadic test misses magnitudes below about 1E-3 or above 1E60, whose
 * expansion is longer than the print. Null for a zero, fewer digits than say anything about a double, or a double with a
 * short expansion (0.5, 2.25), which an MPFR value may hold exactly.
 */
export function binary64Of(v: DecimalValue, n: number): number | null {
  if (isZero(v) || v.sticky || n < BINARY64_PRINT_MIN) return null;
  const x = Number(decimalToString(v));
  if (!Number.isFinite(x) || x === 0) return null;
  const found = [x, nextDouble(x, true), nextDouble(x, false)].find((c) => {
    if (!Number.isFinite(c) || c === 0) return false;
    const e = binary64Expansion(c);
    if (e.digits.length <= BINARY64_SHORT) return false;
    const r = roundSignificant({ neg: false, digits: e.digits, exp: e.exp, sticky: false }, n);
    return r.exp === v.exp && r.digits.slice(0, endOfDigits(r.digits)) === v.digits;
  });
  return found ?? null;
}
