// SPDX-License-Identifier: GPL-3.0-or-later
// R40: the digits past what a constant's σ leaves (G26), muted on the screen's result row. A chunk of its own, off the
// start chunk (docs/04 8.3): the session loads it once a row has σ (Session.display), and the row is drawn unmuted
// until it is in. The text, the chips and Copy never take the span.
import { decimalFromString, isZero, PREFIXES, type ComplexValue, type FormattedNumber } from "../engine/format.ts";

/** The power of ten a PFX prefix puts on a mantissa, from format.ts's own table (PREFIXES); undefined for a text that
 *  is not one of its prefixes. */
export function prefixPower(p: string): number | undefined {
  for (const [k, v] of Object.entries(PREFIXES)) if (v === p) return Number(k);
  return undefined;
}

/**
 * `m` (a mantissa as drawn, maybe grouped) with its digits whose place value is below 10^`cut` in one muted span
 * (`\class{unc}`, Math.svelte). `exp` is the mantissa's power of ten. The digits shown below the cut are always the
 * mantissa's last ones, so the span is its tail.
 */
export function mutedTail(m: string, exp: number, cut: number): string {
  const point = m.indexOf(".");
  // the place of the digit before the next one: past the digits before the point
  let place = exp + [...(point < 0 ? m : m.slice(0, point))].filter((c) => c >= "0" && c <= "9").length;
  for (let i = 0; i < m.length; i++) {
    const c = m.charAt(i);
    if (c < "0" || c > "9") continue;
    place--;
    if (place < cut) return `${m.slice(0, i)}\\class{unc}{${m.slice(i)}}`;
  }
  return m;
}

/** The place value below which a real result's digits are uncertain: one above σ's first digit (the digits from σ's
 *  place on are uncertain, G26). Taken from σ itself, not from `uncDigits`, which was counted at the digits of the run:
 *  a value whose rounding moves its exponent (9.999…ᴇ14 at 12 digits is 1ᴇ15) keeps its cut at any digits setting.
 *  Undefined without σ (`uncDigits` and `uncSigma`), for a σ of zero, and for a zero or complex value. */
export function uncCut(facts: { uncDigits?: number; uncSigma?: string } | undefined, value: ComplexValue | undefined): number | undefined {
  const s = facts?.uncDigits === undefined || facts.uncSigma === undefined ? null : decimalFromString(facts.uncSigma);
  if (!s || isZero(s) || !value || !isZero(value.im) || isZero(value.re)) return undefined;
  return s.exp + 1;
}

/** The mantissa of a real part with its uncertain digits muted, for render/home.ts complexToLatex; undefined when no
 *  digit is (uncCut). A prefix this module does not know keeps every digit plain (never a wrong cut). */
export function muter(r: { facts?: { uncDigits?: number; uncSigma?: string }; value?: ComplexValue }): ((m: string, f: FormattedNumber) => string) | undefined {
  const cut = uncCut(r.facts, r.value);
  if (cut === undefined) return undefined;
  return (m, f) => {
    const exp = f.prefix !== undefined ? prefixPower(f.prefix) : (f.exponent ?? 0);
    return exp === undefined ? m : mutedTail(m, exp, cut);
  };
}
