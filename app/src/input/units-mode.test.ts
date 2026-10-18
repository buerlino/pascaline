// SPDX-License-Identifier: GPL-3.0-or-later
// R28: the parser's units mode (docs/04 4.3). The formulas and their Giac text through G16's builder are golden cases
// (tests/golden/parser.yaml, group units); this file checks what the mode reports besides the text.
import { describe, expect, it } from "vitest";
import { latexToGiacInfo } from "./latex-to-giac.ts";

const units = (latex: string) => latexToGiacInfo(latex, { units: true });

describe("units mode (R28)", () => {
  it("a minus before a ± value goes inside its pasupm call; a double minus cancels", () => {
    expect(units("-20\\pm0.5\\placeholder[u1]{}").giac).toBe("pasupm(-20,0.5)*pasu1");
    expect(units("--20\\pm0.5\\placeholder[u1]{}").giac).toBe("pasupm(20,0.5)*pasu1");
    expect(latexToGiacInfo("-20\\placeholder[u1]{}", { units: true }).giac).toBe("-20*pasu1");
  });
  it("names the slots in the order written, whatever their ids", () => {
    const r = units("3\\placeholder[u2]{\\mathrm{m}}+4\\placeholder[u1]{}");
    expect(r.giac).toBe("3*pasu1+4*pasu2");
    expect(r.units).toEqual({ slots: ["u2", "u1"], consts: [] });
  });
  it("a constant is pask<j>, once per id, and needs no chip value", () => {
    const r = units("\\const{G}{G}\\times\\const{c}{c}\\times\\const{G}{G}");
    expect(r.giac).toBe("(pask1*pask2)*pask1");
    expect(r.units?.consts).toEqual(["G", "c"]);
    expect(r.inexact).toBe(false);
  });
  it("the end slot after → is not a slot", () => {
    const r = units("5\\placeholder[u1]{}\\to\\placeholder[end]{\\frac{\\mathrm{m}}{\\mathrm{s}}}");
    expect(r.giac).toBe("5*pasu1");
    expect(r.units).toEqual({ slots: ["u1"], consts: [], end: "end" });
  });
  it("outside units mode nothing changes: → is the function arrow, a constant is its chip, a prompt is refused", () => {
    expect(latexToGiacInfo("x\\to x^2").giac).toBe("(x)->x^2");
    expect(latexToGiacInfo("2\\const{c}{c}", { chips: { "const:c": { value: "299792458", exact: true } } })).toEqual({ giac: "2*(299792458)", inexact: false });
    expect(() => latexToGiacInfo("72\\placeholder[u1]{}")).toThrow(/unexpected token at 'placeholder'/);
    expect(() => latexToGiacInfo("12.34\\pm0.05")).toThrow(/unexpected token at 'pm'/);
  });
  it("says why a slot, a ± or a → is refused", () => {
    expect(() => units("x\\placeholder[u1]{}")).toThrow("a unit slot goes right after a number");
    expect(() => units("\\pm1")).toThrow("± goes right after a number");
    expect(() => units("5\\pm x")).toThrow("± needs a plain number after it");
    expect(() => units("5\\placeholder[u1]{}\\to")).toThrow("→ needs the end slot after it");
    expect(() => units("5\\placeholder[u1]{}+6\\placeholder[u1]{}")).toThrow("unit slot u1 appears twice");
  });
});
