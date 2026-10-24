// SPDX-License-Identifier: GPL-3.0-or-later
// G91 (structure audit text-1): the precision an `evalf(e,n)` or `approx(e,n)` asks for, made a literal before any
// reader of n sees the input (askedDigits, withAskedPrecision: decisions M4-6). Only erasable TypeScript syntax.
import { toExactLiterals } from "./homeEval.ts";
import { isLiteral, MAX_ASKED_DIGITS, mapPrecisions, type Giac } from "./numeric.ts";

/** The characters of a precision text with no name in it, once its decimals are exact (`20.0` is `(200/10^1)`, `2e1`
 *  is `(2*10^1)`). */
const NAMELESS = new Set("0123456789+-*/^() ");
/** Longest precision text evaluated (a typed n is short; a longer one stays unread). */
const MAX_TEXT = 64;

/**
 * `input` with every precision argument of `evalf` and `approx` that holds no name (digits, a decimal point, `+ - * / ^`,
 * brackets) evaluated by Giac once and, when its value is a whole number from 1 to MAX_ASKED_DIGITS, put in as that
 * literal: `approx(sin(10^30),2*10)` is `approx(sin(10^30),20)`, read as typed. Any other precision is kept, and the
 * value is ⚠ without a count (numeric.ts unreadPrecision). A name is not read: inside `seq`, `sum` or a function it may
 * be bound (G99). No Giac call for an input whose precisions are all literals; `ready` runs once before the first
 * (the view's mode setup, so the evaluation meets its budget and power limit).
 */
export function askedLiterals(giac: Giac, input: string, ready: () => void): string {
  const seen = new Map<string, string | null>();
  let set = false;
  return mapPrecisions(input, (n) => {
    if (isLiteral(n)) return null;
    const known = seen.get(n);
    if (known !== undefined) return known;
    const exact = toExactLiterals(n);
    let lit: string | null = null;
    if (n.length <= MAX_TEXT && [...exact].every((c) => NAMELESS.has(c)) && [...exact].some((c) => c >= "0" && c <= "9")) {
      if (!set) ready();
      set = true;
      // Giac's kind decides: an integer, with its digits in base 10 (bridge-3)
      const v = giac.value(`(${exact})`, []);
      const k = v.kind === "integer" && v.num !== undefined ? Number(v.num) : NaN;
      if (Number.isInteger(k) && k >= 1 && k <= MAX_ASKED_DIGITS) lit = String(k);
    }
    seen.set(n, lit);
    return lit;
  });
}
