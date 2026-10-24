// SPDX-License-Identifier: GPL-3.0-or-later
// G96 regression test for patch 0006 (re and im of a root of unknown sign): with x free, Giac's raw im() of an
// expression holding sqrt(x) must not be 0, and must give sin 1 at x = -1. Before the patch, gen.cc symb_reim took a
// non-integer power of a base of unknown sign as real (r=s, i=0): im(exp(sqrt(x))) was 0 and so was its value at x = -1,
// while im(sqrt(x)) alone stayed symbolic (symb_im asks sign()). A base of known sign keeps its answer. Needs the engine
// build (GIAC_OUT or GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/reim-test.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

// Inputs whose answer must not be 0 with x free (at x = -1 each has a non-zero imaginary part).
const NOT_ZERO = ["im(exp(sqrt(x)))", "im(2*sqrt(x))", "im(tanh(sqrt(x)))", "im(exp(x^(1/3)))", "im(1/(sqrt(x)+1))"];
// [input, Giac's text] where the base's sign is known, so the patch changes nothing (source: derived: sqrt of a
// positive base is real; im(sqrt(-3)*2) = 2*sqrt(3)).
const KEPT: [string, string][] = [
  ["im(2*sqrt(x^2+1))", "0"],
  ["re(2*sqrt(x^2+1))", "2*sqrt(x^2+1)"],
  ["im(2*sqrt(-3))", "2*sqrt(3)"],
];
// [input, mpmath's value at Digits 12] (source: oracle; mpmath sin(1), mp.dps 30, rounded to 12 digits).
const VALUES: [string, string][] = [["evalf(subst(im(exp(sqrt(x))),x=-1))", "0.841470984808"]];

const { giac } = await loadNodeGiac();
giac.eval("Digits:=12");
const failures: string[] = [];
for (const input of NOT_ZERO) {
  const got = giac.eval(input);
  if (got.trim() === "0") failures.push(`${input} = 0 with x free`);
}
for (const [input, want] of KEPT) {
  const got = giac.eval(input);
  if (got !== want) failures.push(`${input} = ${got}, expected ${want}`);
}
for (const [input, want] of VALUES) {
  const got = giac.eval(input);
  if (Math.abs(Number(got) - Number(want)) > 1e-11) failures.push(`${input} = ${got}, mpmath ${want}`);
}
if (failures.length) {
  console.log(`FAIL reim-test ${failures.length}\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS reim-test: ${NOT_ZERO.length} im() of a root of unknown sign kept, ${KEPT.length} known signs unchanged, sin 1 at x = -1`);
