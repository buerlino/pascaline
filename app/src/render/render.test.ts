// SPDX-License-Identifier: GPL-3.0-or-later
// The raw strings are what Giac's latex() printed in the engine build of 2026-10-11 (source: derived from running it).
import { describe, expect, it } from "vitest";
import { homeResultToLatex } from "./home.ts";
import { tidyGiacLatex } from "./tidy.ts";

const cases: [string, string][] = [
  ["\\frac{1}{2}", "\\frac{1}{2}"],
  ["2\\cdot \\sqrt{2}", "2\\sqrt{2}"],
  ["x^{3}+3\\cdot x^{2}+3\\cdot x+1", "x^{3}+3x^{2}+3x+1"],
  ["(x-1)\\cdot (x+1) (x^{2}+1)", "\\left(x-1\\right)\\left(x+1\\right) \\left(x^{2}+1\\right)"],
  ["\\frac{(x+1)}{(x-1)}", "\\frac{x+1}{x-1}"],
  ["\\frac{(a+b)(c+d)}{2}", "\\frac{\\left(a+b\\right)\\left(c+d\\right)}{2}"],
  ["\\frac{e^{x}}{x}", "\\frac{\\mathrm{e}^{x}}{x}"],
  ["\\pi \\cdot 2", "\\pi \\cdot 2"],
  ["1+2*i", "1+2i"],
  ["\\mathrm{atan}\\left(x\\right)", "\\arctan\\left(x\\right)"],
  ["\\mathrm{factorial}\\left(x\\right)", "\\left(x\\right)!"],
  ["\\sin\\left(x\\right)^{2}+\\cos\\left(x\\right)^{2}", "\\sin\\left(x\\right)^{2}+\\cos\\left(x\\right)^{2}"],
  ["\\left(\\begin{array}{cc}\n1 & 2 \\\\\n3 & 4\n\\end{array}\\right) ", "\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}"],
  ["\\{-\\sqrt{2},\\sqrt{2}\\}", "\\{-\\sqrt{2},\\sqrt{2}\\}"],
  ["x^{2}\\cdot y", "x^{2}y"],
  // L1: subscripted names (Giac latex() of x_1+2*x_2, X_1/y_2, x_12^2, ab_1)
  ["\\mathrm{x\\_1}+2\\cdot \\mathrm{x\\_2}", "x_{1}+2x_{2}"],
  ["\\frac{\\mathrm{X\\_1}}{\\mathrm{y\\_2}}", "\\frac{X_{1}}{y_{2}}"],
  ["\\mathrm{x\\_12}^{2}", "x_{12}^{2}"],
  ["\\mathrm{x\\_1}\\cdot \\mathrm{x\\_2}", "x_{1}x_{2}"],
  ["\\mathrm{ab\\_1}", "\\mathrm{ab}_{1}"],
  // regression: a \command on the left is one token (Giac prints latex(pi*x) as "\pi \cdot x")
  ["\\pi \\cdot x", "\\pi x"],
  ["2\\cdot \\pi \\cdot x", "2\\pi x"],
  ["\\alpha \\cdot y", "\\alpha y"],
  ["\\infty \\cdot x", "\\infty x"],
  ["x\\pi", "x\\pi"],
  ["\\pi \\cdot \\sqrt{2}", "\\pi\\sqrt{2}"],
  ["\\pi \\cdot 2", "\\pi \\cdot 2"],
  ["a\\cdot b\\cdot c", "abc"],
  ["\\frac{a\\cdot b}{c}", "\\frac{ab}{c}"],
  ["1267650600228229401496703205376", "1267650600228229401496703205376"],
  // R18: the Greek stand-in names (Giac latex() of beta_^2, 2*beta_*x, gamma_/Gamma_, epsilon_^2+sqrt(Gamma_), phi^2;
  // engine build of 2026-10-14) are drawn as their letters
  ["\\beta_^{2}", "\\beta^{2}"],
  ["2\\cdot \\beta_\\cdot x", "2\\beta x"],
  ["\\frac{\\gamma_}{\\Gamma_}", "\\frac{\\gamma}{\\Gamma}"],
  ["\\epsilon_^{2}+\\sqrt{\\Gamma_}", "\\varepsilon^{2}+\\sqrt{\\Gamma}"],
  ["\\sin\\left(\\gamma_\\right)", "\\sin\\left(\\gamma\\right)"],
  ["\\phi^{2}", "\\varphi^{2}"],
  // R18f1: Phi_ and Psi_ (Giac latex() of Psi_+1 and Phi_^2), and a ≠ test kept as typed (latex('(x+1)!=2'),
  // latex('f(x,y)!=[1,2]'); engine build of 2026-10-14)
  ["\\Psi_+1", "\\Psi+1"],
  ["\\Phi_^{2}", "\\Phi^{2}"],
  ["\\mathrm{!=}\\left(x+1,2\\right)", "x+1\\ne 2"],
  ["\\mathrm{!=}\\left(f(x,y),[1,2]\\right)", "f\\left(x,y\\right)\\ne [1,2]"],
  // R18f3: an == test kept as typed (latex() of the kept cos(pi/7) identity, of x*y==2 and of a list holding one;
  // engine build of 2026-10-15) loses the brackets round its sides; a digit keeps its sign before a fraction, which
  // would otherwise read as a mixed number (2 + π/7)
  [
    "(\\cos\\left(\\frac{\\pi }{7}\\right)-\\cos\\left(2\\cdot \\frac{\\pi }{7}\\right)+\\cos\\left(3\\cdot \\frac{\\pi }{7}\\right))==(\\frac{1}{2})",
    "\\cos\\left(\\frac{\\pi}{7}\\right)-\\cos\\left(2\\cdot \\frac{\\pi}{7}\\right)+\\cos\\left(3\\cdot \\frac{\\pi}{7}\\right)==\\frac{1}{2}",
  ],
  ["(x\\cdot y)==2", "xy==2"],
  ["(e^{\\pi  \\sqrt{163}})==(640320^{3}+744)", "\\mathrm{e}^{\\pi \\sqrt{163}}==640320^{3}+744"],
  ["[(x\\cdot y)==2,1]", "[\\left(xy\\right)==2,1]"],
  ["x\\cdot \\frac{1}{2}", "x\\frac{1}{2}"],
];

