// SPDX-License-Identifier: GPL-3.0-or-later
// How a value with its uncertainty is written (G18, docs/04 2.6): σ to 2 significant digits, the value rounded to σ's
// last digit ("39.5 ± 1.2"). Pure text arithmetic on Giac's decimal text, no engine. Only erasable TypeScript syntax.

/** A decimal as m · 10^k. */
interface Dec {
  neg: boolean;
  m: bigint;
  k: number;
}

/** Giac's decimal text ("39.488", "-1.5e-05", "2E3") as an exact m · 10^k, or null when it is not a plain decimal. */
export function parseDecimal(text: string): Dec | null {
  const t = /^\s*([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?\s*$/.exec(text);
  if (!t || (t[2] === "" && t[3] === "")) return null;
  const frac = t[3]!;
  return { neg: t[1] === "-", m: BigInt((t[2]! + frac) || "0"), k: Number(t[4] ?? 0) - frac.length };
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** m · 10^k rounded half away from zero to a multiple of 10^place, as the integer count of those multiples. */
function roundTo(d: Dec, place: number): bigint {
  if (d.k >= place) return d.m * pow10(d.k - place);
  const q = pow10(place - d.k);
  const r = d.m / q;
  return 2n * (d.m % q) >= q ? r + 1n : r;
}

/** Digits `m` at the place `k`, written as text: plain for a nearby magnitude, else mantissa E exponent, with every
 *  digit kept (so "0.10" and "1.20E-9" keep their zero). */
function write(neg: boolean, m: bigint, k: number): string {
  const digits = m.toString();
  const e10 = digits.length - 1 + k;
  const sign = neg && m !== 0n ? "-" : "";
  if (m === 0n || (e10 >= -4 && e10 < 12)) {
    if (k >= 0) return sign + digits + "0".repeat(k);
    const pad = digits.padStart(-k + 1, "0");
    return `${sign}${pad.slice(0, pad.length + k)}.${pad.slice(pad.length + k)}`;
  }
  return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}E${e10}`;
}

/** σ at 2 significant digits as [m, k] with m in 10..99, or null for 0. */
function twoDigits(s: Dec): { m: bigint; k: number } | null {
  if (s.m === 0n) return null;
  const n = s.m.toString().length;
  let place = s.k + n - 2;
  let m = roundTo(s, place);
  if (m >= 100n) {
    m /= 10n;
    place += 1;
  }
  return { m, k: place };
}

/** σ at 2 significant digits ("1.2", "0.10"; "0" for 0); null when the text is not a number. */
export function uncertaintyText(sigma: string): string | null {
  const s = parseDecimal(sigma);
  if (!s) return null;
  const t = twoDigits(s);
  return t ? write(false, t.m, t.k) : "0";
}

/** "value ± σ": σ at 2 significant digits and the value rounded to the same last digit. Null when either is not a
 *  decimal. A σ of 0 leaves the value as it is. */
export function shownWithUncertainty(value: string, sigma: string, plainValue: string): string | null {
  const v = parseDecimal(value);
  const s = parseDecimal(sigma);
  if (!v || !s) return null;
  const t = twoDigits(s);
  if (!t) return `${plainValue} ± 0`;
  return `${write(v.neg, roundTo(v, t.k), t.k)} ± ${write(false, t.m, t.k)}`;
}
