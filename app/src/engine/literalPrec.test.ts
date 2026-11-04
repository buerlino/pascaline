// SPDX-License-Identifier: GPL-3.0-or-later
// G141: the precision a long exact literal needs (literalPrec.ts). Engine-free; the values are counted by hand.
import { describe, expect, it } from "vitest";
import { literalDigits, literalStart } from "./literalPrec.ts";

const ONE_E100 = "1" + "0".repeat(100);

describe("literalDigits", () => {
  it("counts the longest printed integer, whole and without its trailing zeros", () => {
    expect(literalDigits(`exp(${ONE_E100}*ln(${ONE_E100.slice(0, -1)}1/${ONE_E100}))`)).toEqual({ total: 101, sig: 101 });
    expect(literalDigits(`sqrt(2)*${ONE_E100}`)).toEqual({ total: 101, sig: 1 });
    expect(literalDigits("sqrt(2)+1/3")).toEqual({ total: 1, sig: 1 });
  });
  it("skips names and decimals", () => {
    expect(literalDigits("x12345678901234567890123+1.234567890123456789012345")).toEqual({ total: 0, sig: 0 });
  });
  it("reads a typed power of two integer literals", () => {
    expect(literalDigits("evalf((1+10^(-100))^(10^100))")).toEqual({ total: 101, sig: 1 });
    expect(literalDigits("2^-64")).toEqual({ total: 20, sig: 20 });
    expect(literalDigits("x^100+1^500")).toEqual({ total: 3, sig: 1 });
  });
});

describe("literalStart", () => {
  it("is P without a long literal", () => {
    expect(literalStart("sqrt(2)*2^20", 40, 1000)).toEqual({ at: 40, unchecked: false });
  });
  it("is the digit count plus 20 for a long one", () => {
    expect(literalStart(`ln(${ONE_E100.slice(0, -1)}1)`, 40, 1000)).toEqual({ at: 121, unchecked: false });
  });
  it("past the cap falls back to the significant digits, then to P unchecked", () => {
    expect(literalStart("1" + "0".repeat(1250), 40, 1000)).toEqual({ at: 40, unchecked: false });
    expect(literalStart("1" + "0".repeat(1249) + "1", 40, 1000)).toEqual({ at: 40, unchecked: true });
  });
});
