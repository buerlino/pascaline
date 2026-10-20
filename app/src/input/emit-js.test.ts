// SPDX-License-Identifier: GPL-3.0-or-later
// Plot-function compiler: LaTeX -> JS (emit-js.ts) against hand-written JS reference functions.
import { describe, expect, it } from "vitest";
import { latexToJs, toFn } from "./emit-js.ts";

const cases: [string, (x: number) => number][] = [
  ["\\sin\\left(x\\right)", (x) => Math.sin(x)],
  ["x^3-2x", (x) => x ** 3 - 2 * x],
  ["\\frac{1}{x}", (x) => 1 / x],
  ["\\frac12x^2", (x) => 0.5 * x * x],
  ["2\\sin x\\cos x", (x) => 2 * Math.sin(x) * Math.cos(x)],
  ["\\sqrt{x}", (x) => Math.sqrt(x)],
  ["\\sqrt[3]{x}", (x) => Math.cbrt(x)], // L6: real odd roots for the root template (derived), also for x < 0
  ["\\sqrt[5]{x}", (x) => Math.sign(x) * Math.pow(Math.abs(x), 1 / 5)],
  ["\\sqrt[4]{x}", (x) => Math.pow(x, 1 / 4)],
  // P5 (b), R39: a power with a literal p/q exponent, q odd, is the real root, as in Home (derived)
  ["x^{1/3}", (x) => Math.cbrt(x)],
  ["x^{\\frac{2}{3}}", (x) => Math.cbrt(x) ** 2],
  ["x^{\\frac{1}{5}}", (x) => Math.sign(x) * Math.abs(x) ** (1 / 5)],
  ["x^{-\\frac{1}{3}}", (x) => 1 / Math.cbrt(x)],
  ["x^{\\frac{2}{6}}", (x) => Math.cbrt(x)], // reduced first: 2/6 is 1/3
  ["x^{\\frac{1}{2}}", (x) => Math.pow(x, 1 / 2)], // even q: NaN for x < 0, as before
  ["x^{0.2}", (x) => Math.pow(x, 0.2)], // not a literal fraction
  ["\\ln\\left(x\\right)", (x) => Math.log(x)],
  ["\\log\\left(x\\right)", (x) => Math.log10(x)],
  ["\\exponentialE^{-x^2}", (x) => Math.exp(-(x * x))],
  ["\\exponentialE^x", (x) => Math.exp(x)],
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

describe("latex to JS (plot evaluator)", () => {
  it("x^{1/3} at x = -8 is -2 (R39)", () => {
    expect(toFn("x^{1/3}")(-8)).toBe(-2);
    expect(toFn("x^{\\frac{2}{3}}")(-8)).toBeCloseTo(4, 12);
  });
  for (const [latex, ref] of cases) {
    it(latex, () => {
      const f = toFn(latex);
      for (const x of xs) {
        const a = f(x);
        const b = ref(x);
        const ok = (Number.isNaN(a) && Number.isNaN(b)) || a === b || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
        expect(ok, `x=${x}: got ${a}, want ${b}`).toBe(true);
      }
    });
  }
  for (const bad of ["\\int x\\,dx", "y+1", "\\begin{pmatrix}1\\end{pmatrix}", "z"]) {
    it(`rejects ${bad}`, () => {
      expect(() => toFn(bad)).toThrow();
    });
  }
});

describe("plot errors", () => {
  it("keep the 'cannot plot: ' prefix", () => {
    expect(() => latexToJs("q+1")).toThrow("cannot plot: unknown name q");
  });
});
