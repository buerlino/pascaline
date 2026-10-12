// SPDX-License-Identifier: GPL-3.0-or-later
// Home number formatter (D5). Every expected value is `derived` (decimal arithmetic by hand); the
// layout conventions themselves are our own until G2 checklist item 15 is answered.
import { describe, expect, it } from "vitest";
import {
  confirmedDigits,
  decimalFromRational,
  decimalFromString,
  formatComplex,
  formatConfirmed,
  markOf,
  ZERO_VALUE,
  type ComplexValue,
  formatFraction,
  formatPolar,
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
  it("a unit imaginary part shows as i, not 1*i (regression: 1.73205080757+1*i)", () => {
    expect(formatComplex({ re: q(0n), im: q(1n) }, o).text).toBe("i");
    expect(formatComplex({ re: q(0n), im: q(-1n) }, o).text).toBe("-i");
    expect(formatComplex({ re: q(3n, 2n), im: q(1n) }, o).text).toBe("1.5+i");
    expect(formatComplex({ re: q(3n, 2n), im: q(-1n) }, o).text).toBe("1.5-i");
    // only a plain 1 is dropped: 1.5 stays, and so do scientific and engineering mantissas
    expect(formatComplex({ re: q(0n), im: q(3n, 2n) }, o).text).toBe("1.5*i");
    expect(formatComplex({ re: q(0n), im: q(1n) }, { format: "SCI", digits: 3 }).text).toBe("1.00E0*i");
    expect(formatComplex({ re: q(0n), im: q(10n) }, o).text).toBe("10*i");
  });
  it("ENG applies to both parts", () => {
    expect(formatComplex({ re: q(1500n), im: q(25n, 1000n) }, { format: "ENG", digits: 3 }).text).toBe("1.50E3+25.0E-3*i");
  });
});

describe("FIX (decimals after the point)", () => {
  const fix = (p: bigint, d: bigint, f: number, rounding?: FormatOptions["rounding"]) =>
    toText(formatReal(q(p, d), { format: "FIX", digits: 12, fixed: f, rounding }));
  it("rounds at the decimal position", () => {
    expect(fix(1n, 3n, 4)).toBe("0.3333");
    expect(fix(2n, 3n, 4)).toBe("0.6667");
    expect(fix(-2n, 3n, 4)).toBe("-0.6667");
    expect(fix(12345678n, 1000n, 2)).toBe("12345.68");
    expect(fix(5n, 2n, 0)).toBe("3"); // half away from zero
    expect(fix(5n, 2n, 0, "half-even")).toBe("2");
    expect(fix(1000n, 1n, 2)).toBe("1000.00");
  });
  it("carries into a new digit and handles values below the last place", () => {
    expect(fix(99999n, 10000n, 4)).toBe("9.9999");
    expect(fix(999996n, 100000n, 4)).toBe("10.0000"); // 9.99996
    expect(fix(1n, 100000n, 4)).toBe("0.0000"); // 0.00001
    expect(fix(-1n, 100000n, 4)).toBe("0.0000"); // no negative zero
    expect(fix(5n, 100000n, 4)).toBe("0.0001"); // 0.00005, half away
    expect(fix(5n, 100000n, 4, "half-even")).toBe("0.0000");
    expect(fix(0n, 1n, 3)).toBe("0.000");
  });
  it("applies to both parts of a complex number", () => {
    expect(formatComplex({ re: q(1n, 3n), im: q(-2n, 3n) }, { format: "FIX", digits: 12, fixed: 2 }).text).toBe("0.33-0.67*i");
  });
});

describe("formatFraction", () => {
  it("fraction and mixed fraction", () => {
    expect(formatFraction(1n, 3n, false).text).toBe("1/3");
    expect(formatFraction(-7n, 3n, false).text).toBe("-7/3");
    expect(formatFraction(7n, 3n, true).text).toBe("2 1/3");
    expect(formatFraction(-7n, 3n, true).text).toBe("-2 1/3");
    expect(formatFraction(1n, 3n, true).text).toBe("1/3");
    expect(formatFraction(6n, 1n, false).text).toBe("6");
    expect(formatFraction(6n, 3n, true).text).toBe("2");
    expect(formatFraction(0n, 1n, true).text).toBe("0");
  });
  it("exposes the parts for drawing", () => {
    expect(formatFraction(-7n, 3n, true)).toMatchObject({ neg: true, whole: "2", num: "1", den: "3" });
    expect(formatFraction(-7n, 3n, false)).toMatchObject({ neg: true, whole: "", num: "7", den: "3" });
  });
});

