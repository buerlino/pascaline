// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. Each evaluation
// starts at the digit count of the longest exact integer in the text plus LITERAL_MARGIN instead. An intermediate loss
// with no long literal (a tiny value stored in a name) is not caught here (S20's intervals are the general cure).
// Only erasable TypeScript syntax, so Node runs this file directly.

/** Digits above the longest exact integer at which the agreement check starts (G141). */
export const LITERAL_MARGIN = 20;
/** Levels above the start the agreement check may take before its further steps (S, S+20, S+40). */
const LEVELS_ABOVE = 40;

/** An integer literal that is no part of a name or a decimal. */
const INTEGER_RUN = /(?<![\w.])\d+(?![\w.])/g;
/** A power of two integer literals as typed (`10^100`, `10^(-100)`, `2^-64`): its value has about |b|·log10(a) digits. */
const LITERAL_POWER = /(?<![\w.)])(\d+)\^(?:\((-?\d+)\)|(-?\d+))(?![\w.])/g;

/** The longest exact integer in `text`: its digit count (`total`) and its digits without the trailing zeros (`sig`). */
export interface LiteralDigits {
  total: number;
  sig: number;
}

/**
 * The digit counts of the longest exact integer in `text`: an integer as Giac prints it (whole), or, in a text as typed,
 * a power of two integer literals (`10^(-100)` stands for a 101-digit denominator, one significant digit). 0 when there
 * is none. A string in the text counts too; it only raises the precision.
 */
export function literalDigits(text: string): LiteralDigits {
  let total = 0;
  let sig = 0;
  for (const m of text.matchAll(INTEGER_RUN)) {
    const d = m[0].replace(/^0+(?=\d)/, "");
    total = Math.max(total, d.length);
    sig = Math.max(sig, d.replace(/0+$/, "").length);
  }
  for (const m of text.matchAll(LITERAL_POWER)) {
    const a = Number(m[1]);
    const b = Math.abs(Number(m[2] ?? m[3]));
    if (a < 2 || b === 0) continue;
    const n = Math.floor(b * Math.log10(a)) + 1;
    total = Math.max(total, n);
    if (m[1]!.replace(/0+$/, "") !== "1") sig = Math.max(sig, n);
  }
  return { total, sig };
}

/**
 * Where the agreement check of `text` starts when the value precision is P (G141): at the longest exact integer's
 * digits plus LITERAL_MARGIN, at least P. When those levels pass `cap` (MAX_EVAL_DIGITS), at its significant digits plus
 * the margin: a power of ten (10^1250 in asinh(-10^1250)) is the same number at any precision. When those pass the cap
 * too, at P, and the value is `unchecked` (⚠, never ≈).
 */
export function literalStart(text: string, P: number, cap: number): { at: number; unchecked: boolean } {
  const { total, sig } = literalDigits(text);
  for (const n of [total, sig]) {
    const at = Math.max(P, n + LITERAL_MARGIN);
    if (at + LEVELS_ABOVE <= cap) return { at, unchecked: false };
  }
  return { at: P, unchecked: true };
}
