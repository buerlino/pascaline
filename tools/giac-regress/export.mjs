// SPDX-License-Identifier: GPL-3.0-or-later
// G89: our golden cases (tests/golden/home.yaml, precision.yaml) as a Giac regression file, in the shape of Giac's own
// check/intexp.cas: one line per case compares Giac's value with the expected one within half a unit of its last digit;
// failing lines are printed with a count at the end. Clean room: our cases only, source oracle or derived.
//   node tools/giac-regress/export.mjs      writes pascaline-check.cas, pascaline-known.cas, pascaline-patched.cas, and prints the counts
// The Giac text of a case is what Home evaluates for its input: the typed decimals as exact rationals
// (toExactLiterals, app/src/engine/homeEval.ts), at Digits = valuePrecision(digits) = max(40, digits + 10), in radians.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = new URL(".", import.meta.url);
const { toExactLiterals, ENGINE_DEFINITIONS, WORKER_DEFINITION_NAMES } = await import(new URL("../../app/src/engine/homeEval.ts", import.meta.url).href);
const YAML = createRequire(new URL("../../app/package.json", import.meta.url))("yaml");

const NUM = String.raw`\d+(?:\.\d+)?(?:E[+-]?\d+)?`;
const SHOWN = new RegExp(String.raw`^(?:(?<re>-?${NUM})(?:(?<sign>[+-])(?<imn>${NUM}\*)?i)?|(?<ineg>-)?(?<imo>${NUM}\*)?i)$`);

/** The parts of a shown number: [{ text, mark }] real part first; null when the text is not a number. */
function partsOf(text) {
  const m = typeof text === "string" ? SHOWN.exec(text) : null;
  if (!m) return null;
  const g = m.groups;
  if (g.re !== undefined) {
    const out = [{ mag: g.re.replace(/^-/, ""), neg: g.re.startsWith("-"), unit: "" }];
    if (g.sign) out.push({ mag: g.imn ? g.imn.slice(0, -1) : "1", neg: g.sign === "-", unit: "i", unitMag: !g.imn });
    return out;
  }
  return [{ mag: g.imo ? g.imo.slice(0, -1) : "1", neg: !!g.ineg, unit: "i", unitMag: !g.imo }];
}

/** An unsigned decimal text (`1.5E300`) as exact Giac text: `(15*10^299)`, `(981/10^2)`, or plain digits. */
function exactMagnitude(mag) {
  const [mant, exp = "0"] = mag.split("E");
  const [ip, fp = ""] = mant.split(".");
  const digits = (ip + fp).replace(/^0+(?=\d)/, "");
  const e = parseInt(exp, 10) - fp.length;
  if (e === 0) return digits;
  return e > 0 ? `(${digits}*10^${e})` : `(${digits}/10^${-e})`;
}

/** The shown number as exact Giac text: `11-2*i`, `-(5/10^1)-(5/10^1)*i`, `(1/10^5)`. */
export function expectedExact(text) {
  const parts = partsOf(text);
  if (!parts) throw new Error(`not a number: ${text}`);
  return parts
    .map((p, k) => {
      const mag = exactMagnitude(p.mag);
      const body = p.unit ? (p.unitMag ? "i" : `${mag}*i`) : mag;
      return `${p.neg ? "-" : k > 0 ? "+" : ""}${body}`;
    })
    .join("");
}

/** Half a unit of the last of `digits` significant digits of each non-zero part, as exact Giac text; a value of exactly
 *  0 is checked within 1/10^30 (the working precision is 40 digits or more). */
export function halfUnit(text, digits) {
  const halves = [];
  for (const p of partsOf(text)) {
    const [mant, exp = "0"] = p.mag.split("E");
    const [ip, fp = ""] = mant.split(".");
    const all = (ip + fp).replace(/^0+/, "");
    if (all === "" || /^0*$/.test(all)) continue;
    const lead = (ip + fp).length - (ip + fp).replace(/^0+/, "").length; // zeros before the first digit
    const e10 = parseInt(exp, 10) + ip.length - 1 - lead;
    const u = e10 - digits + 1; // the last digit's place value is 10^u; half of it is 5*10^(u-1)
    halves.push(u - 1 >= 0 ? `5*10^${u - 1}` : `5/10^${1 - u}`);
  }
  return halves.length ? halves.join("+") : "1/10^30";
}