describe("formatPolar", () => {
  it("r and theta share the number format", () => {
    // |3+4i| = 5 (derived); the angle is any value here: only the layout is tested
    expect(formatPolar(q(5n), q(1n, 2n), { format: "STD", digits: 12 }).text).toBe("5\u22210.5");
    expect(formatPolar(q(5n), q(-1n, 2n), { format: "STD", digits: 12 }).text).toBe("5\u2221-0.5");
    expect(formatPolar(q(1500n), q(0n), { format: "ENG", digits: 3 }).text).toBe("1.50E3\u22210.00E0");
  });
});

// --- G2: PFX, marks, confirmed digits (docs/04 sections 2.4, 2.7). All expected values derived by hand. ------------

describe("PFX: SI prefix display (docs/04 2.7)", () => {
  const p = (s: string, digits = 4) => toText(formatReal(decimalFromString(s)!, { format: "PFX", digits }));
  it.each([
    ["1e-15", "1.000 f"],
    ["1e-12", "1.000 p"],
    ["4.7e-9", "4.700 n"],
    ["1e-6", "1.000 µ"],
    ["0.0015", "1.500 m"],
    ["1.5", "1.500"],
    ["4.7e3", "4.700 k"],
    ["1e6", "1.000 M"],
    ["2.2e9", "2.200 G"],
    ["1e12", "1.000 T"],
    ["1e15", "1.000 P"],
    ["-4.7e3", "-4.700 k"],
    ["0", "0.000"],
  ])("%s → %s", (x, want) => expect(p(x)).toBe(want));
  it("rounding moves into the next prefix: 999.96 k at 4 digits is 1.000 M", () => expect(p("999.96e3")).toBe("1.000 M"));
  it("rounding moves into the range: 9.9996E-16 at 4 digits is 1.000 f", () => expect(p("9.9996e-16")).toBe("1.000 f"));
  it("999.94 k stays 999.9 k", () => expect(p("999.94e3")).toBe("999.9 k"));
  it("outside f … P it is ENG", () => {
    expect(p("1e18")).toBe("1.000E18");
    expect(p("1e-16")).toBe("100.0E-18");
    expect(p("9.9994e-16")).toBe("999.9E-18");
  });
});

describe("markOf: the mark per format (docs/04 2.4)", () => {
  const v = (s: string) => decimalFromString(s)!;
  const real = (s: string): ComplexValue => ({ re: v(s), im: ZERO_VALUE });
  const exact = (s: string) => ({ value: real(s), exactRational: true, reliableDigits: null });
  const quarter = { value: { re: decimalFromRational(1n, 4n), im: ZERO_VALUE }, exactRational: true, reliableDigits: null };
  const third = { value: { re: decimalFromRational(1n, 3n), im: ZERO_VALUE }, exactRational: true, reliableDigits: null };
  const STD = { format: "STD", digits: 12 } as const;
  it("1/4 is = in STD, SCI, ENG and PFX, ≈ in FIX 1 (0.3)", () => {
    for (const format of ["STD", "SCI", "ENG", "PFX"] as const) expect(markOf(quarter, { format, digits: 12 })).toEqual({ mark: "=" });
    expect(markOf(quarter, { format: "FIX", digits: 12, fixed: 1 })).toEqual({ mark: "≈" });
    expect(markOf(quarter, { format: "FIX", digits: 12, fixed: 2 })).toEqual({ mark: "=" });
  });
  it("1/3 is ≈ in every format", () => {
    for (const format of ["STD", "SCI", "ENG", "PFX", "FIX"] as const) expect(markOf(third, { format, digits: 12 })).toEqual({ mark: "≈" });
  });
  it("an exact integer too long for the digits is ≈ (2^100 at 12 digits), = when it fits (2^64 at 30)", () => {
    expect(markOf(exact("1267650600228229401496703205376"), STD)).toEqual({ mark: "≈" });
    expect(markOf(exact("18446744073709551616"), { format: "STD", digits: 30 })).toEqual({ mark: "=" });
    expect(markOf(exact("1e600"), STD)).toEqual({ mark: "=" });
  });
  it("a non-rational value is ≈ when enough digits are confirmed, ⚠ n when not", () => {
    const f = { value: real("1.41421356237309504880"), exactRational: false, reliableDigits: 20 };
    expect(markOf(f, STD)).toEqual({ mark: "≈" });
    expect(markOf(f, { format: "STD", digits: 30 })).toEqual({ mark: "⚠", n: 20 });
    expect(markOf(f, { format: "FIX", digits: 12, fixed: 25 })).toEqual({ mark: "⚠", n: 20 });
    expect(markOf(f, { format: "FIX", digits: 12, fixed: 4 })).toEqual({ mark: "≈" });
  });
  it("an un-audited float is ⚠ even when its digits agree", () => {
    expect(markOf({ value: real("0.576724807757"), exactRational: false, reliableDigits: 12, warn: "unaudited" }, STD)).toEqual({ mark: "⚠", warn: "unaudited" });
  });
  it("a complex number takes the weaker part; an exact complex shown whole is =", () => {
    expect(markOf({ value: { re: v("11"), im: v("-2") }, exactRational: true, reliableDigits: null }, STD)).toEqual({ mark: "=" });
    expect(markOf({ value: { re: v("0.5"), im: decimalFromRational(1n, 3n) }, exactRational: true, reliableDigits: null }, STD)).toEqual({ mark: "≈" });
  });
  it("a list takes its weakest element's mark; an empty list or a non-number has none", () => {
    expect(markOf({ exactRational: true, reliableDigits: null, items: [quarter, third] }, STD)).toEqual({ mark: "≈" });
    expect(markOf({ exactRational: true, reliableDigits: null, items: [quarter, exact("2")] }, STD)).toEqual({ mark: "=" });
    expect(markOf({ exactRational: false, reliableDigits: 5, items: [quarter, { value: real("0.746824132812"), exactRational: false, reliableDigits: 5 }] }, STD)).toEqual({ mark: "⚠", n: 5 });
    expect(markOf({ exactRational: true, reliableDigits: null, items: [] }, STD)).toBeNull();
    expect(markOf({ exactRational: false, reliableDigits: null }, STD)).toBeNull();
  });
});

