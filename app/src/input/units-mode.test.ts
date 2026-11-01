// SPDX-License-Identifier: GPL-3.0-or-later
// R28: the parser's units mode (docs/04 4.3). The formulas and their Giac text through G16's builder are golden cases
// (tests/golden/parser.yaml, group units); this file checks what the mode reports besides the text.
import { describe, expect, it } from "vitest";
import { actionFor, keyboard } from "../keyboard/keyboard.ts";
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
    expect(() => latexToGiacInfo("12.34\\pm0.05")).toThrow("± is read in the unit view: press the units key");
  });
  it("says why a slot, a ± or a → is refused", () => {
    expect(() => units("x\\placeholder[u1]{}")).toThrow("a unit slot goes right after a number");
    expect(() => units("\\pm1")).toThrow("± goes right after a number");
    expect(() => units("5\\pm x")).toThrow("± needs a plain number after it");
    expect(() => units("5\\placeholder[u1]{}\\to")).toThrow("→ needs the end slot after it");
    expect(() => units("5\\placeholder[u1]{}+6\\placeholder[u1]{}")).toThrow("unit slot u1 appears twice");
  });
  it("R104: ± n % after a number is σ = |value|·n/100 in its unit, a literal σ; elsewhere % keeps its meaning", () => {
    expect(units("250\\pm0.4\\%\\placeholder[u1]{}").giac).toBe("pasupm(250,1)*pasu1");
    expect(units("2\\pm10\\%").giac).toBe("pasupm(2,0.2)");
    expect(units("-2\\pm10\\%").giac).toBe("pasupm(-2,0.2)");
    expect(units("0.004\\pm2.5\\%").giac).toBe("pasupm(0.004,0.0001)");
    expect(units("1.5\\emark3\\pm2\\%\\placeholder[u1]{}").giac).toBe("pasupm(1.5e3,30)*pasu1");
    expect(units("2\\emark-9\\pm1\\%").giac).toBe("pasupm(2e-9,2e-11)");
    expect(units("4.7\\pm5\\emark-1\\%").giac).toBe("pasupm(4.7,0.0235)");
    expect(units("2\\tfrac12\\pm10\\%").giac).toBe("pasupm((2+1/2),(2+1/2)*10/100)");
    expect(units("12\\pm0.5\\placeholder[u1]{}\\%").giac).toBe("pasupm(12,0.5)*pasu1/100");
    expect(() => units("5\\%\\pm1")).toThrow("± goes right after a number"); // a percentage is not a number with a σ
    expect(latexToGiacInfo("5\\%").giac).toBe("5/100");
    expect(() => units("\\pm5\\%")).toThrow("± goes right after a number");
    expect(() => units("5\\pm x\\%\\placeholder[u1]{}")).toThrow("± needs a plain number after it");
  });
  it("R71: the ± key (Shift + `,`) inserts \\pm, which units mode reads as pasupm and every other mode refuses", () => {
    const comma = keyboard.byId.get("comma");
    if (!comma) throw new Error("comma key missing");
    const a = actionFor(comma, true, false);
    expect(a).toMatchObject({ kind: "insert", latex: "\\pm", units: true });
    expect(units(`12.34${(a as { latex: string }).latex}0.05\\placeholder[u1]{}`).giac).toBe("pasupm(12.34,0.05)*pasu1");
    expect(() => latexToGiacInfo("12.34\\pm0.05")).toThrow("± is read in the unit view: press the units key");
  });
  it("R63: a \\res chip is a number: the slot after it multiplies it, a σ chip is an uncertain value, and Home still refuses a slot", () => {
    const chips = { "res:1": { value: "50*pi", exact: true }, "res:2": { value: "4936/125", exact: false, unc: "sqrt(1548381)/1000" } };
    const r = latexToGiacInfo("\\res{1}{0.157}\\placeholder[u1]{}\\times2\\placeholder[u2]{}", { units: true, chips });
    expect(r.giac).toBe("((50*pi)*pasu1)*(2*pasu2)");
    expect(r.units).toEqual({ slots: ["u1", "u2"], consts: [] });
    // R61's σ in the unit shown goes in as G18's uncertain value, so the unit view keeps it (never a σ silently dropped)
    expect(latexToGiacInfo("\\res{2}{39.488}\\placeholder[u1]{}\\times2", { units: true, chips }).giac).toBe("(pasupm((4936/125),(sqrt(1548381)/1000))*pasu1)*2");
    expect(latexToGiacInfo("\\res{2}{39.488}\\times2", { units: true, chips }).giac).toBe("pasupm((4936/125),(sqrt(1548381)/1000))*2");
    expect(() => latexToGiacInfo("\\res{1}{0.157}\\placeholder[u1]{}", { chips })).toThrow(/unexpected token at 'placeholder'/);
    expect(() => latexToGiacInfo("\\res{1}{0.157}\\pm1", { units: true, chips })).toThrow("± goes right after a number");
  });
});
