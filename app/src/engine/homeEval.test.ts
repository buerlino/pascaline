// SPDX-License-Identifier: GPL-3.0-or-later
// Pure parts of exact-first Home. Every expected value here is `derived` (exact arithmetic by hand).
import { describe, expect, it } from "vitest";
import { formatDecimal, roundDecimalString, roundRational, toExactLiterals } from "./homeEval.ts";

describe("toExactLiterals", () => {
  it.each([
    ["0.1", "(1/10^1)"],
    ["1-0.9-0.1", "1-(9/10^1)-(1/10^1)"],
    [".5", "(5/10^1)"],
    ["2.50", "(250/10^2)"],
    ["1e-3", "(1/10^3)"],
    ["1.5e300", "(15*10^299)"],
    ["1.2E5", "(12*10^4)"],
    ["12", "12"],
    ["x1+2.5", "x1+(25/10^1)"],
    ['"0.1"', '"0.1"'],
  ])("%s -> %s", (input, out) => {
    expect(toExactLiterals(input)).toBe(out);
  });
});

describe("roundRational (half away from zero)", () => {
  it("1/3 and 2/3 to 12 digits", () => {
    expect(roundRational(1n, 3n, 12)).toMatchObject({ neg: false, digits: "333333333333", exp: -1 });
    expect(roundRational(2n, 3n, 12)).toMatchObject({ digits: "666666666667", exp: -1 });
  });
  it("ties go away from zero", () => {
    expect(roundRational(5n, 2n, 1)).toMatchObject({ neg: false, digits: "3", exp: 0 });
    expect(roundRational(-5n, 2n, 1)).toMatchObject({ neg: true, digits: "3", exp: 0 });
  });
  it("carry into a new digit", () => {
    expect(roundRational(9999999999995n, 1n, 12)).toMatchObject({ digits: "100000000000", exp: 13 });
  });
  it("zero", () => {
    expect(roundRational(0n, 7n, 12).digits).toBe("0");
  });
  it("exponent at a power of ten", () => {
    expect(roundRational(1n, 10n, 12)).toMatchObject({ digits: "100000000000", exp: -1 });
    expect(roundRational(1000n, 1n, 12)).toMatchObject({ digits: "100000000000", exp: 3 });
  });
});

describe("roundDecimalString", () => {
  it("rounds a printed float", () => {
    expect(roundDecimalString("1.41421356237309504880168872420969807857", 12)).toMatchObject({
      digits: "141421356237",
      exp: 0,
      tieRisk: false,
    });
    expect(roundDecimalString("-0.3141e6", 3)).toMatchObject({ neg: true, digits: "314", exp: 5 });
    expect(roundDecimalString("2.5e-07", 12)).toMatchObject({ digits: "250000000000", exp: -7 });
  });
  it("flags a possible double rounding", () => {
    expect(roundDecimalString("0.123449999999", 4)?.tieRisk).toBe(true);
  });
  it("rejects non-numbers", () => {
    expect(roundDecimalString("x+1", 12)).toBeNull();
  });
});

describe("formatDecimal (canonical test form)", () => {
  it.each<[bigint, bigint, string]>([
    [1n, 3n, "0.333333333333"],
    [1n, 1n, "1"],
    [-5n, 2n, "-2.5"],
    [1n, 10000n, "0.0001"],
    [1n, 100000n, "1E-5"],
    [10n ** 12n, 1n, "1E12"],
    [10n ** 12n - 1n, 1n, "999999999999"],
  ])("%s/%s -> %s", (p, q, out) => {
    expect(formatDecimal(roundRational(p, q, 12))).toBe(out);
  });
});
