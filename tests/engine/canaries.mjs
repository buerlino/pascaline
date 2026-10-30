// SPDX-License-Identifier: GPL-3.0-or-later
// S17 (P19, H5): the canaries of "Workarounds in our code" (engine/giac/patches/README.md). One row per Giac behaviour
// our TypeScript works around: each asserts, on the raw engine (plain giac_eval, as `MODE=raw node tools/probes/engine.ts`),
// that Giac still does it. A row that fails has FLIPPED: the next pin fixed the behaviour, and the workaround the row
// names may go (G77 reads this list). The patches' canaries (tests/engine/patch-canary.ts, the pinned tarball) run too,
// so one command says which patches and which workarounds a pin makes dead.
//   GIAC_OUT=<abs dir> node tests/engine/canaries.mjs     # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs (nodeGiac.ts)
// Values a row compares with come from mpmath (tests/golden/.venv, 40 digits), written next to the row.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

/** Significant digits of a printed float (`-6.3613403515334` → 14); 0 when `t` is no float. */
const sig = (t) => {
  const m = /^-?(\d*)\.(\d*)(?:e[+-]?\d+)?$/.exec(t.trim());
  return m ? (m[1] + m[2]).replace(/^0+/, "").length : 0;
};
const isError = (t) => t.startsWith("GIAC_ERROR");

// [canary, Giac's behaviour, Digits, inputs, the check on their outputs (true: Giac still does it)]
const ROWS = [
  ["atan-cut", "complex float atan beyond ±i takes the other side of its cut (mpmath atan(2i) = +1.5708+0.5493i; an exact 2*i is right since patch 0019)", 12,
    ["atan(2.0*i)"], ([a]) => /^-1\.5707963267\d*\+0\.5493061443\d*\*i$/.test(a)],
  ["irem-rational", "irem is an error on a rational", 12,
    ["irem(15/2,2)"], ([a]) => isError(a)],
  ["median-lower", "median of an even list is the lower middle, as a float (right 2.5)", 12,
    ["median([1,2,3,4])"], ([a]) => a === "2.0"],
  ["percentile-unevaluated", "percentile stays unevaluated", 12,
    ["percentile([1,2,3,4],50)"], ([a]) => a === "percentile([1,2,3,4],50)"],
  ["icdf-double", "the inverse distribution functions return a double at any Digits (normald_icdf(10^-10): mpmath -6.361340902404…, Giac -6.3613403515334)", 30,
    ["normald_icdf(10^-10)", "student_icdf(3,0.01)", "chisquare_icdf(3,0.01)", "fisher_icdf(3,4,0.01)"],
    (outs) => outs.every((o) => sig(o) > 0 && sig(o) <= 15)],
  ["erfc-as-1-erf", "erfc(u) is 1-erf(u), which cancels: evalf(erfc(10)) at Digits 30 is 0 (mpmath 2.0884875837625e-45), UTPN(10) prints with 1-erf", 30,
    ["evalf(erfc(10))", "UTPN(10)"], ([a, b]) => /^0\.0*$/.test(a) && b.includes("1-erf(")],
  ["sign-at-digits", "a sign is decided at Digits without a warning: sign(sin(10^50)) is 1 at Digits 12 (mpmath sin(10^50) = -0.78967…)", 12,
    ["sign(sin(10^50))"], ([a]) => a === "1"],
  ["tie-unproved", "simplify does not prove cos(pi/7)-cos(2*pi/7)+cos(3*pi/7) = 1/2", 12,
    ["simplify(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7))"], ([a]) => a === "4*cos(pi/7)^3-2*cos(pi/7)^2-2*cos(pi/7)+1"],
  ["divergent-number", "a number for what does not exist: int(1/x,x,-1,1) = 0 (principal value), sum(cos(k),k,1,inf) = -1/2 (Abel), limit(sin(x),x,inf) = bounded_function", 12,
    ["int(1/x,x,-1,1)", "evalf(sum(cos(k),k,1,inf))", "limit(sin(x),x,inf)"],
    ([a, b, c]) => a === "0" && b === "-0.5" && c.startsWith("bounded_function(")],
  ["round-double", "two-argument round works in a double whatever Digits is: round(10^17+1/3,2) = 1e+17 at Digits 30", 30,
    ["round(10^17+1/3,2)"], ([a]) => a === "1e+17"],
  ["no-mpfr-path", "functions without an MPFR path print a double where MPFR digits were asked (BesselJ at 40 digits)", 12,
    ["evalf(BesselJ(1,2),40)"], ([a]) => sig(a) > 0 && sig(a) <= 15],
  ["nonsquare-power", "^ and inv of a non-square matrix: [[5],[1]]^2 = 26 (v.v), inv([[5],[1]]) elementwise", 12,
    ["[[5],[1]]^2", "inv([[5],[1]])"], ([a, b]) => a === "26" && b === "[[1/5],[1]]"],
  ["list-plus-number", "a list plus a number is a polynomial: [1,4]+1 = poly1[1,5]", 12,
    ["[1,4]+1"], ([a]) => a === "poly1[1,5]"],
  ["list-as-arguments", "one list argument is the argument list: evalf(LambertW([1,2])) is W(1) on branch 2, hermite([1,2]) = hermite(1,2) = 4", 12,
    ["evalf(LambertW([1,2]))", "evalf(LambertW(1,2))", "hermite([1,2])"], ([a, b, c]) => a === b && a.includes("*i") && c === "4"],
  ["list-vector-ops", "a list squared or times a list is the dot product: [1,2]^2 = 5, [1,4]*[1,1] = 5", 12,
    ["[1,2]^2", "[1,4]*[1,1]"], ([a, b]) => a === "5" && b === "5"],
  ["extended-reals", "1/0 is infinity and a value through it is exact: 1/(1/0) = 0", 12,
    ["1/(1/0)"], ([a]) => a === "0"],
  ["underflow-zero", "a value past MPFR's exponent range evaluates to 0: evalf(exp(-10^30))", 30,
    ["evalf(exp(-10^30))"], ([a]) => /^0\.0*$/.test(a)],
  ["negative-zero-print", "a negative zero MPFR float prints as 0.-000…", 40,
    ["evalf(-0.0)"], ([a]) => a.startsWith("0.-0")],
  ["decimal-is-double", "a typed decimal is a binary double: 1-0.9-0.1 is not 0", 12,
    ["1-0.9-0.1"], ([a]) => a === "1.7763568394e-15"],
];

