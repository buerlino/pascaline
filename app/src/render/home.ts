// SPDX-License-Identifier: GPL-3.0-or-later
// Home results are decimals formatted by our own formatter (never JS Number.toString). This turns the
// formatted string into LaTeX for the 2D renderer: an exponent part becomes a raised power of ten.

import type { FormattedComplex, FormattedFraction, FormattedNumber, FormattedPolar } from "../engine/format.ts";
import { balanced, mapNames } from "../engine/giacPrint.ts";

/** R125, Settings › Numbers › Digit groups: the thin space (R55's, the default), the apostrophe or the comma. */
export type GroupSep = "thin" | "apos" | "comma";
/** Each separator as the drawn LaTeX has it: the apostrophe as text (math mode makes `'` a prime), the comma braced (no
 *  space after it). */
export const GROUP_LATEX: Readonly<Record<GroupSep, string>> = { thin: "\\,", apos: "\\text{'}", comma: "{,}" };
/** The separator drawn: the setting's, but never the comma while the comma is the decimal mark (R57); a stored comma
 *  then draws as the thin space and stays stored. */
export const groupSepFor = (sep: GroupSep | undefined, decimalComma: boolean | undefined): GroupSep =>
  sep === undefined || (sep === "comma" && decimalComma === true) ? "thin" : sep;

/**
 * R55: a mantissa's digits in groups of three from the decimal point outward, `sep` between them (the thin space's LaTeX
 * by default), on a side with five or more digits (1234 and 0.1234 stay whole). Drawn results only: the text, the
 * chips and Copy stay plain.
 */
export const groupDigits = (m: string, sep = "\\,"): string =>
  m.replace(/\d{5,}/g, (d, at: number) => (at ? d.replace(/(\d{3})(?=\d)/g, (g) => g + sep) : d.replace(/\B(?=(\d{3})+$)/g, () => sep)));

/** R40: a real part's mantissa as drawn, with its uncertain digits muted (render/uncMute.ts muter, a chunk of its own). */
export type Mute = (m: string, f: FormattedNumber) => string;

/** `sep`: the digit groups' separator as LaTeX (GROUP_LATEX); undefined: no groups. */
function part(f: FormattedNumber, sep: string | undefined, mute?: Mute): string {
  const g = sep === undefined ? f.mantissa : groupDigits(f.mantissa, sep);
  const m = mute ? mute(g, f) : g;
  // PFX: a thin space, then the prefix in the accent colour (docs/04 2.7); .pfx is styled in Math.svelte
  if (f.prefix) return `${m}\\,\\class{pfx}{\\mathrm{${f.prefix}}}`;
  return `${m}${f.exponent === null ? "" : `\\times10^{${f.exponent}}`}`;
}

/** A formatted Home number as LaTeX: the exponent is drawn raised, the imaginary unit as i; `group`: the digit groups'
 *  separator as LaTeX (R55, R125), undefined for none. */
export function complexToLatex(c: FormattedComplex, group?: string, mute?: Mute): string {
  const re = `${c.re.neg ? "-" : ""}${part(c.re, group, c.im ? undefined : mute)}`;
  if (!c.im) return re;
  const im = c.im.mantissa === "1" && c.im.exponent === null && !c.im.prefix ? "\\mathrm{i}" : `${part(c.im, group)}\\mathrm{i}`;
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
export function polarToLatex(p: FormattedPolar, group?: string): string {
  const n = (f: FormattedNumber): string => `${f.neg ? "-" : ""}${part(f, group)}`;
  return `${n(p.r)}\\mathbin{\\measuredangle}${n(p.theta)}`;
}

/** The Greek variable names as Giac prints them (input/parse.ts GREEK, R18; beta_, gamma_, Gamma_, epsilon_, Phi_,
 *  Psi_ stand in for names Giac keeps), and the letter each one is drawn as. Kept here, not imported, so the parser
 *  stays lazy. */
const GREEK_NAMES: ReadonlySet<string> = new Set([
  "alpha", "beta_", "gamma_", "delta", "epsilon_", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "rho", "sigma",
  "tau", "phi", "chi", "psi", "omega", "Gamma_", "Delta", "Theta", "Lambda", "Sigma", "Phi_", "Psi_", "Omega",
]);
const greekLetter = (name: string): string => {
  const n = name.replace(/_$/, "");
  return `\\${n === "epsilon" ? "varepsilon" : n === "phi" ? "varphi" : n} `;
};
/** G105f1: the names of Giac's print drawn as LaTeX (giacPrint.ts names: whole names, strings skipped): a Greek name
 *  as its letter, `x_1` with its subscript, `inf` and `infinity` (Giac prints ∞, R18: Shift + 9, as +infinity) as ∞. */
const nameLatex = ({ name }: { name: string }): string | null => {
  if (GREEK_NAMES.has(name)) return greekLetter(name);
  if (name === "inf" || name === "infinity") return "\\infty";
  const sub = name.charAt(0) !== "_" && name.charAt(1) === "_" && name.length > 2 && !name.slice(2).includes("_") ? name : "";
  return sub ? `${sub.charAt(0)}_{${sub.slice(2)}}` : null;
};

/** R18f1: an equality test that stays as typed is printed `(x==2)` or `x<>2`; drawn as x==2 and x≠2. */
function relationText(s: string): string {
  const inner = /^\((.*)\)$/.exec(s)?.[1];
  const t = inner !== undefined && /==|<>/.test(inner) && balanced(inner, "printed") ? inner : s;
  return t.replace(/<>/g, "\\ne ");
}

/** `-1.5E-7` / `1.5×10^-7` style display strings -> LaTeX. Anything else is drawn as typed. */
export function homeResultToLatex(display: string): string {
  // G109: a list of Giac's list type is shown with braces, which LaTeX would read as a group
  const s = relationText(display.trim()).replace(/[{}]/g, "\\$&");
  const sci = /^([+-]?\d+(?:\.\d+)?)\s*(?:E|e|×10\^)\s*([+-]?\d+)$/.exec(s);
  if (sci) return `${sci[1]}\\times10^{${sci[2]}}`;
  return mapNames(s, nameLatex, "printed")
    .replace(/\*i\b/g, "\\mathrm{i}")
    .replace(/(\d)\s*i\b/g, "$1\\mathrm{i}")
    .replace(/(^|[+-])i\b/g, "$1\\mathrm{i}")
    .replace(/\*/g, "\\cdot ");
}
