// SPDX-License-Identifier: GPL-3.0-or-later
// G111 regression test for patches 0007 (a density or cdf outside its support, backlog F95) and 0008 (fracmod's modulus,
// F91), on the raw engine. Before 0007, moyal.cc's densities and cdfs checked no support: exponential(21/10,-2) was
// 21/10*exp(21/5); with 0007 a value provably below the support (above it for betad and uniform) is an exact 0 (a cdf
// above it 1), an argument of unknown sign keeps today's form, and a list as x is one value per element. Before 0008,
// fracmod(41,-2) took the square root of a negative number in GMP (gen.cc in_fracmod) and trapped the wasm; with it the
// modulus must be a positive integer, and the engine answers the next input. Needs the engine build (GIAC_OUT or
// GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/support-test.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

// [input, Giac's text]. Outside the support: 0 (source: derived, the definition of a density and of a cdf).
const OUTSIDE: [string, string][] = [
  ["exponential(21/10,-2)", "0"],
  ["exponential_cdf(21/5,-2)", "0"],
  ["exponential_cdf(21/5,-2,-1)", "0"],
  ["chisquare(2,-2)", "0"],
  ["chisquare(3,-2)", "0"],
  ["betad(2,3,-1/2)", "0"],
  ["betad(2,3,3/2)", "0"],
  ["gammad(2,3,-1)", "0"],
  ["gammad_cdf(2,3,-1)", "0"],
  ["weibull(2,3,-1)", "0"],
  ["weibull(2,3,0,-1)", "0"],
  ["weibull_cdf(2,3,-1)", "0"],
  ["uniform(1,3,0)", "0"],
  ["uniformd(1,3,4)", "0"],
  ["uniform_cdf(1,3,0)", "0"],
  ["uniform_cdf(1,3,4)", "1"],
  ["negbinomial(3,1/2,-2)", "0"],
  ["negbinomial_cdf(3,1/2,-2)", "0"],
  ["exponential(2,-inf)", "0"],
];
// [input, Giac's text]: an argument of unknown sign keeps the formula, and inside the support nothing changes (source:
// derived: the stock build's text, which is the density's formula).
const KEPT: [string, string][] = [
  ["exponential(2,x)", "2*exp(-2*x)"],
  ["chisquare(2,x)", "exp(-x/2)/2"],
  ["exponential(2,1)", "2/exp(2)"],
  ["uniform(1,3,2)", "1/2"],
  ["betad(2,3,1/2)", "3/2"],
  ["gammad(1,3,0)", "3"],
  ["exponential_cdf(2,x,1)", "exp(-2*x)-1/exp(2)"],
];
// [input, Giac's text] (source: derived): a two-bound cdf takes the cdf below the support as 0, and a list as x gives one
// value per element: exponential_cdf(2,-1,1) = F(1) - 0; weibull(2,3,x) = 2x/9·exp(-x²/9) at x = 1, 2.
const BOUNDS_AND_LISTS: [string, string][] = [
  ["exponential_cdf(2,-1,1)", "1-exp(-2)"],
  ["uniform_cdf(1,3,0,2)", "1/2"],
  ["weibull(2,3,[1,2])", "[2/9*exp(-1/9),4/9*exp(-4/9)]"],
  ["exponential(2,[1,2])", "[2*exp(-2),2*exp(-4)]"],
];

const { giac } = await loadNodeGiac();
const failures: string[] = [];
// the difference simplifies to 0 (a list: to a list of zeros)
const same = (a: string, b: string): boolean => /^\[?0(,0)*\]?$/.test(giac.eval(`simplify((${a})-(${b}))`).trim());
for (const [input, want] of OUTSIDE) {
  const got = giac.eval(input);
  if (got !== want) failures.push(`${input} = ${got}, expected ${want}`);
}
for (const [input, want] of KEPT) {
  const got = giac.eval(input);
  if (got !== want) failures.push(`${input} = ${got}, expected ${want}`);
}
for (const [input, want] of BOUNDS_AND_LISTS) {
  const got = giac.eval(input);
  if (got.startsWith("GIAC_ERROR") || !same(got, want)) failures.push(`${input} = ${got}, expected ${want}`);
}
// 0008: refused, never a trap; the engine answers after it (a trap throws out of eval)
for (const input of ["fracmod(41,-2)", "fracmod(41,-1)", "fracmod(41,0)", "iratrecon(41,-3)"]) {
  let got: string;
  try {
    got = giac.eval(input);
  } catch (e) {
    failures.push(`${input} threw ${String(e).slice(0, 80)}`);
    break;
  }
  if (!got.startsWith("GIAC_ERROR")) failures.push(`${input} = ${got}, expected a refusal`);
}
if (!failures.some((f) => f.includes("threw"))) {
  const after = giac.eval("1+1");
  if (after !== "2") failures.push(`1+1 after fracmod = ${after}`);
  const kept = giac.eval("fracmod(3,13)");
  if (kept !== "-1/4") failures.push(`fracmod(3,13) = ${kept}, expected -1/4 (4·3 = 12 ≡ -1 mod 13)`);
}
if (failures.length) {
  console.log(`FAIL support-test ${failures.length}\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS support-test: ${OUTSIDE.length} values outside the support, ${KEPT.length} kept, ${BOUNDS_AND_LISTS.length} bounds and lists, fracmod refused without a trap`);
