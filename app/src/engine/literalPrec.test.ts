// SPDX-License-Identifier: GPL-3.0-or-later
// G141: the precision a long exact literal needs (literalPrec.ts). Engine-free; the values are counted by hand.
import { describe, expect, it } from "vitest";
import { literalDigits, literalStart } from "./literalPrec.ts";

const ONE_E100 = "1" + "0".repeat(100);

describe("literalDigits", () => {
  it("counts the longest printed integer, whole and without its trailing zeros", () => {
    expect(literalDigits(`exp(${ONE_E100}*ln(${ONE_E100.slice(0, -1)}1/${ONE_E100}))`, "printed")).toEqual({ total: 101, sig: 101 });
    expect(literalDigits(`sqrt(2)*${ONE_E100}`, "printed")).toEqual({ total: 101, sig: 1 });
    expect(literalDigits("sqrt(2)+1/3", "printed")).toEqual({ total: 1, sig: 1 });
  });
  it("skips names, decimals and strings", () => {
    expect(literalDigits(`"${ONE_E100}"+1`, "typed")).toEqual({ total: 1, sig: 1 });
    expect(literalDigits("x12345678901234567890123+1.234567890123456789012345", "typed")).toEqual({ total: 0, sig: 0 });
  });
  it("reads a typed power of two integer literals", () => {
    expect(literalDigits("evalf((1+10^(-100))^(10^100))", "typed")).toEqual({ total: 101, sig: 1 });
    expect(literalDigits("2^-64", "typed")).toEqual({ total: 20, sig: 20 });
    expect(literalDigits("x^100+1^500", "typed")).toEqual({ total: 3, sig: 1 });
    expect(literalDigits("3^(200)+10^-70", "typed")).toEqual({ total: 96, sig: 96 });
  });
});

describe("literalStart", () => {
  it("is P without a long literal", () => {
    expect(literalStart("sqrt(2)*2^20", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
  });
  it("is the digit count plus P for one that passes P - 20", () => {
    expect(literalStart(`ln(${ONE_E100.slice(0, -1)}1)`, 40, 1000, "printed")).toEqual({ at: 141, unchecked: false });
    expect(literalStart("exp(10^-70)-1", 50, 1000, "typed")).toEqual({ at: 121, unchecked: false });
    expect(literalStart("2^66+1", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("2^67+1", 40, 1000, "typed")).toEqual({ at: 61, unchecked: false });
  });
  it("past the cap falls back to the significant digits, then to P unchecked", () => {
    expect(literalStart("1" + "0".repeat(1250), 40, 1000, "printed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("1" + "0".repeat(1249) + "1", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
  });
});
