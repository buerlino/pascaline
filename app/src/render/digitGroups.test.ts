// SPDX-License-Identifier: GPL-3.0-or-later
// R55: digit groups in a drawn result. Expected values are `derived` (groups of three from the decimal point outward).
import { describe, expect, it } from "vitest";
import { decimalFromRational, type ComplexValue } from "../engine/format.ts";
import { commaResult, renderNumeric, type DisplayContext, type NumericResult } from "../state/displayMode.ts";
import { groupDigits, groupText } from "./home.ts";

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

describe("groupText (R120, the unit view)", () => {
  it("groups each number of a line on its own, with a thin space: a later integer from the left of its point", () => {
    expect(groupText("39.488 · σ 1.24433958387572")).toBe("39.488 · σ 1.244\u2009339\u2009583\u2009875\u200972");
    expect(groupText("1.0000 ± 12345678")).toBe("1.0000 ± 12\u2009345\u2009678");
    expect(groupText("1.5E-12 m")).toBe("1.5E-12 m");
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