const { giac } = await loadNodeGiac();
const flipped = [];
for (const [id, says, digits, inputs, holds] of ROWS) {
  giac.eval(`Digits:=${digits}`);
  const outs = inputs.map((s) => giac.eval(s).trim());
  // An error (or an interrupt) is no proof that Giac still does it: only irem-rational expects one.
  const errs = id !== "irem-rational" && outs.some(isError);
  if (errs || !holds(outs)) {
    const probe = `MODE=raw node tools/probes/engine.ts 'Digits:=${digits}' ${inputs.map((s) => `'${s}'`).join(" ")}`;
    flipped.push(`${id}: ${says}\n      now: ${outs.join(" | ")}\n      probe: ${probe}`);
  }
}
giac.eval("Digits:=12");

const patches = spawnSync(process.execPath, [fileURLToPath(new URL("./patch-canary.ts", import.meta.url))], { encoding: "utf8", timeout: 120000 });
const patchLine = `${patches.stdout}${patches.stderr}`.trim();

console.log(patchLine);
if (flipped.length) {
  console.log(`FLIPPED ${flipped.length} of ${ROWS.length} workaround canaries (Giac no longer does it; the README row's workaround may go):\n  ${flipped.join("\n  ")}`);
}
if (flipped.length || patches.status !== 0) process.exit(1);
console.log(`PASS canaries: ${ROWS.length} workaround rows, Giac still does each`);
