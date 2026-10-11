// SPDX-License-Identifier: GPL-3.0-or-later
// Home results are decimals formatted by our own formatter (never JS Number.toString). This turns the
// formatted string into LaTeX for the 2D renderer: an exponent part becomes a raised power of ten.

/** `-1.5E-7` / `1.5×10^-7` style display strings -> LaTeX. Anything else is drawn as typed. */
export function homeResultToLatex(display: string): string {
  const s = display.trim();
  const sci = /^([+-]?\d+(?:\.\d+)?)\s*(?:E|e|×10\^)\s*([+-]?\d+)$/.exec(s);
  if (sci) return `${sci[1]}\\times10^{${sci[2]}}`;
  return s
    .replace(/\*i\b/g, "\\mathrm{i}")
    .replace(/(\d)\s*i\b/g, "$1\\mathrm{i}")
    .replace(/\*/g, "\\cdot ")
    .replace(/\binf\b/g, "\\infty");
}
