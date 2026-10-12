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

// L2: the a/b key pressed twice after a whole number gives a mixed number, 2\tfrac12 (assumed, G2 item 29, backlog G6).
// A plain \frac after a number stays a product (docs/decisions.md "Mixed numbers").
describe("mixed numbers (L2)", () => {
  const mixed: [string, string][] = [
    ["2\\tfrac12", "(2+1/2)"],
    ["12\\tfrac{3}{4}", "(12+3/4)"],
    ["2\\tfrac12\\times4", "(2+1/2)*4"],
    ["-2\\tfrac12", "-(2+1/2)"],
    ["\\tfrac{1}{2}", "1/2"],
    ["2\\frac{1}{2}", "2*(1/2)"],
  ];
  for (const [latex, giac] of mixed) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
});

// P4 keys: store (value ▶ name, shift of the exponent key) and polar entry r∡θ (shift ×). Expected text derived.
describe("store and polar entry (P4)", () => {
  const forms: [string, string][] = [
    ["5\\blacktriangleright A", "A:=5"],
    ["1+2\\blacktriangleright x", "x:=1+2"],
    ["2\\measuredangle30", "2*(cos(30)+i*sin(30))"],
    ["2\\measuredangle\\frac{\\pi}{6}", "2*(cos(pi/6)+i*sin(pi/6))"],
    ["1+1\\measuredangle-45", "(1+1)*(cos(-45)+i*sin(-45))"],
    ["2\\mathbin{\\measuredangle}\\frac{\\pi}{6}", "2*(cos(pi/6)+i*sin(pi/6))"],
    ["2\\mathbin{\\measuredangle}30", "2*(cos(30)+i*sin(30))"],
    ["\\operatorname{\\mathrm{approx}}\\left(\\frac13\\right)", "approx(1/3)"], // shift Enter, as MathLive serialises it
  ];
  for (const [latex, giac] of forms) it(latex, () => expect(latexToGiac(latex).replace(/\s/g, "")).toBe(giac));
  it("store needs a name after ▶", () => expect(() => latexToGiac("5\\blacktriangleright 3")).toThrow());
});
