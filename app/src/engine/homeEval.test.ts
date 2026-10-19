// SPDX-License-Identifier: GPL-3.0-or-later
// Pure parts of exact-first Home. Every expected value here is `derived` (exact arithmetic by hand).
import { describe, expect, it } from "vitest";
import { angleDependent, arrowFunction, definedBy, EQ_DIFF, EQ_INEXACT_FLAG, EQ_VERDICT, toExactLiterals } from "./homeEval.ts";
import { EQ_DIFF as EMITTED_DIFF, EQ_INEXACT_FLAG as EMITTED_FLAG, EQ_VERDICT as EMITTED_VERDICT, mathJsonToGiac } from "../input/emit.ts";
import { markOf } from "./format.ts";

describe("the == test's float flag (R18f1)", () => {
  it("is spelled the same in the parser's test form and in Home", () => {
    expect(EMITTED_FLAG).toBe(EQ_INEXACT_FLAG);
    expect(EMITTED_DIFF).toBe(EQ_DIFF);
    expect(EMITTED_VERDICT).toBe(EQ_VERDICT);
    expect(mathJsonToGiac(["EqualTest", "x", 2])).toContain(`sto(1,${EQ_INEXACT_FLAG})`);
  });
  it("makes a true or false resting on a float approximate; other non-numbers stay unmarked", () => {
    expect(markOf({ exactRational: false, reliableDigits: null, approximate: true }, { format: "STD", digits: 12 })).toEqual({ mark: "≈" });
    expect(markOf({ exactRational: false, reliableDigits: null }, { format: "STD", digits: 12 })).toBeNull();
    // R18f2: a float from an unaudited function gives ⚠; a warned non-number that is not a test stays unmarked
    expect(markOf({ exactRational: false, reliableDigits: null, approximate: true, warn: "unaudited" }, { format: "STD", digits: 12 })).toEqual({ mark: "⚠", warn: "unaudited" });
    expect(markOf({ exactRational: false, reliableDigits: null, warn: "unchecked" }, { format: "STD", digits: 12 })).toBeNull();
  });
});

describe("toExactLiterals", () => {
  it.each([
    ["0.1", "(1/10^1)"],
    ["1-0.9-0.1", "1-(9/10^1)-(1/10^1)"],
    [".5", "(5/10^1)"],
    ["2.50", "(250/10^2)"],
    ["1e-3", "(1/10^3)"],
    ["1.5e300", "(15*10^299)"],
    ["1.2E5", "(12*10^4)"],
    ["12", "12"],
    ["x1+2.5", "x1+(25/10^1)"],
    ['"0.1"', '"0.1"'],
  ])("%s -> %s", (input, out) => {
    expect(toExactLiterals(input)).toBe(out);
  });
});

describe("restoreLiterals (G14)", () => {
  it("puts typed decimals back into a kept test", async () => {
    const { restoreLiterals } = await import("./homeEval.ts");
    expect(restoreLiterals("((f(x))==(746824132812/10^12))", "f(x)==0.746824132812")).toBe("((f(x))==0.746824132812)");
    expect(restoreLiterals("(x==(1/10^3))", "x==1/10^3")).toBe("(x==(1/10^3))");
    expect(restoreLiterals("(x==(5/10^1+y))", "x==0.5+y")).toBe("(x==(0.5+y))");
    expect(restoreLiterals("(x==5/10^1*y)", "x==0.5*y")).toBe("(x==0.5*y)");
    expect(restoreLiterals("(x==5/10^12+y)", "x==0.5+y")).toBe("(x==5/10^12+y)");
  });
});

describe("angleDependent (G34): exact texts Giac would read again in a later angle mode", () => {
  it("trig, inverse and reciprocal functions, arg, and pasexp's cos and sin", () => {
    for (const t of ["sin(1)", "atan(3/4)", "180*atan(3/4)/pi", "sec(2)", "acot(3)", "arg(1+2*i)", "cos(16200/pi)+i*sin(16200/pi)"]) expect(angleDependent(t), t).toBe(true);
  });
  it("exp, hyperbolic functions and powers only with the imaginary unit", () => {
    for (const t of ["exp(90*i)", "cosh(1+i)", "exp(1/3*ln(1+i))", "(1+i)^(1/3)"]) expect(angleDependent(t), t).toBe(true);
    for (const t of ["exp(1)", "cosh(2)", "2^(1/3)", "1/2", "sqrt(2)", "pi/4", "(sqrt(6)-sqrt(2))/4", "sqrt(2)/2*(1+i)", "11-2*i", "pi*i"]) expect(angleDependent(t), t).toBe(false);
  });
});

describe("arrowFunction (G49f4)", () => {
  it("reads name:=x->body and name:=(x,y)->body as a function, also as Giac prints it back", () => {
    expect(arrowFunction("pg:=x->x+pB")).toBe("pg");
    expect(arrowFunction("k:=(x,y)->x*y")).toBe("k");
    expect(arrowFunction("pg:=((x)->x+pB)")).toBe("pg");
    // definedBy keeps the variable kind for the Find items
    expect(definedBy("pg:=x->x+pB")).toEqual({ name: "pg", kind: "var" });
  });
  it("leaves values and other forms alone", () => {
    expect(arrowFunction("a:=5")).toBeNull();
    expect(arrowFunction("a:=(x+1)*(y->y)")).toBeNull();
    expect(arrowFunction("a:=map([1,2],x->x^2)")).toBeNull();
    expect(arrowFunction("f(x):=x^2")).toBeNull();
    expect(arrowFunction("x->x^2")).toBeNull();
  });
});
