// SPDX-License-Identifier: GPL-3.0-or-later
// L5: results put back on the entry line must parse to the same value (derived).
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { resultToEntry } from "./insertable.ts";
import { tidyGiacLatex } from "./tidy.ts";

const cases: [string, string, string][] = [
  // display latex, entry latex, Giac text our parser makes of it
  ["0.333333333333", "0.333333333333", "0.333333333333"],
  ["1.5\\times10^{-7}", "1.5\\times10^{-7}", "1.5*10^(-7)"],
  ["-2.5", "-2.5", "-2.5"],
  ["2+3\\mathrm{i}", "\\left(2+3\\imaginaryI\\right)", "(2+3*i)"],
  ["\\frac{1}{2}", "\\frac{1}{2}", "1/2"],
  ["x_{1}+2x_{2}", "\\left(x_{1}+2x_{2}\\right)", "(x_1+2*x_2)"],
  ["\\frac{\\mathrm{e}^{x}}{x}", "\\frac{\\exponentialE^{x}}{x}", "exp(x)/x"],
  ["2\\sqrt{2}", "2\\sqrt{2}", "2*sqrt(2)"],
  // R67: a CAS result drawn by tidy keeps the constant i, and the letters e and i stay the names e_ and i_
  [tidyGiacLatex("2+3*i"), "\\left(2+3\\imaginaryI\\right)", "(2+3*i)"],
  [tidyGiacLatex("\\mathrm{e\\_}\\cdot 2+e^{1}"), "\\left(e\\cdot 2+\\exponentialE^{1}\\right)", "(e_*2+exp(1))"],
  [tidyGiacLatex("\\mathrm{i\\_}\\cdot i"), "i\\imaginaryI", "i_*i"],
];

describe("resultToEntry", () => {
  for (const [display, entry, giac] of cases)
    it(display, () => {
      expect(resultToEntry(display)).toBe(entry);
      expect(latexToGiac(entry).replace(/\s/g, "")).toBe(giac);
    });
});
