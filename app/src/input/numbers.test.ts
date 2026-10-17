// SPDX-License-Identifier: GPL-3.0-or-later
// Where a number ends (R29, backlog F24 and F25): a second decimal point inside a number, and a number beside a
// result chip, are errors with a message that names the fix, never a silent product. The values of the kept forms
// are checked by Giac in tests/golden/parser.yaml (groups "decimals", "l6" and "chips"); here the messages and the
// Giac text, with no engine.
import { describe, expect, it } from "vitest";
import type { ChipTable } from "./chips.ts";
import { SerializeError } from "./emit.ts";
import { latexToGiac } from "./latex-to-giac.ts";

const CHIPS: ChipTable = {
  "res:1": { value: "1/2", exact: true },
  "res:2": { value: "1/4", exact: true },
  ans: { value: "7", exact: true },
  "const:c": { value: "299792458", exact: true },
};
const giac = (latex: string, decimalComma = false): string => latexToGiac(latex, { chips: CHIPS, decimalComma });
const message = (latex: string, decimalComma = false): string => {
  try {
    giac(latex, decimalComma);
  } catch (e) {
    if (e instanceof SerializeError) return e.message;
    throw e;
  }
  return "accepted";
};

describe("a number has one decimal point (F24)", () => {
  it.each(["2.5.3", "1..5", ".5.5", "1.5.", "12.5.25"])("%s is an error", (latex) => {
    expect(message(latex)).toMatch(/^a number has one decimal point/);
  });
  it.each([
    ["2{,}5.3", "a number has one decimal point"],
    ["\\max\\left(2,5,3\\right)", "a number has one decimal comma"],
    ["\\max\\left(2.5,3\\right)", "a number has one decimal comma"],
    ["2{,}5{,}3", "a number has one decimal comma"],
    ["1,5{,}2", "a number has one decimal comma"],
  ])("with the decimal comma, %s is an error", (latex, msg) => {
    expect(message(latex, true)).toMatch(new RegExp(`^${msg}`));
  });
  it.each([
    ["5.", "5."],
    [".5", ".5"],
    ["2.5\\times.3", "2.5*.3"],
    ["5.\\times.5", "5.*.5"],
    ["\\left(2\\right)3", "(2)*3"],
    ["2\\pi", "2*pi"],
    ["3x", "3*x"],
    ["1.5\\emark-3", "1.5e-3"],
  ])("%s is kept as %s", (latex, out) => {
    expect(giac(latex)).toBe(out);
  });
  it("with the decimal comma, one comma and ; between arguments are kept", () => {
    expect(giac("\\max\\left(1{,}5;2\\right)", true)).toBe("max(1.5,2)");
    expect(giac("\\max\\left(2.5;3\\right)", true)).toBe("max(2.5,3)");
  });
  it("with the decimal point, a comma after a decimal is the argument separator", () => {
    expect(giac("\\max\\left(2.5,3\\right)")).toBe("max(2.5,3)");
  });
});

describe("a number beside a result chip (F25)", () => {
  it.each([
    "\\res{1}{0.5}3",
    "3\\res{1}{0.5}",
    "\\res{1}{0.5}.5",
    "2\\res{1}{\\frac{\\sqrt{2}}{2}}",
    "1\\emark3\\res{1}{0.5}",
    "x^{\\res{1}{0.5}3}",
    "-\\res{1}{0.5}3",
  ])("%s is an error", (latex) => {
    expect(message(latex)).toBe("put × between a result and a number");
  });
  it("with the decimal comma too", () => {
    expect(message("\\res{1}{0{,}5}3", true)).toBe("put × between a result and a number");
  });
  it("two result chips side by side are an error", () => {
    expect(message("\\res{1}{0.5}\\res{2}{0.25}")).toBe("put × between two results");
  });
  it.each(["\\sin2\\res{1}{0.5}", "\\sin\\res{1}{0.5}3", "\\ln2\\res{1}{0.5}"])(
    "in a function's bare argument, %s is an error",
    (latex) => {
      expect(message(latex)).toBe("put × between a result and a number");
    },
  );
  it("two result chips in a function's bare argument are an error", () => {
    expect(message("\\cos\\res{1}{0.5}\\res{2}{0.25}")).toBe("put × between two results");
  });
  it.each([
    ["\\res{1}{0.5}\\times3", "(1/2)*3"],
    ["3\\times\\res{1}{0.5}", "3*(1/2)"],
    ["\\res{1}{0.5}\\times\\res{2}{0.25}", "(1/2)*(1/4)"],
    ["\\res{1}{0.5}x", "(1/2)*x"],
    ["\\res{1}{0.5}^{2}", "(1/2)^2"],
    ["\\frac{\\res{1}{0.25}}{2}", "(1/2)/2"],
    ["\\ans3", "(7)*3"],
    ["2\\ans", "2*(7)"],
    ["\\sin2\\ans", "sin(2*(7))"],
    ["2\\const{c}{c}", "2*(299792458)"],
  ])("%s is kept as %s", (latex, out) => {
    expect(giac(latex)).toBe(out);
  });
});
