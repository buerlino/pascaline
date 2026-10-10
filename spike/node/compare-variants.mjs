// SPDX-License-Identifier: GPL-3.0-or-later
// Compare Giac outputs between two engine variants (default: base vs gsl) on the benchmark set
// plus numeric inputs where Giac may route through GSL when it is linked.
import { readFileSync } from "node:fs";
import { parse } from "../app/node_modules/yaml/dist/index.js";

const [a = "base", b = "gsl"] = process.argv.slice(2);
const cases = parse(readFileSync(new URL("../bench/cases.yaml", import.meta.url), "utf8")).cases.map((c) => c.input);
cases.push(
  "Gamma(0.5)", "Gamma(2.5+i)", "Zeta(3.0)", "erf(0.5)", "Beta(2.5,1.5)", "Psi(1.5)",
  "evalf(BesselJ(1,2.5))", "evalf(Airy_Ai(1))", "eigenvals(evalf([[2,1,0],[1,3,1],[0,1,4]]))",
  "eigenvects(evalf([[2,1],[1,3]]))", "svd(evalf([[1,2],[3,4]]))", "int(exp(-x^2)*cos(x),x,0,3.0)",
  "fsolve(cos(x)=x,x=0.5)", "fsolve(x^5-x-1,x=1)", "proot([1,-3,0,2,7])", "evalf(zeta(0.5+14*i))",
  "normald_icdf(0,1,0.975)", "studentd_cdf(5,2.0)", "chisquare_icdf(3,0.95)",
);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
async function run(variant) {
  const { default: create } = await import(`../../engine/giac/_out/${variant}/giac.mjs`);
  const M = await create({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  ev("Digits:=12");
  return cases.map((c) => ev(c));
}
const ra = await run(a), rb = await run(b);
let diff = 0;
cases.forEach((c, i) => {
  if (ra[i] !== rb[i]) { diff++; console.log(`DIFF ${c}\n  ${a}: ${ra[i]}\n  ${b}: ${rb[i]}`); }
});
console.log(`${cases.length} inputs, ${diff} differ (${a} vs ${b})`);