const OUR_NAMES = new RegExp(`(?<![A-Za-z_0-9])(?:${[...Object.keys(ENGINE_DEFINITIONS), ...WORKER_DEFINITION_NAMES, "pasmedian", "paspercentile", "pasmod", "pas[a-z_0-9]*"].join("|")})\\(`);

/** True when the input gives approx or evalf a second argument (an explicit precision): Home raises that precision itself (G91), so the case tests our rewrite, not Giac. */
export function explicitPrecision(input) {
  for (const m of input.matchAll(/(?<![A-Za-z_0-9])(?:approx|evalf)\(/g)) {
    let depth = 1;
    for (let k = m.index + m[0].length; k < input.length && depth > 0; k++) {
      const ch = input[k];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 1) return true;
    }
  }
  return false;
}

/** The check line of a golden case, `{ comment, line }`, or `{ leftOut: reason }` when the case depends on our layer. */
export function caseLine(c, file) {
  if (c.source !== "oracle" && c.source !== "derived") return { leftOut: `source ${c.source} (only oracle and derived)` };
  if (c.kind !== undefined || c.status === "pending") return { leftOut: "CAS view or pending case (our layer)" };
  if (c.input === undefined || c.before || c.beforeCas || c.beforeHome || c.steps || c.relaunch) return { leftOut: "entered as LaTeX or a sequence (our parser and session)" };
  const s = c.settings ?? {};
  if (Object.keys(s).some((k) => k !== "digits")) return { leftOut: "angle mode or other setting (our layer)" };
  if (OUR_NAMES.test(c.input)) return { leftOut: "uses our definitions (ENGINE_DEFINITIONS, pas…)" };
  if (c.budgetMs !== undefined || /size guard|time guard/.test(c.note ?? "")) return { leftOut: "size or time guard (our layer)" };
  if (c.oracle === `F('${c.input}')`) return { leftOut: "rounding text (our layer)" }; // the oracle is the typed input: only our display rounding is tested
  if (explicitPrecision(c.input)) return { leftOut: "approx or evalf with an explicit precision (Home's rewrite, G91)" };
  if (c.mark === "⚠" && /(?<![A-Za-z_0-9])int\(/.test(c.input)) return { leftOut: "shown value from Home's numeric integration (G90), not Giac's answer" };
  // G111: Home shows the double of a function with no MPFR path (igamma), which Giac keeps unevaluated at Digits 40
  if (c.id.startsWith("g111-") && c.mark === "⚠" && /no MPFR path/.test(c.note ?? "")) return { leftOut: "a double of a function with no MPFR path (Home's value, G111)" };
  if (CANCELS_IDS.has(c.id)) return { leftOut: "an exact answer whose evalf at Digits 40 cancels a large k*pi (Home raises the precision, G122)" };
  if (c.expect === undefined) return { leftOut: "mark only (no value)" };
  if (partsOf(c.expect) === null) return { leftOut: "not a number (refusal, text, list or truth value)" };
  const digits = file === "home.yaml" ? 12 : (s.digits ?? 12); // the home stage evaluates at 12 digits whatever settings.digits says
  const P = Math.max(40, digits + 10);
  return {
    comment: `// ${c.id} (${file}, ${c.source})`,
    line: `Digits:=${P}:; pc("${c.id}",\'(${toExactLiterals(c.input)})\',${expectedExact(c.expect)},${halfUnit(c.expect, digits)});`,
  };
}

// Giac's value must be within the tolerance of the expected one (G113: an MPFR NaN, printed undef, is both <= and > tol, so both are tested;
// G118: another NaN, from abs(evalf(acos(pi)^2-e)) on stock at Digits 40, is <= tol and not > tol, so a difference that prints undef never passes); a failing line is printed, the count comes last.
const PREAMBLE = [
  'pasn:=0:; pasfail:=0:;',
  'pc(id,v,e,tol):={ local d,g,ok; pasn:=pasn+1; ok:=0; try { g:=eval(v); d:=abs(evalf(g-e)); if (d<=tol && string(d)!="undef") { if (d>tol) { ok:=0; } else { ok:=1; } } } catch (err) { ok:=0; } if (ok==0) { pasfail:=pasfail+1; print("FAIL "+id); return 0; } return 1; }:;',
];

// Cases Giac gets wrong today, found by running pascaline-check.cas on the pin (giac_2.1.0-1). The first rule that matches an
// id gives the line in the known file its reason: the workaround register row (engine/giac/patches/README.md) and the
// backlog package. A rule that matches a case Giac gets right is reported by the run (a known line that passes); a failing case no rule
// matches stays in the check file, and the run reports it. Only the ids of KNOWN_IDS are known lines.
export const KNOWN_RULES = [
  [/^(g47-)?(prec-g44f?\d?-)?(prec-2-)?(normald|student|chisquare|fisher)_icdf|^prec-g44f?\d?-(normald|student|chisquare|fisher)_icdf|^g47-normald_icdf/, "register row icdf-double (G44): the inverse distribution functions return a double at any Digits (or +infinity far in a tail)"],
  [/^prec-g44f1-(evalf-)?erf-|^prec-g44f1-(evalf-)?erfc|^prec-3-UTPN/, "register row erfc-as-1-erf (G44f1): erfc is 1-erf and cancels, a small erf argument returns the argument"],
  [/sin1e(50|60|70|100)|sin-1e100|^prec-G23/, "register row sign-at-digits (G38, G57): sin of 10^k at Digits 40 has too few digits of the argument reduction, so floor, trunc, sign and arg of it are wrong"],
  [/atan\(2i\)/, "register row atan-cut (G50, G60): complex atan beyond ±i takes the other side of its cut"],
  [/^g129-/, "register row atan-cut (G50, G60, G129): complex atan beyond ±i takes the other side of its cut, and Giac's exact cos(atan(z)) on the cut does too"],
  [/Bessel|Airy|besselj/, "register row no-mpfr-path (G4, G50): no MPFR path, an error at Digits above 14"],
  [/^prec-4-romberg/, "register row no-mpfr-path (G4, G50): romberg works in a double, 30 digits asked"],
];
// The ids Giac fails on the pin (run.mjs: every line of the known file fails).
export const KNOWN_IDS = new Set([
  "g38-floor-sin1e60",
  "prec-2-normald_icdf-value",
  "prec-g44-normald_icdf-0.025-30",
  "prec-g44-normald_icdf-1e-10-30",
  "prec-g44-normald_icdf-1-1e-12-12",
  "prec-g44-normald_icdf-1-1e-12-30",
  "prec-g44-student_icdf-5-0.975-30",
  "prec-g44-chisquare_icdf-3-0.95-30",
  "prec-g44-fisher_icdf-2-5-0.99-30",
  "prec-g44-normald_icdf-median-1e-30",
  "prec-g44-student_icdf-median-1e-30",
  "prec-g44-normald_icdf-1e-300",
  "prec-g44-chisquare_icdf-3-1e-30",
  "prec-g44-fisher_icdf-3-4-1e-20",
  "prec-g44f1-erf-1e-12-12",
  "prec-g44f1-erf-1e-12-30",
  "prec-g44f1-erfc10-12",
  "prec-g44f1-erfc10-30",
  "prec-g44f1-evalf-erf-1e-12-12",
  "prec-g44f1-evalf-erf-1e-12-30",
  "prec-g44f1-evalf-erfc10-12",
  "prec-g44f1-evalf-erfc10-30",
  "prec-g44f1-fisher_icdf-3-4-1-1e-20-12",
  "prec-g44f1-fisher_icdf-3-4-1-1e-20-30",
  "prec-g44f2-chisquare_icdf-3-1-1e-30-12",
  "prec-g44f2-chisquare_icdf-3-1-1e-30-30",
  "prec-3-UTPN-30",
  "prec-4-romberg-30",
  "prec-5-BesselJ(1,2)-12",
  "prec-5-Airy_Ai(1)-12",
  "prec-5-BesselJ(0,100)-12",
  "prec-G23-sin-1e100",
  "prec-g50-atan(2i)-12",
  "prec-g50-atan(2i)-30",
  // G129: the guards g129-sin-atan-*, g129-cos-atan-i/2 and g129-cos-atan-1+i pass on stock and stay in the check file
  "g129-asin-cos-atan-2i",
  "g129-cos-atan-2i",
  "g129-cos-atan-3i",
  "g129-cos-atan-neg2i",
  "g129-cos-atan-2.0i",
  "g129-atan-2i",
  "g129-atan-2i-plus-0",
  "g71-trunc-sin1e70",
  "g71-heaviside-sin1e70",
  "g71-round-besselj-1e12",
  "g71-floor-besselj-1e12",
  "g71-round-besselj",
  "g71-sign-besselj-half",
  "g71-max-besselj",
  "g71-census-arg-sin1e70",
  "g71-census-norm-sin1e70",
  "g71-census-normalize-sin1e70",
  "g71-census-tri-sin1e70",
]);
// The ids that pass on our patched build and fail on stock giac_2.1.0-1 (found by matching the cases the tests and canaries of patches
// 0003 and 0005 name (tanh-test.ts, mpfr-pi-test.ts, patch-canary.ts) and the ids of G75 and G60; G111's g111-* of patch 0007; G113's g113-* of patch 0009 (g113-poisson_cdf-2.5 passes on stock, a guard in the check file); G113f1's ties of patch 0010; G115's g115-* of patch 0011; G118's g118-* of patch 0012; G121's g116-* and g121-* and G125's g125-* of patch 0013; G122's g122-* of patch 0014; G126's g126-* and g116-acos-neg-1e20-half-12 of patch 0015. Each id was run on the stock build (engine/giac/_out/release) and fails there; ln(-pi)-30 passes on stock at these Digits, so it stays in the check file; the g60-f5 and g78-novalue lines seemed to pass on stock until G118 (their difference is an MPFR NaN, printed undef, that pc() took for a pass). g58-acos-5!^(2.5+5!)-30 has budgetMs, so it is left out as a time guard): [id, the patch file the line rests on]. They go to pascaline-patched.cas, not to the check file.
export const PATCHED_IDS = new Map([
  ["prec-g50-tanh(i)-12", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(i)-30", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(i/2)-12", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(i/2)-30", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-evalf-tanh(i)", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-evalf-tanh-list", "0003-complex-tanh-mpfr.patch"],
  ["g75-tanh(i)-50", "0003-complex-tanh-mpfr.patch"],
  ["g75-tanh(1+i)-12", "0003-complex-tanh-mpfr.patch"],
  ["g75-tanh(1+i)-30", "0003-complex-tanh-mpfr.patch"],
  ["g75-tanh(1+i)-50", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(1/2+i/3)-12", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(1/2+i/3)-30", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(-2-3i)-12", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-tanh(-2-3i)-30", "0003-complex-tanh-mpfr.patch"],
  ["prec-g50-evalf-acos-list-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f4-log10-asinh-asin-e-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f6-sqrt-asinh-cos10-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f6-sqrt-asinh-log10-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-acosh(-pi)-12", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-acosh(-pi)-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["prec-g50-acos(1+i)-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["prec-g50-acos(3-i/2)-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["prec-g50-acos(-1+i)-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g59f1-neg-base-imag-power-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g59f1-neg-base-asin-power-30", "0005-mpfr-pi-and-real-domains.patch"],
  // G118: stock asin and acos of an MPFR real outside [-1,1] are NaN (undef), which pc() passed before it refused undef
  ["g60-f5-cosh-acos-pi-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f5-asin-sinh-pi-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f5-asin-12-acos-pi-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f5-acos-sin1-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g60-f5-sinh-asin-pi-30", "0005-mpfr-pi-and-real-domains.patch"],
  ["g78-novalue-asin-acos", "0005-mpfr-pi-and-real-domains.patch"],
  ["g78-novalue-exp-cosh-asin", "0005-mpfr-pi-and-real-domains.patch"],
  ["g78-novalue-asin-pow", "0005-mpfr-pi-and-real-domains.patch"],
  ["g118-abs-acos-pi-4-30", "0005-mpfr-pi-and-real-domains.patch"],
  // G111: home.yaml's densities and cdfs outside their support (stock giac_2.1.0-1 gives the formula's value)
  ["g111-exponential", "0007-densities-outside-support.patch"],
  ["g111-exponential-cdf", "0007-densities-outside-support.patch"],
  ["g111-chisquare", "0007-densities-outside-support.patch"],
  ["g111-exponential-cdf-2bounds-below", "0007-densities-outside-support.patch"],
  ["g111-chisquare-3", "0007-densities-outside-support.patch"],
  ["g111-betad-below", "0007-densities-outside-support.patch"],
  ["g111-betad-above", "0007-densities-outside-support.patch"],
  ["g111-gammad", "0007-densities-outside-support.patch"],
  ["g111-gammad-cdf", "0007-densities-outside-support.patch"],
  ["g111-weibull", "0007-densities-outside-support.patch"],
  ["g111-weibull-theta", "0007-densities-outside-support.patch"],
  ["g111-weibull-cdf", "0007-densities-outside-support.patch"],
  ["g111-uniform-below", "0007-densities-outside-support.patch"],
  ["g111-uniform-above", "0007-densities-outside-support.patch"],
  ["g111-uniform-cdf-below", "0007-densities-outside-support.patch"],
  ["g111-negbinomial", "0007-densities-outside-support.patch"],
  ["g111-negbinomial-cdf", "0007-densities-outside-support.patch"],
  ["g111-exponential-cdf-2bounds", "0007-densities-outside-support.patch"],
  ["g111-weibull-cdf-2bounds", "0007-densities-outside-support.patch"],
  ["g111-uniform-cdf-above", "0007-densities-outside-support.patch"],
  ["g111-uniform-cdf-2bounds", "0007-densities-outside-support.patch"],
  ["g111-negbinomial-cdf-2bounds", "0007-densities-outside-support.patch"],
  ["g111-weibull-list", "0007-densities-outside-support.patch"],
  ["g111-gammad-list", "0007-densities-outside-support.patch"],
  ["g111-betad-list", "0007-densities-outside-support.patch"],
  ["g111-uniform-cdf-list", "0007-densities-outside-support.patch"],
  ["g111-exponential-cdf-list", "0007-densities-outside-support.patch"],
  // G113: precision.yaml's pmfs off the integers, cdfs at the floor, negbinomial_icdf of an exact probability (stock: the formula, 0)
  ["g113-poisson-1.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric-1.5", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial-1.5", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial-2.5", "0009-pmf-integer-support.patch"],
  ["g113-poisson-neg0.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric-neg0.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric-0", "0009-pmf-integer-support.patch"],
  ["g113-geometric_cdf-1.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric_cdf-2.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric_cdf-neg0.5", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_cdf-1.5", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_cdf-2.5", "0009-pmf-integer-support.patch"],
  ["g113-poisson_cdf-neg0.5", "0009-pmf-integer-support.patch"],
  ["g113-poisson_cdf-2bounds-1.5", "0009-pmf-integer-support.patch"],
  ["g113-geometric_cdf-2bounds-1.5", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_cdf-2bounds", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_cdf-2bounds-frac", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_icdf-exact", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_icdf-decimal", "0009-pmf-integer-support.patch"],
  ["g113-negbinomial_icdf-0.7", "0009-pmf-integer-support.patch"],
  // G113f1: negbinomial_icdf at an exact tie (patch 0009: one step high). g113f1-negbinomial_icdf-tie-0 passes on stock by accident (stock reads the
  // double field of the exact 1/27 as 0, and t <= 0 gives 0): it stays in the check file
  ["g113f1-negbinomial_icdf-tie-1", "0010-negbinomial-icdf-exact.patch"],
  ["g113f1-negbinomial_icdf-tie-2", "0010-negbinomial-icdf-exact.patch"],
  // stock gives 0 for this non-tie too (G118 run on engine/giac/_out/release: it reads the double field of the exact 11/81, patch 0009's cause)
  ["g113f1-negbinomial_icdf-between", "0009-pmf-integer-support.patch"],
  // G115: atan of an argument near 1 (stock: pi/4); the guard g115-atan-2-sqrt3-30 passes on stock and stays in the check file
  ["g115-atan-cos-pi/1e5-12", "0011-atan-pi12-exact-check.patch"],
  ["g115-atan-cos-pi/1e5-30", "0011-atan-pi12-exact-check.patch"],
  ["g115-atan-cos-pi/1e8-30", "0011-atan-pi12-exact-check.patch"],
  ["g115-atan-sin-pi/2-pi/1e5-30", "0011-atan-pi12-exact-check.patch"],
  ["g115-atan-1-1e-9-30", "0011-atan-pi12-exact-check.patch"],
  ["g115-atan-1+1e-10-30", "0011-atan-pi12-exact-check.patch"],
  // G118: abs(b)^n of a b with a complex value and no literal i (stock: b^n, the sign of acos(pi)^2); the guards
  // g118-abs-asin2-4-30, g118-abs-1+i-sq, g118-abs-neg2-sq and g118-abs-pi-sq pass on stock and stay in the check file
  ["g118-abs-acos-pi-sq-12", "0012-abs-power-real-base.patch"],
  ["g118-abs-acos-pi-sq-30", "0012-abs-power-real-base.patch"],
  ["g118-abs-acos-pi-6-12", "0012-abs-power-real-base.patch"],
  ["g118-abs-acos-pi-3-12", "0012-abs-power-real-base.patch"],
  ["g118-abs-of-acos-pi-sq-12", "0012-abs-power-real-base.patch"],
  // G121: asin(sin(z)), acos(cos(z)), atan(tan(z)) and ln(a^b) of a complex z, b (stock: Giac's real-argument rules, i*pi-z, z-i*pi and
  // b*ln(a)); the guards g121-ln-2^(1+i)-12, g121-ln-neg-pi^(3/2)-12, g121-asin-sin-2-12, g121-asin-sin-neg3-12, g121-acos-cos-4-12,
  // g121-asin-sin-sqrt-neg2-12, g121-asin-sin-1+i-sqrt2-12, g121-atan-tan-2i-12, g121-atan-tan-1+i-12 and g121-atan-tan-2-12 pass on stock
  // and stay in the check file
  ["g116-asin-sin-sqrt-neg-pi-30", "0013-asin-ln-real-rules.patch"],
  ["g116-acos-cos-ln-neg-pi-30", "0013-asin-ln-real-rules.patch"],
  ["g116-ln-2^(10i)-12", "0013-asin-ln-real-rules.patch"],
  ["g121-acos-cos-sqrt-neg2-12", "0013-asin-ln-real-rules.patch"],
  ["g121-asin-cos-2i-12", "0013-asin-ln-real-rules.patch"],
  ["g121-ln-2^(10i)-30", "0013-asin-ln-real-rules.patch"],
  ["g121-ln-2^(-7i)-12", "0013-asin-ln-real-rules.patch"],
  ["g116-asin-sin-2i-12", "0013-asin-ln-real-rules.patch"],
  ["g121-acos-cos-2i-12", "0013-asin-ln-real-rules.patch"],
  ["g121-atan-tan-4i-12", "0013-asin-ln-real-rules.patch"],
  ["g121-atan-tan-neg3+4i-12", "0013-asin-ln-real-rules.patch"],
  // G125: asin/acos of sin/cos of a complex w that patch 0013 already covers (stock: the real-w rules, F112's 0.148*i); the guard
  // g125-asin-cos-1/3-12 passes on stock and stays in the check file
  ["g125-asin-cos-asin10-12", "0013-asin-ln-real-rules.patch"],
  ["g125-asin-cos-asin10-30", "0013-asin-ln-real-rules.patch"],
  ["g125-asin-cos-asin-neg3-12", "0013-asin-ln-real-rules.patch"],
  ["g125-acos-cos-acos10-12", "0013-asin-ln-real-rules.patch"],
  ["g125-asin-sin-ln-neg2-12", "0013-asin-ln-real-rules.patch"],
  ["g125-acos-sin-neg1-2i-12", "0013-asin-ln-real-rules.patch"],
  ["g125-acos-cos-2+3i-12", "0013-asin-ln-real-rules.patch"],
  // G122: asin(sin(a)) with a large n = round(a/pi) (stock: the odd branch for an even n past 32 bits, n from a at Digits 40); the DEG cases
  // g122-deg-* are left out (angle mode), the CAS guards g122-cas-* too (CAS view), and the CANCELS_IDS
  ["g122-asin-cos-20!-12", "0014-asin-big-reduction.patch"],
  ["g122-acos-sin-20!-12", "0014-asin-big-reduction.patch"],
  ["g122-asin-sin-20!-12", "0014-asin-big-reduction.patch"],
  ["g122-acos-cos-20!-12", "0014-asin-big-reduction.patch"],
  ["g122-asin-sin-1e20-12", "0014-asin-big-reduction.patch"],
  // G126: asin, acos and asinh of a large argument on the cancelling side of their ln forms (stock: 20 to all digits lost, or
  // undef where the sum is an exact 0); the guards g126-asin-neg-1e20-12, g126-acos-*-1e20/1e300, g126-acosh-*, g126-atanh-*
  // and the small arguments pass on stock and stay in the check file
  ["g116-acos-neg-1e20-half-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-acos-neg-1e20-half-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asin-neg-1e20-half-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asin-neg-1e20-half-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg-1e300-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg-1e300-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg-1e1250-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg-1e1250-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asin-tan2-1e5040-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asin-tan2-1e5040-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asin-neg3+1e20i-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg1e20+i-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-neg-1e20-30", "0015-asin-asinh-ln-cancellation.patch"],
  // a part below the double range (stock: Giac's complex float x*x and sqrt lose its sign, the root takes the other side of its cut)
  ["g126-acos-neg-1e20-tiny-i-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-acos-neg-1e20-tiny-i-30", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-tiny-neg-1e20i-12", "0015-asin-asinh-ln-cancellation.patch"],
  ["g126-asinh-tiny-neg-1e20i-30", "0015-asin-asinh-ln-cancellation.patch"],
]);
// G122: Giac's exact answer is right (patch 0014), but pc()'s evalf of it at Digits 40 cancels the digits of a large k*pi
// (asin(cos(30!)) = -pi/2+30!-k*pi with k of 32 digits keeps about 7, -pi/2+10^50-k*pi none); Home raises the precision
// until the digits agree, so the golden gate checks these cases and the regression file leaves them out. G126: the same for
// 10^70-n*pi and 10^100-n*pi (an exact 0 at Digits 40), exp(10^-70)-1 (0 at Digits 40) and asinh(-10^-20) at 30 digits
// (ln(x+sqrt(x^2+1)) keeps about 20 of them at Digits 40).
export const CANCELS_IDS = new Set([
  "g116-asin-cos-30!-12",
  "g122-asin-cos-1e50-12",
  "g122-acos-sin-1e50-12",
  "g122-asin-sin-1e50-12",
  "g122-acos-cos-1e50-12",
  "g122-asin-cos-1e50-30",
  "g122-acos-sin-1e20-30",
  "g126-asin-sin-1e70-12",
  "g126-asin-sin-1e70-30",
  "g126-asin-sin-1e100-12",
  "g126-asin-sin-1e100-30",
  "prec-zero-cancel",
  "g126-asinh-neg-1e-20-30",
]);
export const knownReason = (id) => (KNOWN_IDS.has(id) ? KNOWN_RULES.find(([re]) => re.test(id))?.[1] : undefined);

function header(title) {
  return [
    "// SPDX-License-Identifier: GPL-3.0-or-later",
    `// ${title}`,
    "// Generated by tools/giac-regress/export.mjs from tests/golden/home.yaml and precision.yaml (Pascaline, GPL-3.0-or-later).",
    "// Each line: Giac's value of the input (typed decimals as exact rationals, Digits 40 or more) against the expected value",
    "// within half a unit of its last digit. Expected values: mpmath (oracle) or by hand (derived); see the comment above a line.",
  ];
}

export function build(cases) {
  const check = [...header("Pascaline regression cases that hold on Giac: every line must pass."), ...PREAMBLE];
  const known = [...header("Pascaline cases Giac gets wrong today: every line must fail (each is a bug report)."), ...PREAMBLE];
  const leftOut = {};
  let nCheck = 0;
  let nKnown = 0;
  let nPatched = 0;
  const patched = [...header("Pascaline cases that fail on stock giac_2.1.0-1 and pass with our patches: every line must pass on our build."), ...PREAMBLE];
  for (const [file, c] of cases) {
    const r = caseLine(c, file);
    if ("leftOut" in r) {
      leftOut[r.leftOut] = (leftOut[r.leftOut] ?? 0) + 1;
    } else if (PATCHED_IDS.has(c.id)) {
      patched.push(`// patch ${PATCHED_IDS.get(c.id)}`, r.comment, r.line);
      nPatched++;
    } else if (knownReason(c.id)) {
      known.push(`${r.comment}: ${knownReason(c.id)}`, r.line);
      nKnown++;
    } else {
      check.push(r.comment, r.line);
      nCheck++;
    }
  }
  // Patch 0006 (G96), tests/golden/bench.yaml g96-cas-im-2sqrt: im(2*sqrt(x)) with x free is 2*im(sqrt(x)); at x=-1 it is 2 (stock Giac: 0).
  patched.push("// patch 0006-reim-root-of-unknown-sign.patch", "// g96-cas-im-2sqrt (bench.yaml, derived)", 'Digits:=40:; pc("g96-cas-im-2sqrt",\'subst(im(2*sqrt(x)),x,-1)\',2,1/10^30);');
  nPatched++;
  check.push('print("pascaline-check: "+pasfail+" of "+pasn+" failed");');
  known.push('print("pascaline-known: "+pasfail+" of "+pasn+" failed (all must fail)");');
  patched.push('print("pascaline-patched: "+pasfail+" of "+pasn+" failed (none may fail on our patched build)");');
  return { check: check.join("\n") + "\n", known: known.join("\n") + "\n", patched: patched.join("\n") + "\n", nCheck, nKnown, nPatched, leftOut };
}

export function loadCases() {
  const golden = new URL("../../tests/golden/", import.meta.url);
  const out = [];
  for (const file of ["home.yaml", "precision.yaml"]) {
    const doc = YAML.parse(readFileSync(new URL(file, golden), "utf8"));
    for (const c of doc.cases) out.push([file, c]);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cases = loadCases();
  const r = build(cases);
  writeFileSync(new URL("pascaline-check.cas", here), r.check);
  writeFileSync(new URL("pascaline-known.cas", here), r.known);
  writeFileSync(new URL("pascaline-patched.cas", here), r.patched);
  const left = Object.entries(r.leftOut);
  console.log(`cases ${cases.length}: exported ${r.nCheck + r.nKnown} (check ${r.nCheck}, known ${r.nKnown}, patched ${r.nPatched}), left out ${left.reduce((a, [, n]) => a + n, 0)}`);
  for (const [why, n] of left) console.log(`  left out ${n}: ${why}`);
}
