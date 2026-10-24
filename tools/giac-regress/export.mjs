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
  if (c.expect === undefined) return { leftOut: "mark only (no value)" };
  if (partsOf(c.expect) === null) return { leftOut: "not a number (refusal, text, list or truth value)" };
  const digits = file === "home.yaml" ? 12 : (s.digits ?? 12); // the home stage evaluates at 12 digits whatever settings.digits says
  const P = Math.max(40, digits + 10);
  return {
    comment: `// ${c.id} (${file}, ${c.source})`,
    line: `Digits:=${P}:; pc("${c.id}",\'(${toExactLiterals(c.input)})\',${expectedExact(c.expect)},${halfUnit(c.expect, digits)});`,
  };
}

// Giac's value must be within the tolerance of the expected one; a failing line is printed, the count comes last.
const PREAMBLE = [
  'pasn:=0:; pasfail:=0:;',
  'pc(id,v,e,tol):={ local d,g,ok; pasn:=pasn+1; ok:=0; try { g:=eval(v); d:=abs(evalf(g-e)); if (d<=tol) { ok:=1; } } catch (err) { ok:=0; } if (ok==0) { pasfail:=pasfail+1; print("FAIL "+id); return 0; } return 1; }:;',
];

// Cases Giac gets wrong today, found by running pascaline-check.cas on the pin (giac_2.1.0-1). The first rule that matches an
// id gives the line in the known file its reason: the workaround register row (engine/giac/patches/README.md) and the
// backlog package. A rule that matches a case Giac gets right is reported by the run (a known line that passes); a failing case no rule
// matches stays in the check file, and the run reports it. Only the ids of KNOWN_IDS are known lines.
export const KNOWN_RULES = [
  [/^(g47-)?(prec-g44f?\d?-)?(prec-2-)?(normald|student|chisquare|fisher)_icdf|^prec-g44f?\d?-(normald|student|chisquare|fisher)_icdf|^g47-normald_icdf/, "register row icdf-double (G44): the inverse distribution functions return a double at any Digits (or +infinity far in a tail)"],
  [/^prec-g44f1-(evalf-)?erf-|^prec-g44f1-(evalf-)?erfc|^prec-3-UTPN/, "register row erfc-as-1-erf (G44f1): erfc is 1-erf and cancels, a small erf argument returns the argument"],
  [/sin1e(50|60|70|100)|sin-1e100|^prec-G23/, "register row sign-at-digits (G38, G57): sin of 10^k at Digits 40 has too few digits of the argument reduction, so floor, trunc, sign and arg of it are wrong"],
  [/^g90-int-asin/, "backlog F65, F67 (G90): the numeric integration of an integrand with a 1/sqrt(1-x^2) end point is right to 7 digits only"],
  [/atan\(2i\)/, "register row atan-cut (G50, G60): complex atan beyond ±i takes the other side of its cut"],
  [/Bessel|Airy|besselj/, "register row no-mpfr-path (G4, G50): no MPFR path, an error at Digits above 14"],
  [/^prec-4-romberg/, "register row no-mpfr-path (G4, G50): romberg works in a double, 30 digits asked"],
];
// The ids Giac fails on the pin (run.mjs: every line of the known file fails).
export const KNOWN_IDS = new Set([
  "g38-floor-sin1e60",
  "g90-int-asin-12x",
  "g90-int-asin-12x-neg",
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
// The ids that pass on our patched build and fail on stock giac_2.1.0-1 (found by running pascaline-check.cas on a build without
// patches 0003 and 0005): [id, the patch file the line rests on]. They go to pascaline-patched.cas, not to the check file.
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
