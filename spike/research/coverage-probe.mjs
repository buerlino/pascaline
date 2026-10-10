// SPDX-License-Identifier: GPL-3.0-or-later
// Probe: what does our Giac wasm answer for typical engineering inputs? (research note R3)
// usage: GIAC_OUT=<dir with giac.mjs> node coverage-probe.mjs
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.GIAC_OUT ?? path.join(here, "../../engine/giac/_out/gsl");
const { default: create } = await import(pathToFileURL(path.join(out, "giac.mjs")).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await create({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const ev = M.cwrap("giac_eval", "string", ["string"]);

let groups = {
  "units and conversion": ["convert(5*_km,_m)", "convert(100*_km/_h,_m/_s)", "5*_ft+2*_in", "convert(1*_psi,_Pa)", "convert(25*_degC,_K)", "_c", "_g_", "_NA"],
  "constants": ["_c_", "_h_", "_qe_", "_mu0_", "_epsilon0_", "evalf(pi,15)", "evalf(exp(1),15)"],
  "complex and phasors": ["(3+4*i)*(1-2*i)", "abs(3+4*i)", "arg(3+4*i)", "polar_complex(3+4*i)", "evalf(abs(3+4*i)*exp(i*arg(3+4*i)))", "conj(3+4*i)", "re(1/(3+4*i))", "evalf(sqrt(-4))", "cpartfrac(1/(s^2+3*s+2))"],
  "number bases": ["convert(255,base,16)", "convert(255,base,2)", "0b1011+0x1F", "irem(255,16)", "binary_and(12,10)", "binary_xor(12,10)", "b2d(\"1011\")"],
  "matrices": ["det([[1,2],[3,4]])", "inv([[1,2],[3,4]])", "eigenvals([[2,1],[1,2]])", "eigenvects([[2,1],[1,2]])", "[[1,2],[3,4]]*[[5,6],[7,8]]", "rref([[1,2,3],[4,5,6]])", "linsolve([x+y=3,x-y=1],[x,y])", "lu([[4,3],[6,3]])", "svd([[1,2],[3,4]])"],
  "numeric solve": ["fsolve(x*exp(x)=5,x=1)", "fsolve(cos(x)=x,x=0,bisection_solver)", "fsolve([x^2+y^2=4,x*y=1],[x,y],[1,1])", "proot([1,-6,11,-6])", "solve(x^2-2=0,x)", "nSolve(x^2-2=0,x)"],
  "integration and calculus": ["int(sin(x)^2,x,0,pi)", "evalf(int(exp(-x^2),x,0,1))", "romberg(exp(-x^2),x,0,1)", "diff(x^3*sin(x),x)", "limit(sin(x)/x,x,0)", "series(exp(x),x=0,5)", "desolve(y'+y=0,y)", "laplace(exp(-t),t,s)", "ilaplace(1/(s+1),s,t)", "fourier(exp(-x^2),x,w)"],
  "statistics": ["mean([1,2,3,4,5])", "stddev([1,2,3,4,5])", "median([1,2,3,4,50])", "linear_regression([1,2,3,4],[2,4.1,5.9,8.2])", "normald_cdf(0,1,1.96)", "binomial(10,3,0.5)", "correlation([1,2,3,4],[2,4.1,5.9,8.2])", "polynomial_regression([1,2,3,4],[1,4,9,16],2)"],
  "finance and misc": ["round(2.34567,2)", "floor(-2.5)", "gcd(12,18)", "ifactor(360)", "binomial(5,2)", "factorial(20)", "fsolve(1000*(1+x)^10=1500,x=0.05)", "sum(1/k^2,k,1,100)", "evalf(sum(1/k^2,k,1,100))"],
};

if (process.argv.length > 2) groups = { "command line": process.argv.slice(2) };
for (const [g, list] of Object.entries(groups)) {
  console.log(`\n## ${g}`);
  for (const s of list) {
    let r;
    const t0 = performance.now();
    try { r = ev(s); } catch (e) { r = "EXCEPTION " + String(e).slice(0, 60); }
    console.log(`${s}  =>  ${String(r).replace(/\n/g, " ").slice(0, 110)}  (${(performance.now() - t0).toFixed(0)} ms)`);
  }
}
