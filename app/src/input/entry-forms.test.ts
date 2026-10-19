// SPDX-License-Identifier: GPL-3.0-or-later
// Entry forms. L4: the literal caret of the one-line mode; MathLive serialises it as \char"5E plus a space.
// Expected Giac text is derived (the usual precedence: the exponent is the next signed factor).
import { describe, expect, it } from "vitest";
import { latexToGiac } from "./latex-to-giac.ts";

const C = '\\char"5E ';
const cases: [string, string][] = [
  [`2${C}3`, "2^3"],
  [`2${C}34`, "2^34"],
  [`x${C}2+1`, "x^2+1"],
  [`2${C}-1`, "2^(-1)"],
  [`2${C}\\left(3+1\\right)`, "2^(3+1)"],
  [`2${C}3${C}2`, "2^(3^2)"],
  [`-x${C}2`, "-x^2"],
  [`2${C}3x`, "2^3*x"],
];

describe("literal caret (L4)", () => {
  for (const [latex, giac] of cases)
    it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
  it("rejects a \\char that is not a caret", () => {
    expect(() => latexToGiac('2\\char"41 3')).toThrow();
  });
});

// F26 (R30): in a flat line (one-line entry, or pasted text) ÷ and / take one factor on their right: a number, a name, a
// power, a function call or a bracket. The product then goes on left to right, as with ×. That is the G2's one-line rule
// (G2 item 6: pasted 1/2x is (1/2)·x). Textbook entry is not affected: there ÷ makes a stacked fraction. Expected text derived.
describe("÷ in a flat line (F26)", () => {
  const flat: [string, string][] = [
    ["1/2x", "(1/2)*x"],
    ["6\\div2\\left(1+2\\right)", "(6/2)*(1+2)"],
    ["1\\div2\\sqrt{3}", "(1/2)*sqrt(3)"],
    ["a\\div bc", "(a/b)*c"],
    ["1\\div2\\pi", "(1/2)*pi"],
    ["1\\div-2x", "(1/(-2))*x"],
    ["1\\div2x\\div3y", "((1/2)*x/3)*y"],
    [`1\\div2${C}3x`, "(1/2^3)*x"],
    ["1\\div2^{3}x", "(1/2^3)*x"],
    // unchanged
    ["8\\div2\\times4", "(8/2)*4"],
    ["1\\div x^{2}", "1/x^2"],
    ["2x\\div4", "2*x/4"],
    ["\\frac{1}{2x}", "1/(2*x)"],
    ["\\frac{1}{2}x", "(1/2)*x"],
    ["1\\div\\left(2x\\right)", "1/(2*x)"],
  ];
  for (const [latex, giac] of flat) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
});

// The mixed-number template of the Tmpl palette (R10; L2's a/b-twice is gone) writes a whole number, then \tfrac.
// A plain \frac after a number stays a product (docs/decisions.md "Mixed numbers"). Expected text derived.
describe("mixed numbers (Tmpl)", () => {
  const mixed: [string, string][] = [
    ["2\\tfrac12", "(2+1/2)"],
    ["12\\tfrac{3}{4}", "(12+3/4)"],
    ["2\\tfrac12\\times4", "(2+1/2)*4"],
    ["-2\\tfrac12", "-(2+1/2)"],
    ["2\\frac{1}{2}", "2*(1/2)"],
  ];
  for (const [latex, giac] of mixed) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
  it("refuses \\tfrac after anything but a whole number (x\\tfrac12 would silently be x/2)", () => {
    for (const latex of ["\\tfrac{1}{2}", "x\\tfrac12", "2.5\\tfrac12", "\\pi\\tfrac12"]) expect(() => latexToGiac(latex), latex).toThrow(/whole number/);
  });
});

