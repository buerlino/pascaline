// SPDX-License-Identifier: GPL-3.0-or-later
// Home results are decimals formatted by our own formatter (never JS Number.toString). This turns the
// formatted string into LaTeX for the 2D renderer: an exponent part becomes a raised power of ten.

import type { FormattedComplex, FormattedNumber } from "../engine/format.ts";

function part(f: FormattedNumber): string {
  return `${f.mantissa}${f.exponent === null ? "" : `\\times10^{${f.exponent}}`}`;
}

/** A formatted Home number as LaTeX: the exponent is drawn raised, the imaginary unit as i. */
export function complexToLatex(c: FormattedComplex): string {
  const re = `${c.re.neg ? "-" : ""}${part(c.re)}`;
  if (!c.im) return re;
  const im = `${part(c.im)}\\mathrm{i}`;
  if (c.re.mantissa.replace(/[0.]/g, "") === "" && c.re.exponent === null) return `${c.im.neg ? "-" : ""}${im}`;
  return `${re}${c.im.neg ? "-" : "+"}${im}`;
}

/** `-1.5E-7` / `1.5×10^-7` style display strings -> LaTeX. Anything else is drawn as typed. */
export function homeResultToLatex(display: string): string {
  const s = display.trim();
  const sci = /^([+-]?\d+(?:\.\d+)?)\s*(?:E|e|×10\^)\s*([+-]?\d+)$/.exec(s);
  if (sci) return `${sci[1]}\\times10^{${sci[2]}}`;
  return s
    .replace(/\*i\b/g, "\\mathrm{i}")
    .replace(/(\d)\s*i\b/g, "$1\\mathrm{i}")
    .replace(/\*/g, "\\cdot ")
    .replace(/\binf\b/g, "\\infty")
    .replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, "$1_{$2}");
}
