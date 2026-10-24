// SPDX-License-Identifier: GPL-3.0-or-later
// G89: the exporter of our golden cases as a Giac regression file (tools/giac-regress/export.mjs), on three fixed cases.
import { describe, expect, it } from "vitest";
// @ts-expect-error a plain .mjs tool without types
import { caseLine, expectedExact, halfUnit } from "../../tools/giac-regress/export.mjs";

type Out = { comment: string; line: string } | { leftOut: string };

describe("giac-regress exporter", () => {
  it("an exact rational at 12 digits", () => {
    const c = { id: "trap-0.1+0.2", input: "0.1+0.2", expect: "0.3", mark: "=", source: "derived" };
    expect(caseLine(c, "home.yaml") as Out).toEqual({
      comment: "// trap-0.1+0.2 (home.yaml, derived)",
      line: 'Digits:=40:; pc("trap-0.1+0.2",((1/10^1)+(2/10^1)),(3/10^1),5/10^13);',
    });
  });

  it("a 12-digit ≈ whose value is tiny (cancellation)", () => {
    const c = { id: "trap-22/7-approx", input: "22/7-3.142857142857", expect: "1.42857142857E-13", mark: "≈", source: "oracle" };
    expect(caseLine(c, "home.yaml") as Out).toEqual({
      comment: "// trap-22/7-approx (home.yaml, oracle)",
      line: 'Digits:=40:; pc("trap-22/7-approx",(22/7-(3142857142857/10^12)),(142857142857/10^24),5/10^25);',
    });
  });

  it("a 30-digit precision.yaml case", () => {
    const c = { id: "prec-30-sqrt2", input: "sqrt(2)", settings: { digits: 30 }, expect: "1.41421356237309504880168872421", mark: "≈", source: "oracle" };
    expect(caseLine(c, "precision.yaml") as Out).toEqual({
      comment: "// prec-30-sqrt2 (precision.yaml, oracle)",
      line: 'Digits:=40:; pc("prec-30-sqrt2",(sqrt(2)),(141421356237309504880168872421/10^29),5/10^30);',
    });
  });

  it("a home.yaml case ignores settings.digits (the home stage evaluates at 12)", () => {
    const c = { id: "h30", input: "normald_icdf(0.975)", settings: { digits: 30 }, expect: "1.95996398454", mark: "≈", source: "derived" };
    expect((caseLine(c, "home.yaml") as { line: string }).line).toMatch(/,5\/10\^12\);$/);
  });

  it("leaves out what depends on our layer, with the reason", () => {
    const left = (c: object) => (caseLine({ id: "x", source: "derived", ...c }, "home.yaml") as { leftOut: string }).leftOut;
    expect(left({ latex: "1", expect: "1" })).toMatch(/LaTeX/);
    expect(left({ input: "1/0", expect: "Division by zero" })).toMatch(/not a number/);
    expect(left({ input: "sin(30)", settings: { angle: "deg" }, expect: "0.5" })).toMatch(/angle/);
    expect(left({ input: "1", source: "device", expect: "1" })).toMatch(/source/);
    expect(left({ input: "par(1,2)", expect: "0.666666666667" })).toMatch(/definition/);
    expect(left({ input: "1", mark: "⚠" })).toMatch(/mark only/);
    expect(left({ input: "123456789012.5", oracle: "F('123456789012.5')", expect: "123456789013" })).toBe("rounding text (our layer)");
    expect(left({ input: "1.5", oracle: "F('1.5')", expect: "1.5" })).toBe("rounding text (our layer)");
  });

  it("the shown text as exact Giac text and its half unit", () => {
    expect(expectedExact("11-2*i")).toBe("11-2*i");
    expect(expectedExact("-0.5-0.5*i")).toBe("-(5/10^1)-(5/10^1)*i");
    expect(expectedExact("1E-5")).toBe("(1/10^5)");
    expect(expectedExact("1.5E300")).toBe("(15*10^299)");
    expect(halfUnit("9.81", 12)).toBe("5/10^12");
    expect(halfUnit("1E12", 12)).toBe("5*10^0");
  });
});
