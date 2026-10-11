// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key: cycle logic and the display modes. Expected values are `derived` (decimal arithmetic by hand).
import { describe, expect, it } from "vitest";
import { decimalFromRational, type ComplexValue } from "../engine/format.ts";
import {
  DEFAULT_FMT_CYCLE,
  factsOf,
  isApplicable,
  nextMode,
  normalizeCycle,
  renderNumeric,
  type DisplayContext,
  type FmtMode,
  type NumericResult,
} from "./displayMode.ts";

const q = (p: bigint, d = 1n) => decimalFromRational(p, d);
const real = (p: bigint, d = 1n): ComplexValue => ({ re: q(p, d), im: q(0n) });
const ctx: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const third: NumericResult = { value: real(1n, 3n), rational: { n: "1", d: "3" } };

describe("nextMode", () => {
  const facts = factsOf(third);
  it("Home: the default cycle goes Standard, Scientific, Engineering and back", () => {
    const seen: (FmtMode | undefined)[] = [];
    let m: FmtMode | undefined = "std";
    for (let i = 0; i < 4; i++) {
      m = nextMode(m, DEFAULT_FMT_CYCLE, facts, false)?.mode;
      seen.push(m);
    }
    expect(seen).toEqual(["sci", "eng", "std", "sci"]);
  });
  it("Home: a global mode that is not ticked starts at the first ticked one", () => {
    expect(nextMode("fix", ["sci", "eng"], facts, false)).toEqual({ mode: "sci" });
  });
  it("CAS: the exact form is the first step and the cycle returns to it", () => {
    let m: FmtMode | undefined;
    const seen: (FmtMode | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      m = nextMode(m, ["std", "sci"], facts, true)?.mode;
      seen.push(m);
    }
    expect(seen).toEqual(["std", "sci", undefined, "std"]);
  });
  it("skips modes that do not apply to the result", () => {
    const all: FmtMode[] = ["std", "frac", "mixed", "polar"];
    const decimal = factsOf({ value: real(25n, 10n) }); // 2.5 without an exact fraction
    expect(nextMode("std", all, decimal, false)).toEqual({ mode: "std" }); // only std applies
    const complex = factsOf({ value: { re: q(1n), im: q(1n) } });
    expect(nextMode("std", all, complex, false)).toEqual({ mode: "polar" }); // no fractions for a complex number
    expect(nextMode("polar", all, complex, false)).toEqual({ mode: "std" }); // polar and a+b*i alternate
    expect(nextMode("std", all, factsOf(third), false)).toEqual({ mode: "frac" });
  });
  it("nothing to do for a result without a number", () => {
    expect(nextMode(undefined, DEFAULT_FMT_CYCLE, factsOf({}), true)).toBeNull();
  });
});

describe("cycle setting", () => {
  it("is kept in canonical order, and never empty", () => {
    expect(normalizeCycle(["polar", "sci", "bogus", "std"])).toEqual(["std", "sci", "polar"]);
    expect(normalizeCycle([])).toEqual(["std", "sci", "eng"]);
    expect(normalizeCycle(undefined)).toEqual(["std", "sci", "eng"]);
  });
  it("polar is offered only for complex results, fractions only for exact rationals", () => {
    expect(isApplicable("polar", factsOf(third))).toBe(false);
    expect(isApplicable("polar", factsOf({ value: { re: q(1n), im: q(2n) } }))).toBe(true);
    expect(isApplicable("frac", factsOf({ value: real(1n, 3n) }))).toBe(false);
    expect(isApplicable("frac", factsOf({ value: { re: q(1n), im: q(2n) }, rational: { n: "1", d: "1" } }))).toBe(false);
  });
});

describe("renderNumeric", () => {
  it("1/3 in Standard, Scientific, Engineering, Fixed", () => {
    expect(renderNumeric(third, "std", ctx)?.text).toBe("0.333333333333");
    expect(renderNumeric(third, "sci", ctx)?.text).toBe("3.33333333333E-1"); // 12 significant digits
    expect(renderNumeric(third, "eng", ctx)?.text).toBe("333.333333333E-3");
    expect(renderNumeric(third, "fix", ctx)?.text).toBe("0.3333");
    expect(renderNumeric(third, undefined, { ...ctx, format: "sci" })?.text).toBe("3.33333333333E-1");
  });
  it("draws the exponent raised and fractions stacked", () => {
    expect(renderNumeric(third, "sci", ctx)?.latex).toBe("3.33333333333\\times10^{-1}");
    expect(renderNumeric(third, "frac", ctx)).toEqual({ text: "1/3", latex: "\\frac{1}{3}" });
    const seven3: NumericResult = { value: real(-7n, 3n), rational: { n: "-7", d: "3" } };
    expect(renderNumeric(seven3, "mixed", ctx)).toEqual({ text: "-2 1/3", latex: "-2\\frac{1}{3}" });
  });
  it("a complex result: a+b*i and, once the engine gave r and theta, polar", () => {
    const z: NumericResult = { value: { re: q(3n), im: q(1n) } };
    expect(renderNumeric(z, "std", ctx)).toEqual({ text: "3+i", latex: "3+\\mathrm{i}" }); // regression: 3+1*i
    const polar = { ...z, polar: { r: q(5n), theta: q(1n, 2n), angle: "rad" as const } };
    expect(renderNumeric(polar, "polar", ctx)).toEqual({
      text: "5∡0.5",
      latex: "5\\mathbin{\\measuredangle}0.5",
    });
    // an angle computed for the other unit is not shown
    expect(renderNumeric(polar, "polar", { ...ctx, angle: "deg" })?.text).toBe("3+i");
  });
});