// The other Tmpl templates (R10): the Giac text they become. Values are checked by the round trip and parser.yaml.
describe("Tmpl templates (R10)", () => {
  const forms: [string, string][] = [
    ["\\left.x^2\\right|_{x=3}", "subst(x^2,x=3)"],
    ["\\left.x+1\\right.", "(x+1)"],
    ["\\frac{\\partial x^2+3x}{\\partial x}", "diff(x^2+3*x,x)"],
    ["\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}", "piecewise(x==0,x,x==1,1)"],
    ["\\begin{cases}x & x=0\\\\ 1 & x=1\\end{cases}", "piecewise(x==0,x,x==1,1)"],
    ["30\\degree15\\prime36\\doubleprime", "(30+15/60+36/3600)*pi/180/pasdeg"],
    ["30\\degree36\\doubleprime", "(30+36/3600)*pi/180/pasdeg"],
    ["30^{\\circ}", "30*pi/180/pasdeg"],
  ];
  for (const [latex, giac] of forms) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
  it("refuses half-built forms instead of guessing", () => {
    for (const latex of [
      "\\left.x^2\\right|_{3}", // no variable under the bar
      "\\left.x^2\\right|", // no subscript
      "\\frac{\\partial}{\\partial x}", // nothing to differentiate
      "\\frac{\\partial x^2}{x}", // no ∂ in the denominator
      "\\frac{\\partial x^2}{\\partial 2}", // no variable
      "\\begin{cases}1\\\\ 2 & x=1\\end{cases}", // a line without a condition
      "\\begin{cases}1 & \\text{when }x=1\\end{cases}",
      "15\\prime", // minutes without degrees
      "x\\prime",
    ])
      expect(() => latexToGiac(latex), latex).toThrow();
  });
});

// P4 keys: store (value ▶ name, shift of the exponent key) and polar entry r∡θ (shift ×). Expected text derived.
describe("store and polar entry (P4)", () => {
  const forms: [string, string][] = [
    ["5\\blacktriangleright A", "A:=5"],
    ["1+2\\blacktriangleright x", "x:=1+2"],
    ["2\\measuredangle30", "2*(cos(pasdeg*30)+i*sin(pasdeg*30))"],
    ["2\\measuredangle\\frac{\\pi}{6}", "2*(cos(pasdeg*(pi/6))+i*sin(pasdeg*(pi/6)))"],
    ["1+1\\measuredangle-45", "(1+1)*(cos(pasdeg*(-45))+i*sin(pasdeg*(-45)))"],
    ["2\\mathbin{\\measuredangle}\\frac{\\pi}{6}", "2*(cos(pasdeg*(pi/6))+i*sin(pasdeg*(pi/6)))"],
    ["2\\mathbin{\\measuredangle}30", "2*(cos(pasdeg*30)+i*sin(pasdeg*30))"],
    ["\\operatorname{\\mathrm{approx}}\\left(\\frac13\\right)", "approx(1/3)"], // shift Enter, as MathLive serialises it
  ];
  for (const [latex, giac] of forms) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
  it("store needs a name after ▶", () => expect(() => latexToGiac("5\\blacktriangleright 3")).toThrow());
});

// R27b (F23, G2 item 50, owner 2026-10-15): a term between a bare function name and a bracket reads two ways
describe("a bare function name before a term and a bracket (G2 item 50)", () => {
  // R27c: also when the term ends in a constant (cos 2π(x): cos(2π)·x or cos(2πx)) or the bracket is |…| (sin 2|x|)
  for (const latex of ["\\sin7\\left(2\\right)", "\\sin x\\left(x+1\\right)", "\\ln7\\left(2\\right)", "\\log_27\\left(8\\right)", "\\cos2\\pi\\left(x\\right)", "\\sin2\\left|x\\right|", "\\sin x\\left|x\\right|"])
    it(`${latex} is refused`, () => expect(() => latexToGiac(latex)).toThrow(/brackets/));
  for (const [latex, giac] of [["\\sin 2x", "sin(pasdeg*(2*x))"], ["\\sin x\\cos x", "sin(pasdeg*x)*cos(pasdeg*x)"], ["\\sin\\left(2\\right)\\left(3\\right)", "sin(pasdeg*2)*(3)"], ["\\cos2\\pi x", "cos(pasdeg*(2*pi*x))"], ["\\sin\\left|x\\right|", "sin(pasdeg*abs(x))"], ["\\cos2\\pi\\times\\left(x\\right)", "cos(pasdeg*(2*pi))*(x)"]] as const)
    it(`${latex} still reads`, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
});