describe("tidyGiacLatex", () => {
  for (const [raw, want] of cases) it(raw.replace(/\n/g, "↵"), () => expect(tidyGiacLatex(raw)).toBe(want));

  it("leaves unbalanced brackets alone", () => {
    expect(tidyGiacLatex("(x+1")).toBe("(x+1");
  });
});

describe("homeResultToLatex", () => {
  it("draws subscripted names with a braced subscript (L1)", () => {
    expect(homeResultToLatex("2*x_12+y_1")).toBe("2\\cdot x_{12}+y_{1}");
  });
  it("draws the Greek names as their letters, the stand-ins for Giac's own names too (R18)", () => {
    expect(homeResultToLatex("2*gamma_")).toBe("2\\cdot \\gamma ");
    expect(homeResultToLatex("alpha+epsilon_*phi")).toBe("\\alpha +\\varepsilon \\cdot \\varphi ");
    expect(homeResultToLatex("theta-Omega")).toBe("\\theta -\\Omega ");
    expect(homeResultToLatex("+infinity")).toBe("+\\infty"); // Giac's print of inf (∞ on Shift + 9)
    expect(homeResultToLatex("-infinity")).toBe("-\\infty");
    expect(homeResultToLatex("beta_2+zeta1")).toBe("beta_2+zeta1"); // not Greek names: left alone
    expect(homeResultToLatex("Psi_+Phi_")).toBe("\\Psi +\\Phi "); // R18f1
  });
  it("draws an equality test kept as typed without Giac's brackets, ≠ as ≠ (R18f1)", () => {
    expect(homeResultToLatex("(x==2)")).toBe("x==2");
    expect(homeResultToLatex("((x+1)==2)")).toBe("(x+1)==2");
    expect(homeResultToLatex("x<>2")).toBe("x\\ne 2");
    expect(homeResultToLatex("(x+1)*(x-1)")).toBe("(x+1)\\cdot (x-1)"); // not one bracket pair: left alone
  });
  it("keeps plain decimals", () => {
    expect(homeResultToLatex("0.333333333333")).toBe("0.333333333333");
    expect(homeResultToLatex("-12.5")).toBe("-12.5");
  });
  it("raises the exponent of scientific notation", () => {
    expect(homeResultToLatex("1.5E-7")).toBe("1.5\\times10^{-7}");
    expect(homeResultToLatex("2E3")).toBe("2\\times10^{3}");
  });
  it("writes complex results with i", () => {
    expect(homeResultToLatex("1.5+2*i")).toBe("1.5+2\\mathrm{i}");
    expect(homeResultToLatex("1.5+i")).toBe("1.5+\\mathrm{i}");
    expect(homeResultToLatex("-i")).toBe("-\\mathrm{i}");
  });
});
