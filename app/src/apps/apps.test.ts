// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { addMul, decText, nearestK, niceStep, parseDec, plainNumber, showDecimal } from "./decimal.ts";
import { compileDefinition } from "./function/compile.ts";
import { compileEquation } from "./solve/app.svelte.ts";

describe("exact decimal steps", () => {
  it("adds steps without binary rounding", () => {
    const start = parseDec("0") ?? { m: 0n, scale: 0 };
    const step = parseDec("0.1") ?? { m: 0n, scale: 0 };
    expect(decText(addMul(start, 3, step))).toBe("0.3");
    expect(decText(addMul(parseDec("-1.25") ?? start, 5, parseDec("0.25") ?? step))).toBe("0");
    expect(decText(addMul(parseDec("2e-3") ?? start, -1, parseDec("1") ?? step))).toBe("-0.998");
    expect(decText(addMul(parseDec("1e3") ?? start, 1, parseDec("0.5") ?? step))).toBe("1000.5");
  });
  it("rejects what is not a plain decimal", () => {
    expect(parseDec("1/3")).toBeUndefined();
    expect(parseDec("")).toBeUndefined();
    expect(parseDec(".")).toBeUndefined();
  });
  it("reads the entry line as a plain decimal (Solve values, Function Num start/step)", () => {
    expect(plainNumber("-0.5")).toBe("-0.5");
    expect(plainNumber("1.5\\emark3")).toBe("1.5e3"); // 1.5ᴇ3, the exponent key (R14)
    expect(plainNumber("1.5\\emark-3")).toBe("1.5e-3");
    expect(plainNumber("1.5\\times10^{3}")).toBe("1.5e3");
    expect(plainNumber("1.5\\times 10^{-3}")).toBe("1.5e-3");
    expect(plainNumber("2\\times10^4")).toBe("2e4");
    expect(plainNumber("\\frac{1}{3}")).toBeUndefined();
    expect(plainNumber("")).toBeUndefined();
  });
  it("picks 1-2-5 steps", () => {
    expect(decText(niceStep(0.2))).toBe("0.2");
    expect(decText(niceStep(0.27))).toBe("0.2");
    expect(decText(niceStep(0.04))).toBe("0.05");
    expect(decText(niceStep(8))).toBe("10");
    expect(decText(niceStep(130))).toBe("100");
    expect(nearestK(1.41, niceStep(0.2))).toBe(7);
  });
  it("shows decimals through the Home formatter", () => {
    expect(showDecimal("0.3", 12)).toBe("0.3");
    expect(showDecimal("1234567.5", 4)).toBe("1.235E6");
  });
});

describe("Function definitions", () => {
  it("gives Giac text and a drawing evaluator", () => {
    const c = compileDefinition("x^3-2x");
    expect(c.error).toBe("");
    expect(c.giac).toBe("x^3-2*x");
    expect(c.fn?.(2)).toBe(4);
  });
  it("treats X as x", () => {
    expect(compileDefinition("\\sin\\left(X\\right)").giac).toBe("sin(pasdeg*x)");
  });
  it("refuses equations", () => {
    expect(compileDefinition("x=2").error).not.toBe("");
  });
  it("keeps definitions it cannot draw (a stored variable) for the engine", () => {
    const c = compileDefinition("ax");
    expect(c.giac).toBe("a*x");
    expect(c.fn).toBeUndefined();
  });
  it("keeps the real odd root of a power, so x^(1/3) draws its left half (P5 (b), R39; S12 row 2b)", () => {
    const c = compileDefinition("x^{\\frac{1}{3}}");
    expect(c.giac).toBe("surd(x,3)");
    expect(c.fn?.(-8)).toBeCloseTo(-2, 12);
  });
});

describe("Solve equations", () => {
  it("keeps the real odd root of a power, as Function does (P5 (b), R39; S12 row 2c)", () => {
    expect(compileEquation("x^{\\frac{1}{3}}=-2")).toEqual({ giac: "surd(x,3)=-2", error: "" });
  });
});

describe("Function drawing follows the angle mode (R64a)", () => {
  const f = (latex: string, angle: "rad" | "deg"): ((x: number) => number) => compileDefinition(latex, angle).fn as (x: number) => number;
  it("in DEG sin, cos, tan take degrees", () => {
    expect(f("\\sin\\left(x\\right)", "deg")(180)).toBeCloseTo(0, 12);
    expect(f("\\sin\\left(x\\right)", "deg")(90)).toBeCloseTo(1, 12);
    expect(f("\\cos\\left(x\\right)", "deg")(90)).toBeCloseTo(0, 12);
    expect(f("\\tan\\left(x\\right)", "deg")(45)).toBeCloseTo(1, 12);
  });
  it("in DEG the inverses return degrees", () => {
    expect(f("\\arcsin\\left(x\\right)", "deg")(1)).toBeCloseTo(90, 12);
    expect(f("\\arctan\\left(x\\right)", "deg")(1)).toBeCloseTo(45, 12);
  });
  it("sin(90°) is 1 in both modes", () => {
    expect(f("\\sin\\left(90\\degree\\right)", "deg")(0)).toBeCloseTo(1, 12);
    expect(f("\\sin\\left(90\\degree\\right)", "rad")(0)).toBeCloseTo(1, 12);
  });
  it("RAD is unchanged", () => {
    expect(f("\\sin\\left(x\\right)", "rad")(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(f("\\arctan\\left(x\\right)", "rad")(1)).toBeCloseTo(Math.PI / 4, 12);
  });
});
