// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G28, F28): does a CAS result depend on a stored x:=3? Each command runs with x free, then after Home x:=3.
// A command whose two results are equal quotes its variable (or does not read x): its name is not a used value.
//   node tools/probes/bound.ts [extra inputs...]
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";

const inputs = [
  "diff(x^2,x)", "diff(x^3,x,2)", "int(x^2,x)", "int(x^2,x,0,1)", "integrate(x^2,x)", "romberg(x^2,x,0,1)",
  "solve(x^2=4,x)", "csolve(x^2=-4,x)", "fsolve(x^2=4,x,1)", "fsolve(cos(x)=x,x,0)", "desolve(y'=x,x,y)", "proot(x^2-4)",
  "limit(sin(x)/x,x,0)", "series(sin(x),x=0,5)", "taylor(sin(x),x,0,5)", "sum(x,x,1,4)", "sum(x^2,x,1,n)", "product(x,x,1,4)", "seq(x^2,x,1,3)",
  "f(x):=x^2", "x->x^2", "g:=x->x^2+1", "factor(x^2-1)", "expand((x+1)^2)", "simplify(x^2-x^2+x)", "partfrac(1/(x^2-1),x)",
  "coeff(x^2+3x,x,1)", "degree(x^3+x,x)", "lcoeff(2x^2+1,x)", "fMin(x^2,x)", "fMax(-x^2,x)", "extrema(x^2,x)", "tangent(x^2,x,1)",
  "laplace(x,x,s)", "ilaplace(1/s^2,s,x)", "ztrans(x,x,z)", "deriv(x^2,x)", "linsolve([x+y=1,x-y=0],[x,y])", "solve([x+y=1,x-y=0],[x,y])",
  "normal(x^2-x^2+x)", "texpand(sin(2x))", "evalf(x+1)", "approx(x+1)", "subst(x^2,x=2)", "x:=x+1", "x+1",
];
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const run = (s: string): string => {
  const r = host.cas(s, { ...defaultCasSettings }).result;
  return r.ok ? r.text : `ERR ${r.text}`;
};
const list = [...inputs, ...process.argv.slice(2)];
const free = list.map((s) => (s === "x:=x+1" ? "(skipped)" : run(s)));
host.home("x:=3", { ...defaultHomeSettings, workDigits: 30 });
list.forEach((s, i) => {
  const t = s === "x:=x+1" ? "(skipped)" : run(s);
  console.log(`${t === free[i] ? "QUOTES/IGNORES" : "DEPENDS      "} ${s.padEnd(34)} free: ${free[i]}   stored: ${t}`);
});
host.home("x:=3", { ...defaultHomeSettings, workDigits: 30 });
console.log("x:=x+1 ->", run("x:=x+1"));
