// SPDX-License-Identifier: GPL-3.0-or-later
// Home results are decimals formatted by our own formatter (never JS Number.toString). This turns the
// formatted string into LaTeX for the 2D renderer: an exponent part becomes a raised power of ten.

import type { FormattedComplex, FormattedFraction, FormattedNumber, FormattedPolar } from "../engine/format.ts";

function part(f: FormattedNumber): string {
  // PFX: a thin space, then the prefix in the accent colour (docs/04 2.7); .pfx is styled in Math.svelte
  if (f.prefix) return `${f.mantissa}\\,\\class{pfx}{\\mathrm{${f.prefix}}}`;
  return `${f.mantissa}${f.exponent === null ? "" : `\\times10^{${f.exponent}}`}`;
}

/** A formatted Home number as LaTeX: the exponent is drawn raised, the imaginary unit as i. */
export function complexToLatex(c: FormattedComplex): string {
  const re = `${c.re.neg ? "-" : ""}${part(c.re)}`;
  if (!c.im) return re;
  const im = c.im.mantissa === "1" && c.im.exponent === null && !c.im.prefix ? "\\mathrm{i}" : `${part(c.im)}\\mathrm{i}`;
  if (c.re.mantissa.replace(/[0.]/g, "") === "" && c.re.exponent === null && !c.re.prefix) return `${c.im.neg ? "-" : ""}${im}`;
  return `${re}${c.im.neg ? "-" : "+"}${im}`;
}

/** A fraction or mixed fraction drawn stacked (the entry line takes it back as \frac). */
export function fractionToLatex(f: FormattedFraction): string {
  const sign = f.neg ? "-" : "";
  if (f.num === "") return `${sign}${f.whole}`;
  return `${sign}${f.whole}\\frac{${f.num}}{${f.den}}`;
}

/** r∡θ, with the same ∡ the keyboard types. */
export function polarToLatex(p: FormattedPolar): string {
  const n = (f: FormattedNumber): string => `${f.neg ? "-" : ""}${part(f)}`;
  return `${n(p.r)}\\mathbin{\\measuredangle}${n(p.theta)}`;
}

/** `-1.5E-7` / `1.5×10^-7` style display strings -> LaTeX. Anything else is drawn as typed. */
export function homeResultToLatex(display: string): string {
  const s = display.trim();
  const sci = /^([+-]?\d+(?:\.\d+)?)\s*(?:E|e|×10\^)\s*([+-]?\d+)$/.exec(s);
  if (sci) return `${sci[1]}\\times10^{${sci[2]}}`;
  return s
    .replace(/\*i\b/g, "\\mathrm{i}")
    .replace(/(\d)\s*i\b/g, "$1\\mathrm{i}")
    .replace(/(^|[+-])i\b/g, "$1\\mathrm{i}")
    .replace(/\*/g, "\\cdot ")
    .replace(/\binf\b/g, "\\infty")
    .replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, "$1_{$2}");
}
