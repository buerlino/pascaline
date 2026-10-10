// SPDX-License-Identifier: GPL-3.0-or-later
// Compare plot point evaluation: Compute Engine compile().run() vs ron's toFn (src/ron/*.ts, from night/ron-parser).
// usage: node --experimental-strip-types scripts/compare-compilers.mjs
import { compile } from "@cortex-js/compute-engine";
import { toFn as ronFn } from "../src/ron/emit-js.ts";

const FUNCS = ["\\sin(x)", "x^3-2x", "\\frac{1}{x}", "\\sqrt{x^2+1}\\cdot e^{-x}"];
const N = 2_000_000;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

function ceFn(latex) {
  const c = compile(latex, { strict: true });
  const v = { x: 0 };
  return (x) => { v.x = x; return Number(c.run(v)); };
}
function time(f) {
  const t = [];
  for (let r = 0; r < 5; r++) {
    let s = 0;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) s += f(((i % 2000) - 1000) / 100);
    t.push(performance.now() - t0);
    if (Number.isNaN(s) && r < 0) console.log("nan");
  }
  return median(t);
}
for (const f of FUNCS) {
  const t0 = performance.now(); const a = ceFn(f); const ceBuild = performance.now() - t0;
  const t1 = performance.now(); const b = ronFn(f); const ronBuild = performance.now() - t1;
  const worst = [-3.3, -1, 0.5, 2.7].map((x) => Math.abs(a(x) - b(x))).reduce((m, d) => Math.max(m, d), 0);
  console.log(`${f.padEnd(28)} CE ${(time(a) / N * 1e6).toFixed(1)} ns/call (compile ${ceBuild.toFixed(1)} ms) | ron ${(time(b) / N * 1e6).toFixed(1)} ns/call (compile ${ronBuild.toFixed(2)} ms) | max diff ${worst.toExponential(1)}`);
}
