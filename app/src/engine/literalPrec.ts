// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. A literal of n digits
// cancels at most n, so the check starts at n + P instead, and confirms as many digits as it does without one. An
// intermediate loss with no long literal (a tiny value stored in a name) is not caught here (S20's intervals are the
// general cure). The literals are read by giacPrint's number reader. Only erasable TypeScript syntax, so Node runs this
// file directly.
import { numbers, type Quoting } from "./giacPrint.ts";

/** A literal with more digits than P minus this raises where the agreement check starts (G141): at P it would leave
 *  fewer than this many digits after its cancellation. */
export const LITERAL_MARGIN = 20;
/** Levels above the start the agreement check may take before its further steps (S, S+20, S+40). */
const LEVELS_ABOVE = 40;

/** `d` without its leading zeros (one 0 is kept). */
function noLeadingZeros(d: string): string {
  let k = 0;
  while (k < d.length - 1 && d.charAt(k) === "0") k++;
  return d.slice(k);
}

/** Gaps a typed power's exponent may stand behind: `10^100`, `10^-100`, `10^(100)`, `10^(-100)`. */
const EXPONENT_GAPS: readonly string[] = ["", "-", "(", "(-"];

/**
 * The digit count of the longest exact integer in `text`: an integer as Giac prints it, or, in a text as typed, a power
 * of two integer literals (`10^(-100)` stands for a 101-digit denominator). 0 when there is none. Strings, names and
 * decimals count nothing.
 */
export function literalDigits(text: string, q: Quoting): number {
  const ints = [...numbers(text, q)].filter((n) => n.exp === undefined && !n.mant.includes("."));
  let total = 0;
  ints.forEach((n, k) => {
    total = Math.max(total, noLeadingZeros(n.mant).length);
    // a power of two integer literals
    const e = ints[k + 1];
    if (!e || text.charAt(n.end) !== "^" || text.charAt(n.at - 1) === ".") return;
    const gap = text.slice(n.end + 1, e.at);
    if (!EXPONENT_GAPS.includes(gap) || (gap.startsWith("(") && !text.startsWith(")", e.end))) return;
    const a = Number(n.mant);
    const b = Number(e.mant);
    if (a < 2 || b === 0) return;
    total = Math.max(total, Math.floor(b * Math.log10(a)) + 1);
  });
  return total;
}

/**
 * Where the agreement check of `text` starts when the value precision is P (G141): at P, or, for an exact integer of n
 * digits with n + LITERAL_MARGIN > P, at n + P. When those levels pass `cap` (MAX_EVAL_DIGITS), at P, and the value is
 * `unchecked` (⚠, never ≈): a power of ten too (G141f1, Opus pass 68: `(1-cos(10^-600))*10^1200+1` is 1.5, and at P and
 * P + 20 both round the 10^-600 away; S20's intervals are the cure).
 */
export function literalStart(text: string, P: number, cap: number, q: Quoting): { at: number; unchecked: boolean } {
  const n = literalDigits(text, q);
  if (n + LITERAL_MARGIN <= P) return { at: P, unchecked: false };
  if (n + P + LEVELS_ABOVE <= cap) return { at: n + P, unchecked: false };
  return { at: P, unchecked: true };
}
