// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { decimalFromRational, decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { parsePastedNumber } from "./paste.ts";
import { complexText } from "./text.ts";

const latex = (s: string, o = {}): string | undefined => parsePastedNumber(s, o)?.latex;

describe("parsePastedNumber", () => {
  it("reads a real number as the keyboard's own LaTeX (the exponent as the mark ᴇ, R14)", () => {
    expect(latex("-1.5")).toBe("-1.5");
    expect(latex("  42 ")).toBe("42");
    expect(latex(".5")).toBe("0.5");
    expect(latex("1.5e-3")).toBe("1.5\\emark-3");
    expect(latex("1.5E-3")).toBe("1.5\\emark-3");
    expect(latex("1.5E+22")).toBe("1.5\\emark22");
    expect(latex("1.5ᴇ-3")).toBe("1.5\\emark-3"); // the reference's own mark
    expect(latex("1.5×10^-3")).toBe("1.5\\emark-3");
    expect(latex("6.02 x 10^(23)")).toBe("6.02\\emark23");
    expect(latex("−1.5")).toBe("-1.5");
  });
  it("reads the decimal comma only when the setting is on", () => {
    expect(latex("1,5")).toBeUndefined();
    expect(latex("1,5", { decimalComma: true })).toBe("1,5");
    expect(latex("1.5", { decimalComma: true })).toBeUndefined();
    expect(latex("1,5e-3", { decimalComma: true })).toBe("1,5\\emark-3");
  });
  it("reads complex numbers a+b*i", () => {
    expect(latex("1+2*i")).toBe("1+2\\imaginaryI");
    expect(latex("1-2i")).toBe("1-2\\imaginaryI");
    expect(latex("1 + i")).toBe("1+\\imaginaryI");
    expect(latex("2i")).toBe("2\\imaginaryI");
    expect(latex("-i")).toBe("-\\imaginaryI");
    expect(latex("1.25E-7-3.5E-8*i")).toBe("1.25\\emark-7-3.5\\emark-8\\imaginaryI");
  });
  it("refuses anything that is not one number", () => {
    for (const s of ["", "abc", "0xFF", "1e", "1 000", "1/3", "1\n2", "1..5", "1+", "1++2i", "--1", "sqrt(2)", "1.5 apples", "x".repeat(500)])
      expect(parsePastedNumber(s), JSON.stringify(s)).toBeNull();
  });
  it("keeps a zero mantissa free of an exponent", () => {
    expect(latex("0e5")).toBe("0");
  });
});

describe("copy → paste gives the value back (P5)", () => {
  // Each value is copied as text.ts writes it, pasted, and read by our parser: the Giac text must mean the same number.
  const z = (a: string, b = "0"): ComplexValue => ({ re: decimalFromString(a) ?? ZERO_VALUE, im: decimalFromString(b) ?? ZERO_VALUE });
  const cases: [string, ComplexValue][] = [
    ["third", { re: decimalFromRational(1n, 3n), im: ZERO_VALUE }],
    ["negative", z("-2.5")],
    ["small", z("1.25e-7")],
    ["large", z("-6.02214076e23")],
    ["complex", z("1.5", "-2")],
    ["imaginary", z("0", "1")],
  ];
  for (const [name, v] of cases) {
    it(name, () => {
      const copied = complexText(v, 40);
      const pasted = parsePastedNumber(copied);
      expect(pasted, copied).not.toBeNull();
      // the pasted LaTeX parses, and the copy of what it means is the same text
      const giac = latexToGiac(pasted?.latex ?? "");
      expect(giac.length).toBeGreaterThan(0);
      // (the exponent mark reads as a literal with an exponent: 1.25E-7 → 1.25e-7, R14)
      expect(giac, copied).toBe(copied.replace(/E(-?\d+)/g, "e$1"));
    });
  }
});