describe("formatConfirmed: only confirmed digits are shown", () => {
  const v = (s: string) => decimalFromString(s)!;
  const f = (s: string, reliableDigits: number | null) => ({ value: { re: v(s), im: ZERO_VALUE }, exactRational: false, reliableDigits });
  it("STD, SCI and ENG cut to the confirmed digits", () => {
    expect(formatConfirmed(f("0.746824132812427041600", 11), { format: "STD", digits: 30 })).toBe("0.74682413281");
    expect(formatConfirmed(f("12345.678", 3), { format: "SCI", digits: 6 })).toBe("1.23E4");
    expect(formatConfirmed(f("12345.678", 3), { format: "ENG", digits: 6 })).toBe("12.3E3");
  });
  it("FIX shows fewer decimals, and SCI when not even the integer part is confirmed", () => {
    expect(formatConfirmed(f("123.456789", 5), { format: "FIX", digits: 12, fixed: 4 })).toBe("123.46");
    expect(formatConfirmed(f("123456.789", 3), { format: "FIX", digits: 12, fixed: 2 })).toBe("1.23E5");
  });
  it("lists and matrices", () => {
    const it2 = [f("1.5", null), f("0.333333333333333", 3)];
    expect(formatConfirmed({ exactRational: false, reliableDigits: 3, items: it2 }, { format: "STD", digits: 12 })).toBe("[1.5,0.333]");
    expect(formatConfirmed({ exactRational: false, reliableDigits: 3, items: [...it2, ...it2], shape: [2, 2] }, { format: "STD", digits: 12 })).toBe("[[1.5,0.333],[1.5,0.333]]");
  });
});

describe("confirmedDigits: the agreement check (docs/04 2.4 rule 2)", () => {
  const v = (s: string) => decimalFromString(s)!;
  it("two evaluations of sqrt(2) at 40 and 60 digits confirm 39 digits", () => {
    expect(confirmedDigits(v("1.414213562373095048801688724209698078570"), v("1.41421356237309504880168872420969807856967187537694807317668"), 40)).toBe(39);
  });
  it("a cancellation: UTPN(10) at 40 and 60 digits agrees on 16 digits only (Giac's output, 2026-10-12)", () => {
    expect(confirmedDigits(v("0.7619853024160526047470402485719718202649e-23"), v("0.761985302416052606597334325159930836356760859193473531291124e-23"), 40)).toBe(16);
  });
  it("a double against MPFR (romberg, Giac's output): 11 digits; the 12th could round either way", () => {
    expect(confirmedDigits(v("0.74682413281235"), v("0.7468241328124270416001155918698308916810"), 14)).toBe(11);
  });
  it("values on both sides of a rounding boundary confirm only what rounds alike", () => {
    expect(confirmedDigits(v("0.99999999999999999"), v("1.00000000000000001"), 17)).toBe(16);
  });
  it("two zeros confirm each other; a zero and a non-zero confirm nothing", () => {
    expect(confirmedDigits(ZERO_VALUE, ZERO_VALUE, 40)).toBe(40);
    expect(confirmedDigits(ZERO_VALUE, v("1e-50"), 40)).toBe(0);
  });
});
