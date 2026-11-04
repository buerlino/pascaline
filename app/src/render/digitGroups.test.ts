// SPDX-License-Identifier: GPL-3.0-or-later
// R55: digit groups in a drawn result. Expected values are `derived` (groups of three from the decimal point outward).
import { describe, expect, it } from "vitest";
import { decimalFromRational, type ComplexValue } from "../engine/format.ts";
import { commaResult, renderNumeric, type DisplayContext, type NumericResult } from "../state/displayMode.ts";
import { groupMarked, groupText } from "./groupText.ts";
import { GROUP_LATEX, groupDigits, groupSepFor } from "./home.ts";

const q = (p: bigint, d = 1n) => decimalFromRational(p, d);
const real = (p: bigint, d = 1n): ComplexValue => ({ re: q(p, d), im: q(0n) });
const ctx: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const latexOf = (r: NumericResult, mode: Parameters<typeof renderNumeric>[1] = "std", c = ctx): string | undefined =>
  renderNumeric(r, mode, c, true)?.latex;

describe("groupDigits", () => {
  it("groups both sides from the point, only on a side of five or more digits", () => {
    expect(groupDigits("0.333333333333")).toBe("0.333\\,333\\,333\\,333");
    expect(groupDigits("13983816")).toBe("13\\,983\\,816");
    expect(groupDigits("12345.6789")).toBe("12\\,345.6789");
    expect(groupDigits("1234")).toBe("1234");
    expect(groupDigits("0.1234")).toBe("0.1234");
    expect(groupDigits("1.034")).toBe("1.034");
    expect(groupDigits("0.000123")).toBe("0.000\\,123");
    expect(groupDigits("0.000123 45".replace(" ", ""))).toBe("0.000\\,123\\,45");
    expect(groupDigits("123456.12345")).toBe("123\\,456.123\\,45");
  });
});

describe("groupDigits with a separator (R125)", () => {
  it("the thin space (the default, R55's), the apostrophe and the comma, with the point", () => {
    expect(groupDigits("1234567.89", "\\,")).toBe("1\\,234\\,567.89");
    expect(groupDigits("1234567.89", "'")).toBe("1'234'567.89");
    expect(groupDigits("1234567.89", ",")).toBe("1,234,567.89");
    expect(groupDigits("1234567.89", "'", false)).toBe("1'234'567.89");
    expect(groupDigits("0.000123456", "'")).toBe("0.000'123'456");
    expect(groupDigits("1234", "'")).toBe("1234");
  });
  it("R125f1: with both false only the digits before the point are grouped (the apostrophe, the comma)", () => {
    expect(groupDigits("3.14159265359", "'", false)).toBe("3.14159265359");
    expect(groupDigits("1234567.891234", ",", false)).toBe("1,234,567.891234");
    expect(groupDigits("1234567.891234", "'", false)).toBe("1'234'567.891234");
    expect(groupDigits("0.000123456789", ",", false)).toBe("0.000123456789");
    expect(groupDigits("1234567.891234", "\\,")).toBe("1\\,234\\,567.891\\,234"); // the thin space: both sides
  });
  it("as drawn: each separator's LaTeX (the apostrophe as text, the comma with no space after it)", () => {
    expect(GROUP_LATEX).toEqual({ thin: "\\,", apos: "\\text{'}", comma: "{,}" });
    expect(latexOf({ value: real(123456789n) }, "std", { ...ctx, groupSep: "apos" })).toBe("123\\text{'}456\\text{'}789");
    expect(latexOf({ value: real(123456789n, 100n) }, "std", { ...ctx, groupSep: "comma" })).toBe("1{,}234{,}567.89");
    expect(latexOf({ value: real(123456789n) }, "std", { ...ctx, groupSep: "thin" })).toBe("123\\,456\\,789");
    expect(renderNumeric({ value: real(123456789n) }, "std", { ...ctx, groupSep: "apos" })?.latex).toBe("123456789"); // not asked: plain
  });
  it("with the decimal comma the comma is never a separator: a stored comma draws as the thin space", () => {
    expect(groupSepFor("comma", true)).toBe("thin");
    expect(groupSepFor("comma", false)).toBe("comma");
    expect(groupSepFor("apos", true)).toBe("apos");
    expect(groupSepFor(undefined, false)).toBe("thin");
    const out = renderNumeric({ value: real(123456789n, 100n) }, "std", { ...ctx, decimalComma: true, groupSep: "comma" }, true);
    expect(out?.latex).toBe("1\\,234\\,567{,}89");
    expect(out?.text).toBe("1234567,89");
    const apos = renderNumeric({ value: real(123456789n, 100n) }, "std", { ...ctx, decimalComma: true, groupSep: "apos" }, true);
    expect(apos?.latex).toBe("1\\text{'}234\\text{'}567{,}89");
  });
  it("R125f1: only the digits before the point with ’ or , (pi, a decimal, a mantissa in Scientific); the thin space both sides", () => {
    const pi = real(314159265359n, 100000000000n);
    const dec = real(123456789123n, 100000n);
    const small = real(123456789n, 10n ** 12n);
    expect(latexOf({ value: pi }, "std", { ...ctx, groupSep: "comma" })).toBe("3.14159265359");
    expect(latexOf({ value: pi }, "std", { ...ctx, groupSep: "apos" })).toBe("3.14159265359");
    expect(latexOf({ value: pi }, "std", { ...ctx, groupSep: "thin" })).toBe("3.141\\,592\\,653\\,59");
    expect(latexOf({ value: dec }, "std", { ...ctx, groupSep: "comma" })).toBe("1{,}234{,}567.89123");
    expect(latexOf({ value: dec }, "std", { ...ctx, groupSep: "apos" })).toBe("1\\text{'}234\\text{'}567.89123");
    expect(latexOf({ value: small }, "std", { ...ctx, groupSep: "comma" })).toBe("0.000123456789");
    expect(latexOf({ value: small }, "std", { ...ctx, groupSep: "thin" })).toBe("0.000\\,123\\,456\\,789");
    expect(latexOf({ value: real(1n, 3n) }, "sci", { ...ctx, groupSep: "apos" })).toBe("3.33333333333\\times10^{-1}");
    expect(latexOf({ value: real(123456789123n) }, "sci", { ...ctx, groupSep: "comma" })).toBe("1.23456789123\\times10^{11}");
    // the decimal comma: a stored comma draws as the thin space, so both sides
    const dc = renderNumeric({ value: pi }, "std", { ...ctx, decimalComma: true, groupSep: "comma" }, true);
    expect(dc?.latex).toBe("3{,}141\\,592\\,653\\,59");
  });
});

