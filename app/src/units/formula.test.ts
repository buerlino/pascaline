// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's formula, a slot after every number (docs/04 4.3), read back by the parser's units mode (R28).
import { describe, expect, it } from "vitest";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { slotFormula } from "./formula.ts";

const giac = (latex: string): string => latexToGiacInfo(slotFormula(latex).latex, { units: true }).giac;

describe("slotFormula (R24c)", () => {
  it("an empty line is the quantity 1 with its slot and the end slot", () => {
    expect(slotFormula("")).toEqual({ latex: "1\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
  });
  it("puts a slot after every number, the end slot last", () => {
    expect(slotFormula("72")).toEqual({ latex: "72\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
    expect(slotFormula("0+1").latex).toBe("0\\placeholder[u1]{}+1\\placeholder[u2]{}\\to\\placeholder[end]{}");
    expect(slotFormula("2\\times\\pi\\times25").slots).toEqual(["u1", "u2"]);
    expect(slotFormula("\\frac{3}{2.5}").latex).toBe("\\frac{3\\placeholder[u1]{}}{2.5\\placeholder[u2]{}}\\to\\placeholder[end]{}");
  });
  it("a ± σ belongs to its number: one slot after the σ", () => {
    expect(slotFormula("\\cos\\left(0\\pm0.1\\right)").latex).toBe("\\cos\\left(0\\pm0.1\\placeholder[u1]{}\\right)\\to\\placeholder[end]{}");
    expect(slotFormula("-\\left(20\\pm0.5\\right)").slots).toEqual(["u1"]);
  });
  it("no slot inside a power, a subscript, a name, a chip or a root's index", () => {
    expect(slotFormula("5^{2}").latex).toBe("5^{2}\\placeholder[u1]{}\\to\\placeholder[end]{}");
    expect(slotFormula("x^{3}+x_{2}").slots).toEqual([]);
    expect(slotFormula("x23").slots).toEqual([]);
    expect(slotFormula("\\res{3}{42}\\times2").latex).toBe("\\res{3}{42}\\times2\\placeholder[u1]{}\\to\\placeholder[end]{}");
    expect(slotFormula("\\const{c}{c}").slots).toEqual([]);
    expect(slotFormula("\\sqrt[3]{8}").latex).toBe("\\sqrt[3]{8\\placeholder[u1]{}}\\to\\placeholder[end]{}");
  });
  it("an ᴇ number and a decimal comma are one number", () => {
    expect(slotFormula("1.5\\emark-3").slots).toEqual(["u1"]);
    expect(slotFormula("3{,}25").latex).toBe("3{,}25\\placeholder[u1]{}\\to\\placeholder[end]{}");
  });
  it("the parser's units mode reads every slot as pasu<n> in the order written", () => {
    expect(giac("72")).toBe("72*pasu1");
    expect(giac("0+1")).toBe("0*pasu1+1*pasu2");
    expect(giac("\\cos\\left(0\\pm0.1\\right)")).toBe("cos(pasdeg*(pasupm(0,0.1)*pasu1))"); // (pasdeg: the mode's angle, set by the engine)
    expect(latexToGiacInfo(slotFormula("20").latex, { units: true }).units).toEqual({ slots: ["u1"], consts: [], end: "end" });
  });
});
