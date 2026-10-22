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
  nextForm,
  markFor,
  markText,
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
  it("skips modes that do not apply to the result (nextMode itself still knows every mode)", () => {
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
    // the Format key keeps notations only; fraction, mixed and polar are a b/c's forms (R10)
    expect(normalizeCycle(["polar", "sci", "bogus", "std"])).toEqual(["std", "sci"]);
    expect(normalizeCycle([])).toEqual(["std", "sci", "eng"]);
    expect(normalizeCycle(undefined)).toEqual(["std", "sci", "eng"]);
  });
});

// The a b/c key (R10): one toggle per result type (P12): decimal ↔ fraction as on the G2 (2.5 ↔ 5/2, owner
// 2026-10-13), a+bi ↔ polar.
describe("a b/c forms", () => {
  const twoAndHalf = factsOf({ value: real(25n, 10n), rational: { n: "5", d: "2" } });
  const seven3 = factsOf({ value: real(-7n, 3n), rational: { n: "-7", d: "3" } });
  const five = factsOf({ value: real(5n, 1n), rational: { n: "5", d: "1" } });
  const complex = factsOf({ value: { re: q(1n), im: q(1n) } });
  it("Home: decimal ↔ fraction, never a mixed number (the mixed number is a Tmpl template)", () => {
    expect(nextForm(undefined, twoAndHalf, false)).toEqual({ form: "frac" });
    expect(nextForm("frac", twoAndHalf, false)).toEqual({ form: undefined });
    expect(nextForm(undefined, seven3, false)).toEqual({ form: "frac" });
    expect(nextForm("frac", seven3, false)).toEqual({ form: undefined });
  });
  it("complex: a+bi ↔ polar; nothing to switch for a whole number or a symbol", () => {
    expect(nextForm(undefined, complex, false)).toEqual({ form: "polar" });
    expect(nextForm("polar", complex, false)).toEqual({ form: undefined });
    expect(nextForm(undefined, complex, true)).toEqual({ form: "polar" });
    expect(nextForm(undefined, five, false)).toBeNull();
    expect(nextForm(undefined, factsOf({}), false)).toBeNull();
  });
  it("CAS: exact 5/2 ↔ 2.5 (the exact result already is the fraction)", () => {
    expect(nextForm(undefined, twoAndHalf, true)).toEqual({ form: "dec" });
    expect(nextForm("dec", twoAndHalf, true)).toEqual({ form: undefined });
    expect(nextForm(undefined, five, true)).toBeNull();
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

describe("marks and PFX (docs/04 2.4, 2.7)", () => {
  const exact = (r: NumericResult): NumericResult => ({ ...r, facts: { exact: true, reliableDigits: null } });
  const approx = (r: NumericResult, reliableDigits: number | null, warn?: "unaudited"): NumericResult => ({
    ...r,
    facts: { exact: false, reliableDigits, ...(warn ? { warn } : {}) },
  });
  const two = real(2n);

  it("an exact integer shown in full is =", () => {
    expect(markFor(exact({ value: two }), undefined, ctx)).toEqual({ mark: "=" });
  });
  it("an exact third shown as digits is ≈, as a fraction it is =", () => {
    const r = exact(third);
    expect(markFor(r, undefined, ctx)).toEqual({ mark: "≈" });
    expect(markFor(r, "frac", ctx)).toEqual({ mark: "=" });
  });
  it("a float whose digits are confirmed is ≈; fewer confirmed digits give ⚠ n", () => {
    expect(markFor(approx({ value: real(1n, 3n) }, 30), undefined, ctx)).toEqual({ mark: "≈" });
    const m = markFor(approx({ value: real(1n, 3n) }, 7), undefined, ctx);
    expect(m).toEqual({ mark: "⚠", n: 7 });
    expect(markText(m!)).toBe("⚠ 7");
  });
  it("an un-audited float is ⚠ without a count (decisions M4-5)", () => {
    const m = markFor(approx({ value: real(1n, 3n) }, null, "unaudited"), undefined, ctx);
    expect(m).toEqual({ mark: "⚠", warn: "unaudited" });
    expect(markText(m!)).toBe("⚠");
  });
  it("an inexact chip in the input is never = (decisions M4-4)", () => {
    expect(markFor({ ...exact({ value: two }), inexactInput: true }, undefined, ctx)).toEqual({ mark: "≈" });
  });
  it("an item without facts, and a non-number, show no mark", () => {
    expect(markFor({ value: two }, undefined, ctx)).toBeNull();
    expect(markFor(exact({}), undefined, ctx)).toBeNull();
  });
  it("the digits drawn are the confirmed ones only", () => {
    const r = approx({ value: real(1n, 3n) }, 5);
    expect(renderNumeric(r, undefined, ctx)?.text).toBe("0.33333");
  });
  it("30 digits are drawn when asked for", () => {
    const r = exact({ value: real(1n, 3n) });
    expect(renderNumeric(r, undefined, { ...ctx, digits: 30 })?.text).toBe("0." + "3".repeat(30));
  });
  it("PFX draws the prefix after a thin space; the prefix is accented in the LaTeX", () => {
    const r = exact({ value: real(2500n) });
    const out = renderNumeric(r, "pfx", { ...ctx, digits: 4 });
    expect(out?.text).toBe("2.500\u2009k");
    expect(out?.latex).toBe("2.500\\,\\class{pfx}{\\mathrm{k}}");
  });
  it("PFX outside f … P falls back to E notation, and 10^0 has no prefix", () => {
    const c4 = { ...ctx, digits: 4 };
    expect(renderNumeric(exact({ value: real(10n ** 18n) }), "pfx", c4)?.text).toBe("1.000E18");
    expect(renderNumeric(exact({ value: real(5n) }), "pfx", c4)?.text).toBe("5.000");
  });
});

describe("digits the input asked for (CAS evalf(e,n), decisions M4-6)", () => {
  // pi to 52 digits (oracle: tests/golden/precision.yaml prec-M4-6-cas-evalf-pi-50)
  const pi = decimalFromRational(31415926535897932384626433832795028841971693993751058n, 10n ** 52n, 60);
  const r: NumericResult = { value: { re: pi, im: q(0n) }, facts: { exact: false, reliableDigits: 60, digits: 50 } };
  it("draws the result with them, not with the digits setting", () => {
    expect(renderNumeric(r, undefined, ctx)?.text).toBe("3.1415926535897932384626433832795028841971693993751");
    expect(markText(markFor(r, undefined, ctx)!)).toBe("≈");
  });
  it("shows only the confirmed ones when fewer agree", () => {
    const fewer: NumericResult = { ...r, facts: { exact: false, reliableDigits: 20, digits: 50 } };
    expect(renderNumeric(fewer, undefined, ctx)?.text).toBe("3.1415926535897932385");
    expect(markText(markFor(fewer, undefined, ctx)!)).toBe("⚠ 20");
  });
});
