// SPDX-License-Identifier: GPL-3.0-or-later
// G110f1: an exact CAS form on numbers as the census reads it: its value at EXACT_DIGITS and the digits a second reading at
// EXACT_DIGITS + 20 agrees on, for a scalar and for each element of a list or matrix (a list answer is judged item by item).
// Pure: it reads a bridge-3 value (worker.ts evaluates it), so it is tested without an engine.
import { confirmedDigits, type ComplexValue } from "../../../app/src/engine/format.ts";
import { numbersAt, shapeOfValue, size } from "../../../app/src/engine/numeric.ts";
import type { GiacValue } from "../../../app/src/engine/bridge.ts";

/** The digits an exact CAS form is read at: more than the 50 the judge's `=` checks. */
export const EXACT_DIGITS = 60;
/** The second reading's digits. */
export const EXACT_HI = EXACT_DIGITS + 20;
/** The digits the judge's `=` checks (judge.ts: equal to 1e-50). */
const EQUAL_DIGITS = 50;

/** What an exact form claims: `=` from 50 agreeing digits, `≈` from the setting's digits, else `⚠ n`. */
export interface ExactClaim {
  value: ComplexValue;
  mark: "=" | "≈" | "⚠";
  n?: number;
  exact: true;
}

/** An exact list's item: its element's text, and its claim where the element reads as a number. */
export interface ExactItem {
  text: string;
  value?: ComplexValue;
  mark?: "=" | "≈" | "⚠";
  n?: number;
  exact?: true;
}

function claimOf(value: ComplexValue, n: number, digits: number): ExactClaim {
  if (n >= EQUAL_DIGITS) return { value, mark: "=", exact: true };
  if (n >= digits) return { value, mark: "≈", exact: true };
  return { value, mark: "⚠", n, exact: true };
}

/**
 * `v` (bridge-3 at [EXACT_DIGITS, EXACT_HI]) read element by element: the digits the two readings agree on (format.ts
 * confirmedDigits; a part Giac computed in a C double, Airy_Ai or BesselJ with no MPFR path, confirms no more than it prints), less
 * one. A scalar gives its claim, a list or matrix its items (an element that reads as no number, or agrees on no digit, has none);
 * null for any other shape, and for a scalar or a list with no item read.
 */
export function exactReading(v: GiacValue, digits: number): { scalar: ExactClaim } | { items: ExactItem[] } | null {
  const shape = shapeOfValue(v);
  if (!shape) return null;
  const k = size(shape);
  const lo = numbersAt(v, EXACT_DIGITS, EXACT_DIGITS, k);
  const hi = numbersAt(v, EXACT_HI, EXACT_HI, k);
  const dbl = v.doubles?.[String(EXACT_DIGITS)] ?? [];
  const read = (i: number): ExactClaim | null => {
    const a = lo?.[i];
    const b = hi?.[i];
    if (!a || !b) return null;
    let agree = Math.min(confirmedDigits(a.re, b.re, EXACT_DIGITS, EXACT_DIGITS), confirmedDigits(a.im, b.im, EXACT_DIGITS, EXACT_DIGITS), a.short ?? EXACT_DIGITS);
    if (dbl[i]) agree = Math.min(agree, ...[a.re, a.im].filter((p) => p.digits !== "").map((p) => p.digits.length));
    const n = agree - 1;
    return n >= 1 ? claimOf({ re: a.re, im: a.im }, n, digits) : null;
  };
  if (shape.kind === "scalar") {
    const c = read(0);
    return c ? { scalar: c } : null;
  }
  const items: ExactItem[] = [];
  for (let i = 0; i < k; i++) {
    const c = read(i);
    items.push({ text: v.elements?.[i] ?? "", ...(c ?? {}) });
  }
  return items.some((it) => it.mark) ? { items } : null;
}