describe("groupText (R120, the unit view)", () => {
  it("groups each number of a line on its own, with a thin space: a later integer from the left of its point", () => {
    expect(groupText("39.488 · σ 1.24433958387572")).toBe("39.488 · σ 1.244\u2009339\u2009583\u2009875\u200972");
    expect(groupText("1.0000 ± 12345678")).toBe("1.0000 ± 12\u2009345\u2009678");
    expect(groupText("1.5E-12 m")).toBe("1.5E-12 m");
  });
  it("R125: with the separator set, the apostrophe as drawn (’) or the comma; the thin space by default", () => {
    expect(groupText("1.0000 ± 12345678", "apos")).toBe("1.0000 ± 12’345’678");
    expect(groupText("1234567.5 m", "comma")).toBe("1,234,567.5 m");
    expect(groupText("1234567.5 m", "thin")).toBe("1\u2009234\u2009567.5 m");
  });
  it("R125f1: ’ and , group only the digits before the point; the thin space both sides", () => {
    expect(groupText("3.14159265359", "comma")).toBe("3.14159265359");
    expect(groupText("3.14159265359", "apos")).toBe("3.14159265359");
    expect(groupText("1234567.891234", "comma")).toBe("1,234,567.891234");
    expect(groupText("1234567.891234", "apos")).toBe("1’234’567.891234");
    expect(groupText("0.000123456789", "comma")).toBe("0.000123456789");
    expect(groupText("3.14159265359", "thin")).toBe("3.141\u2009592\u2009653\u200959");
    expect(groupMarked("3,14159265359", "thin", true)).toBe("3,141\u2009592\u2009653\u200959");
    expect(groupMarked("1234567,891234", "apos", true)).toBe("1’234’567,891234");
    expect(groupMarked("3.14159265359", "comma", false)).toBe("3.14159265359");
  });
});

describe("renderNumeric, grouped", () => {
  it("a real: the text stays plain, the latex has the groups", () => {
    const third: NumericResult = { value: real(1n, 3n) };
    expect(renderNumeric(third, "std", ctx, true)?.text).toBe("0.333333333333");
    expect(latexOf(third)).toBe("0.333\\,333\\,333\\,333");
    expect(renderNumeric(third, "std", ctx)?.latex).toBe("0.333333333333"); // not asked: plain (chips, Copy)
    expect(latexOf({ value: real(13983816n) })).toBe("13\\,983\\,816");
    expect(latexOf({ value: real(1234n) })).toBe("1234");
    expect(latexOf({ value: real(-12345n, 100000000n) })).toBe("-0.000\\,123\\,45");
  });
  it("an exponent is untouched and a short mantissa stays whole", () => {
    expect(latexOf({ value: real(15n, 10n ** 10n) })).toBe("1.5\\times10^{-9}");
    expect(latexOf({ value: real(1034n, 10n ** 8n) })).toBe("1.034\\times10^{-5}");
    expect(latexOf({ value: real(1n, 3n) }, "sci")).toBe("3.333\\,333\\,333\\,33\\times10^{-1}");
  });
  it("both parts of a complex", () => {
    const z: NumericResult = { value: { re: q(13983816n), im: q(1n, 3n) } };
    expect(latexOf(z)).toBe("13\\,983\\,816+0.333\\,333\\,333\\,333\\mathrm{i}");
  });
  it("r and theta of a polar", () => {
    const z: NumericResult = {
      value: { re: q(3n), im: q(1n) },
      polar: { r: q(1n, 3n), theta: q(12345n), angle: "rad" },
    };
    expect(latexOf(z, "polar")).toBe("0.333\\,333\\,333\\,333\\mathbin{\\measuredangle}12\\,345");
  });
  it("the decimal comma keeps the thin spaces", () => {
    const out = renderNumeric({ value: real(1n, 3n) }, "std", { ...ctx, decimalComma: true }, true);
    expect(out?.latex).toBe("0{,}333\\,333\\,333\\,333");
    expect(commaResult("12\\,345.5", true)).toBe("12\\,345{,}5");
  });
});
