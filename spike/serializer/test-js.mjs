// SPDX-License-Identifier: GPL-3.0-or-later
// Plot-function compiler test: LaTeX -> JS (emit-js.ts) against hand-written JS reference functions, plus speed.
//   node spike/serializer/test-js.mjs
import { toFn, latexToJs } from "../../app/src/input/emit-js.ts";

const cases = [
  ["\\sin\\left(x\\right)", (x) => Math.sin(x)],
  ["x^3-2x", (x) => x ** 3 - 2 * x],
  ["\\frac{1}{x}", (x) => 1 / x],
  ["\\frac12x^2", (x) => 0.5 * x * x],
  ["2\\sin x\\cos x", (x) => 2 * Math.sin(x) * Math.cos(x)],
  ["\\sqrt{x}", (x) => Math.sqrt(x)],
  ["\\sqrt[3]{x}", (x) => Math.pow(x, 1 / 3)],
  ["\\ln\\left(x\\right)", (x) => Math.log(x)],
  ["\\log\\left(x\\right)", (x) => Math.log10(x)],
  ["\\exponentialE^{-x^2}", (x) => Math.exp(-(x * x))],
  ["e^x", (x) => Math.exp(x)],
  ["\\left|x\\right|-1", (x) => Math.abs(x) - 1],
  ["\\pi x", (x) => Math.PI * x],
  ["-x^2+3", (x) => -(x * x) + 3],
  ["\\tan x", (x) => Math.tan(x)],
  ["\\frac{\\sin x}{x}", (x) => Math.sin(x) / x],
  ["2^x", (x) => 2 ** x],
  ["x\\sin x", (x) => x * Math.sin(x)],
  ["\\sin^{2}x", (x) => Math.sin(x) ** 2],
  ["\\arctan x", (x) => Math.atan(x)],
  ["\\sin\\left(30^\\circ\\right)x", (x) => Math.sin((30 * Math.PI) / 180) * x],
];
const xs = [-3.7, -2, -1, -0.5, 0, 0.001, 0.5, 1, 2, 3.3, 10];
let bad = 0;
for (const [latex, ref] of cases) {
  const f = toFn(latex);
  for (const x of xs) {
    const a = f(x);
    const b = ref(x);
    const ok = (Number.isNaN(a) && Number.isNaN(b)) || a === b || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
    if (!ok) {
      bad++;
      console.log(`MISMATCH ${latex} at x=${x}: got ${a}, want ${b}`);
    }
  }
}
for (const bad1 of ["\\int x\\,dx", "y+1", "\\begin{pmatrix}1\\end{pmatrix}", "z"]) {
  try {
    toFn(bad1);
    bad++;
    console.log(`should have thrown: ${bad1}`);
  } catch {
    /* expected: not plottable */
  }
}
console.log(`${cases.length} functions x ${xs.length} points, ${bad} problems`);
console.log("source example:", latexToJs("\\frac{1}{2}x^2+\\sin x"));

// speed: 1000 calls per redraw, many redraws
const f = toFn("x^3-2x");
const g = (x) => x ** 3 - 2 * x;
const run = (fn) => {
  const t = performance.now();
  let s = 0;
  for (let r = 0; r < 2000; r++) for (let i = 0; i < 1000; i++) s += fn(-5 + i * 0.01);
  return [performance.now() - t, s];
};
run(f); run(g);
const [tf] = run(f);
const [tg] = run(g);
console.log(`2M calls: compiled ${tf.toFixed(1)} ms, hand-written ${tg.toFixed(1)} ms`);
process.exit(bad ? 1 : 0);
