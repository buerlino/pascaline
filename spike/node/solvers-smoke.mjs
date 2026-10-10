// SPDX-License-Identifier: GPL-3.0-or-later
// Q5: Boost.Math TOMS 748 and MINPACK hybrd1 linked into the Giac wasm, residuals evaluated by Giac.
const variant = process.env.VARIANT ?? "base-solvers";
const { default: createGiacModule } = await import(`../../engine/giac/_out/${variant}/giac.mjs`);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const evalS = M.cwrap("giac_eval", "string", ["string"]);
const solve1 = M.cwrap("pas_solve1", "string", ["string", "string", "number", "number"]);
const solveN = M.cwrap("pas_solve_n", "string", ["string", "string", "number", "number"]);
const t = (f) => { const a = performance.now(); const r = f(); return `${r} (${(performance.now() - a).toFixed(2)} ms)`; };
console.log("toms748 x^3-2 on [0,3]:", t(() => solve1("x^3-2", "x", 0, 3)));
console.log("toms748 x*exp(x)=5 on [0,2]:", t(() => solve1("x*exp(x)=5", "x", 0, 2)));
console.log("toms748 no sign change:", t(() => solve1("x^2+1", "x", 0, 3)));
evalS("k:=3");
console.log("toms748 uses user var k=3, x^2-k on [0,3]:", t(() => solve1("x^2-k", "x", 0, 3)));
const n = 2, p = M._malloc(8 * n);
M.HEAPF64.set([1, 1], p / 8);
console.log("hybrd1 [x^2+y^2=4,x=y] from [1,1]:", t(() => solveN("[x^2+y^2=4,x=y]", "[x,y]", p, n)), Array.from(M.HEAPF64.subarray(p / 8, p / 8 + n)));
M._free(p);
