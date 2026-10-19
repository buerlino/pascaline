// SPDX-License-Identifier: GPL-3.0-or-later
// Expected values are derived (mathematically provable decimal expansions) or follow docs/04 section 2.6 literally.
import { describe, expect, it } from "vitest";
import { decimalFromRational, decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import { complexText, copyExact, copyFull, copyMark, entryText, realText, sessionText, tableCsv, withoutMark, type CopySource } from "./text.ts";

const re = (s: string): ComplexValue => ({ re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE });
const ratio = (p: bigint, q: bigint): ComplexValue => ({ re: decimalFromRational(p, q), im: ZERO_VALUE });
const done = (o: Partial<CopySource>): CopySource => ({ latex: "x", status: "done", text: "", ...o });

describe("realText: every confirmed digit, plain between 1E-4 and 1E21", () => {
  it("writes 1/3 and 2/3 with 40 digits, the last one rounded", () => {
    expect(realText(decimalFromRational(1n, 3n), 40)).toBe("0." + "3".repeat(40));
  });
  it("copies an exact 2/3 rounded from the 41st digit, not cut", () => {
    const two3 = done({ full: "2/3", fullExact: true, value: ratio(2n, 3n), rational: { n: "2", d: "3" }, text: "0.666666666667" });
    expect(copyFull(two3)).toBe("0." + "6".repeat(39) + "7");
    expect(copyFull(done({ full: "-1/8", fullExact: true, value: ratio(-1n, 8n), rational: { n: "-1", d: "8" } }))).toBe("-0.125");
  });
  it("drops trailing zeros and keeps the sign", () => {
    expect(realText(decimalFromString("1.50") ?? ZERO_VALUE, 40)).toBe("1.5");
    expect(realText(decimalFromString("-1200") ?? ZERO_VALUE, 40)).toBe("-1200");
    expect(realText(ZERO_VALUE, 40)).toBe("0");
  });
  it("switches to d.ddd E±k exactly at 1E-4 and 1E21", () => {
    expect(realText(decimalFromString("0.0001") ?? ZERO_VALUE, 40)).toBe("0.0001");
    expect(realText(decimalFromString("0.00009999") ?? ZERO_VALUE, 40)).toBe("9.999E-5");
    expect(realText(decimalFromString("1e-5") ?? ZERO_VALUE, 40)).toBe("1E-5");
    expect(realText(decimalFromString("1e20") ?? ZERO_VALUE, 40)).toBe("100000000000000000000");
    expect(realText(decimalFromString("1e21") ?? ZERO_VALUE, 40)).toBe("1E21");
    expect(realText(decimalFromString("-6.02214076e23") ?? ZERO_VALUE, 40)).toBe("-6.02214076E23");
  });
  it("rounds to the confirmed digits only", () => {
    expect(realText(decimalFromString("3.14159265358979") ?? ZERO_VALUE, 5)).toBe("3.1416");
    expect(realText(decimalFromString("0.99999") ?? ZERO_VALUE, 3)).toBe("1");
  });
  it("uses the decimal comma on request", () => {
    expect(realText(decimalFromString("1.5") ?? ZERO_VALUE, 40, { decimalComma: true })).toBe("1,5");
    expect(realText(decimalFromString("1.5e-7") ?? ZERO_VALUE, 40, { decimalComma: true })).toBe("1,5E-7");
  });
});

describe("complexText: a+b*i", () => {
  const z = (a: string, b: string): ComplexValue => ({ re: decimalFromString(a) ?? ZERO_VALUE, im: decimalFromString(b) ?? ZERO_VALUE });
  it("writes both parts, i for 1", () => {
    expect(complexText(z("1.5", "-2"), 40)).toBe("1.5-2*i");
    expect(complexText(z("0", "1"), 40)).toBe("i");
    expect(complexText(z("0", "-1"), 40)).toBe("-i");
    expect(complexText(z("2", "1"), 40)).toBe("2+i");
    expect(complexText(z("0", "2.5"), 40)).toBe("2.5*i");
  });
});

describe("copyFull", () => {
  it("copies 1/3 as 40 digits and an exact integer in full", () => {
    expect(copyFull(done({ full: "1/3", fullExact: true, value: ratio(1n, 3n), rational: { n: "1", d: "3" }, text: "0.333333333333" }))).toBe("0." + "3".repeat(40));
    const big = "1" + "0".repeat(60);
    expect(copyFull(done({ full: big, fullExact: true, text: "1E60" }))).toBe(big);
  });
  it("copies only the confirmed digits of an approximate result", () => {
    const v = re("1.41421356237309504880168872420969807856967");
    expect(copyFull(done({ full: "1.414213562373095", fullExact: false, value: v, reliableDigits: 16 }))).toBe("1.414213562373095");
    // ⚠ 5: the engine's full value is already cut, and the value path cuts too
    expect(copyFull(done({ value: v, reliableDigits: 5 }))).toBe("1.4142");
  });
  it("uses a CAS float's own digits, with E written as the spec says", () => {
    expect(copyFull(done({ full: "2.5E-7", fullExact: false, text: "2.5E-7" }))).toBe("2.5E-7");
    expect(copyFull(done({ full: "0.00001234", fullExact: false, text: "1.234E-5" }))).toBe("1.234E-5");
  });
  it("leaves non-numbers as the engine wrote them", () => {
    expect(copyFull(done({ text: "sqrt(2)", full: "sqrt(2)", fullExact: true }))).toBe("sqrt(2)");
    expect(copyFull(done({ text: "[1,2]", full: "[1,2]", fullExact: true }))).toBe("[1,2]");
  });
  it("copies nothing from a pending or failed entry", () => {
    expect(copyFull(done({ status: "pending", text: "" }))).toBeUndefined();
    expect(copyFull(done({ status: "error", text: "Syntax error" }))).toBeUndefined();
  });
});

describe("copyExact, withoutMark", () => {
  it("gives Giac's exact text, or nothing for digits", () => {
    expect(copyExact(done({ rational: { n: "1", d: "3" }, full: "1/3", fullExact: true }))).toBe("1/3");
    expect(copyExact(done({ rational: { n: "7", d: "1" }, full: "7", fullExact: true }))).toBe("7");
    expect(copyExact(done({ full: "sqrt(2)", fullExact: true }))).toBe("sqrt(2)");
    expect(copyExact(done({ full: "1.414", fullExact: false }))).toBeUndefined();
  });
  it("takes the mark off the shown text", () => {
    expect(withoutMark("⚠ 1.4142")).toBe("1.4142");
    expect(withoutMark("≈ 0.333333333333")).toBe("0.333333333333");
    expect(withoutMark("⚠ 5 1.4142")).toBe("1.4142");
    expect(withoutMark("= 0.5")).toBe("0.5");
    expect(withoutMark("0.5")).toBe("0.5");
    expect(withoutMark("-0.5")).toBe("-0.5");
  });
});

describe("copyMark", () => {
  it("= for an exact rational shown in full, ≈ for 1/3, ⚠ n for fewer confirmed digits", () => {
    expect(copyMark(done({ value: re("0.5"), exactRational: true, rational: { n: "1", d: "2" } }))).toEqual({ mark: "=" });
    expect(copyMark(done({ value: ratio(1n, 3n), exactRational: true, rational: { n: "1", d: "3" } }))).toEqual({ mark: "≈" });
    expect(copyMark(done({ value: re("1.414213562373095049"), exactRational: false, reliableDigits: 19 }))).toEqual({ mark: "≈" });
    expect(copyMark(done({ value: re("1.4142135623730950488"), reliableDigits: 5 }))).toEqual({ mark: "⚠", n: 5 });
    expect(copyMark(done({ value: re("1.5"), reliableDigits: 40, warn: "unaudited" }))).toEqual({ mark: "⚠", warn: "unaudited" });
  });
  it("no mark for something that is not a number", () => {
    expect(copyMark(done({ text: "sqrt(2)" }))).toBeUndefined();
  });
});

describe("sessionText", () => {
  it("writes one line per finished entry: input, mark, full value", () => {
    const items: CopySource[] = [
      done({ latex: "\\frac12", text: "0.5", full: "1/2", fullExact: true, value: re("0.5"), exactRational: true, rational: { n: "1", d: "2" } }),
      done({ latex: "\\frac{1}{3}", text: "0.333", full: "1/3", fullExact: true, value: ratio(1n, 3n), exactRational: true, rational: { n: "1", d: "3" } }),
      done({ latex: "\\sqrt{2}", text: "1.41421356237", full: "1.4142135623730950488", fullExact: false, value: re("1.4142135623730950488"), reliableDigits: 5 }),
      done({ latex: "1+", status: "error", text: "Syntax error" }),
      done({ latex: "2", status: "pending" }),
    ];
    expect(sessionText(items).split("\n")).toEqual([
      "1/2 = 0.5",
      "1/3 ≈ 0." + "3".repeat(40),
      "sqrt(2) ⚠ 5 1.4142",
      "1+ → Syntax error",
    ]);
  });
  it("is empty when nothing finished", () => {
    expect(sessionText([done({ status: "pending" })])).toBe("");
  });
});

describe("entryText", () => {
  it("reads as plain text", () => {
    expect(entryText("2\\times\\left(3+4\\right)")).toBe("2×(3+4)");
    expect(entryText("x^{2}+\\frac{1}{x}")).toBe("x^2+1/x");
    expect(entryText("\\frac{a+1}{b}^{-1}")).toBe("(a+1)/b^-1");
    expect(entryText("\\frac13")).toBe("1/3");
    expect(entryText("\\res{1}{0.5}+\\ans")).toBe("0.5+Ans");
  });
});

describe("tableCsv", () => {
  it("writes a header and rows with CRLF line ends", () => {
    expect(tableCsv(["x", "F1"], [["0", "1"], ["0.5", "0.25"]])).toBe("x,F1\r\n0,1\r\n0.5,0.25\r\n");
  });
  it("uses ; with the decimal comma and quotes what needs it", () => {
    expect(tableCsv(["x", "a;b"], [["0,5", 'say "hi"']], { decimalComma: true })).toBe('x;"a;b"\r\n0,5;"say ""hi"""\r\n');
  });
});

describe("G46f1: a DEG result copies the text drawn, not the radian full", () => {
  const item = done({ text: "pi/180*cos(x)", full: "pi/180*cos(pi/180*x)", fullExact: true, drawn: "pi/180*cos(x)" });
  it("copyFull and copyExact give the drawn text; sessionText too", () => {
    expect(copyFull(item)).toBe("pi/180*cos(x)");
    expect(copyExact(item)).toBe("pi/180*cos(x)");
    expect(sessionText([item])).toContain("pi/180*cos(x)");
    expect(sessionText([item])).not.toContain("pi/180*x");
  });
  it("without drawn nothing changes (RAD)", () => {
    expect(copyFull({ ...item, drawn: undefined })).toBe("pi/180*cos(pi/180*x)");
    expect(copyExact({ ...item, drawn: undefined })).toBe("pi/180*cos(pi/180*x)");
  });
});
