// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the comparison of the view sweep on fixed values (tools/probes/sweep/views.ts). F56: Area refused ∫₀¹ ln x where Home shows −1.
import { describe, expect, it } from "vitest";
import { compareViews, comparePlot, decimalToNumber, numView, type View } from "../../tools/probes/sweep/views.ts";

const num = (v: number, claim: number | null = 12): View => ({ kind: "num", v, claim });
const refused: View = { kind: "refused" };

describe("compareViews", () => {
  it("F56: a refusal against Home's −1 is a difference, both ways round", () => {
    expect(compareViews(refused, num(-1))).toMatch(/refuses/);
    expect(compareViews(num(-1), refused)).toMatch(/refuses/);
  });
  it("a matching value, two refusals and a view that is not a real number are not differences", () => {
    expect(compareViews(num(-1), num(-1))).toBeNull();
    expect(compareViews(num(0.972770752471), num(0.972770752472))).toBeNull(); // one unit of the 12th digit
    expect(compareViews(refused, refused)).toBeNull();
    expect(compareViews({ kind: "other" }, num(3))).toBeNull();
  });
  it("a value off by more than the claimed digits is a difference; a bare ⚠ claims none", () => {
    expect(compareViews(num(1.00000001), num(1))).toMatch(/12 digits/);
    expect(compareViews(num(1.01, 4), num(1, 12))).toMatch(/4 digits/);
    expect(compareViews(num(1.001, 3), num(1, 12))).toBeNull();
    expect(compareViews(num(5, null), num(1))).toBeNull();
    expect(compareViews(num(0), num(3e-30))).not.toBeNull();
  });
});

describe("comparePlot", () => {
  it("10⁻⁹ relative where Giac's value is real", () => {
    expect(comparePlot(2.0000000001, 2)).toBeNull();
    expect(comparePlot(2.00001, 2)).toMatch(/against Giac/);
    expect(comparePlot(NaN, 2)).toMatch(/NaN/);
    expect(comparePlot(NaN, NaN)).toBeNull(); // Giac's value is not real: not compared
    expect(comparePlot(1e-17, 0)).toBeNull();
  });
});

describe("numView", () => {
  it("reads a real value, calls a complex one other", () => {
    const re = { neg: true, digits: "125", exp: 0, sticky: false }; // −1.25
    expect(decimalToNumber(re)).toBe(-1.25);
    const z = { digits: "", neg: false, exp: 0, sticky: false };
    expect(numView({ re, im: z }, 12)).toEqual({ kind: "num", v: -1.25, claim: 12 });
    expect(numView({ re, im: { ...re, neg: false } }, 12)).toEqual({ kind: "other" });
  });
});
