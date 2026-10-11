// SPDX-License-Identifier: GPL-3.0-or-later
// Home number formatter (D5). Every expected value is `derived` (decimal arithmetic by hand); the
// layout conventions themselves are our own until G2 checklist item 15 is answered.
import { describe, expect, it } from "vitest";
import {
  decimalFromRational,
  decimalFromString,
  formatComplex,
  formatReal,
  roundSignificant,
  tieRisk,
  toText,
  type FormatOptions,
  type NumberFormat,
} from "./format.ts";

const q = (p: bigint, d: bigint = 1n) => decimalFromRational(p, d);
const fmt = (p: bigint, d: bigint, format: NumberFormat, digits: number, rounding?: FormatOptions["rounding"]) =>
  toText(formatReal(q(p, d), { format, digits, rounding }));

describe("decimalFromRational", () => {
  it("keeps truncated digits and a sticky flag", () => {
    expect(q(1n, 3n)).toEqual({ neg: false, digits: "3".repeat(40), exp: -1, sticky: true });
    expect(q(-5n, 2n)).toEqual({ neg: true, digits: "25", exp: 0, sticky: false });
    expect(q(1000n)).toEqual({ neg: false, digits: "1", exp: 3, sticky: false });
    expect(q(1n, 10n)).toEqual({ neg: false, digits: "1", exp: -1, sticky: false });
    expect(q(0n, 7n).digits).toBe("");
  });
  it("rejects a non-positive denominator", () => {
    expect(() => q(1n, 0n)).toThrow(RangeError);
  });
});

describe("decimalFromString", () => {
  it("parses printed Giac floats", () => {
    expect(decimalFromString("-0.3141e6")).toEqual({ neg: true, digits: "3141", exp: 5, sticky: false });
    expect(decimalFromString("2.5e-07")).toEqual({ neg: false, digits: "25", exp: -7, sticky: false });
    expect(decimalFromString("0.000")?.digits).toBe("");
    expect(decimalFromString("x+1")).toBeNull();
  });
  it("flags a possible double rounding of a float", () => {
    const v = decimalFromString("0.123449999999");
    expect(v && tieRisk(v, 4)).toBe(true);
    const w = decimalFromString("0.123456");
    expect(w && tieRisk(w, 4)).toBe(false);
  });
});

describe("roundSignificant", () => {
  it("half away from zero (default)", () => {
    expect(roundSignificant(q(5n, 2n), 1)).toEqual({ neg: false, digits: "3", exp: 0 });
    expect(roundSignificant(q(-5n, 2n), 1)).toEqual({ neg: true, digits: "3", exp: 0 });
    expect(roundSignificant(q(2n, 3n), 12)).toEqual({ neg: false, digits: "666666666667", exp: -1 });
  });
  it("half to even (G2 item 8 alternative)", () => {
    expect(roundSignificant(q(5n, 2n), 1, "half-even").digits).toBe("2");
    expect(roundSignificant(q(7n, 2n), 1, "half-even").digits).toBe("4");
    // 2.5 + 10^-40: digits beyond the kept 40 only show in the sticky flag, and still round up.
    expect(roundSignificant(q(25n * 10n ** 39n + 1n, 10n ** 40n), 1, "half-even").digits).toBe("3");
  });
  it("G2 item 8 example 0.1234567890125 at 12 digits", () => {
    const v = q(1234567890125n, 10n ** 13n);
    expect(toText(formatReal(v, { format: "STD", digits: 12 }))).toBe("0.123456789013");
    expect(toText(formatReal(v, { format: "STD", digits: 12, rounding: "half-even" }))).toBe("0.123456789012");
  });
  it("carry into a new digit", () => {
    expect(roundSignificant(q(9999999999995n), 12)).toEqual({ neg: false, digits: "100000000000", exp: 13 });
  });
  it("rejects bad digit counts", () => {
    expect(() => roundSignificant(q(1n), 0)).toThrow(RangeError);
  });
});

describe("STD", () => {
  it.each<[bigint, bigint, number, string]>([
    [1n, 3n, 12, "0.333333333333"],
    [1n, 1n, 12, "1"],
    [-5n, 2n, 12, "-2.5"],
    [0n, 1n, 12, "0"],
    [1n, 10000n, 12, "0.0001"],
    [1n, 100000n, 12, "1E-5"],
    [10n ** 12n - 1n, 1n, 12, "999999999999"],
    [10n ** 12n, 1n, 12, "1E12"],
    [123456789n, 10000n, 12, "12345.6789"],
    [123n, 1000000n, 12, "0.000123"],
    [99996n, 100n, 4, "1000"],
    [123456n, 1n, 4, "1.235E5"],
  ])("%s/%s at %s -> %s", (p, d, n, out) => {
    expect(fmt(p, d, "STD", n)).toBe(out);
  });
});

describe("SCI", () => {
  it.each<[bigint, bigint, number, string]>([
    [1n, 3n, 12, "3.33333333333E-1"],
    [123456789n, 10000n, 4, "1.235E4"],
    [123n, 1000000n, 4, "1.230E-4"],
    [99996n, 100n, 4, "1.000E3"],
    [-5n, 2n, 1, "-3E0"],
    [0n, 1n, 3, "0.00E0"],
  ])("%s/%s at %s -> %s", (p, d, n, out) => {
    expect(fmt(p, d, "SCI", n)).toBe(out);
  });
});

describe("ENG", () => {
  it.each<[bigint, bigint, number, string]>([
    [1n, 3n, 12, "333.333333333E-3"],
    [123456789n, 10000n, 4, "12.35E3"],
    [123456789n, 10000n, 12, "12.3456789000E3"],
    [123n, 1000000n, 4, "123.0E-6"],
    [99996n, 100n, 4, "1.000E3"],
    [-456n, 10000n, 3, "-45.6E-3"],
    [123n, 1n, 1, "100E0"],
    [0n, 1n, 3, "0.00E0"],
  ])("%s/%s at %s -> %s", (p, d, n, out) => {
    expect(fmt(p, d, "ENG", n)).toBe(out);
  });
});

describe("formatComplex", () => {
  const o: FormatOptions = { format: "STD", digits: 12 };
  it("real, imaginary and mixed", () => {
    expect(formatComplex({ re: q(3n, 2n), im: q(0n) }, o).text).toBe("1.5");
    expect(formatComplex({ re: q(0n), im: q(2n) }, o).text).toBe("2*i");
    expect(formatComplex({ re: q(0n), im: q(-2n) }, o).text).toBe("-2*i");
    const c = formatComplex({ re: q(1n), im: q(-1n, 2n) }, o);
    expect(c.text).toBe("1-0.5*i");
    expect(c.im).toEqual({ neg: true, mantissa: "0.5", exponent: null });
  });
  it("ENG applies to both parts", () => {
    expect(formatComplex({ re: q(1500n), im: q(25n, 1000n) }, { format: "ENG", digits: 3 }).text).toBe("1.50E3+25.0E-3*i");
  });
});
