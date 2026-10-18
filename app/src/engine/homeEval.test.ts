// SPDX-License-Identifier: GPL-3.0-or-later
// Pure parts of exact-first Home. Every expected value here is `derived` (exact arithmetic by hand).
import { describe, expect, it } from "vitest";
import { EQ_DIFF, EQ_INEXACT_FLAG, EQ_VERDICT, toExactLiterals } from "./homeEval.ts";
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
