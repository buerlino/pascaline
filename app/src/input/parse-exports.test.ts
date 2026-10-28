// SPDX-License-Identifier: GPL-3.0-or-later
// R72: parse.ts was split into tokenize.ts, parseTables.ts and parseCalculus.ts. The names it exports to the rest of
// app/ stay the same; this list is what parse.ts exported before the split (phase-1 464817f).
import { describe, expect, it } from "vitest";
import * as parse from "./parse.ts";
import type { ParseInfo, ParseOptions, UnitsInfo } from "./parse.ts";

describe("parse.ts exports (R72)", () => {
  it("the same runtime names as before the split", () => {
    expect(Object.keys(parse).sort()).toEqual(["GREEK", "LETTER_NAMES", "parseLatex", "parseLatexInfo"]);
  });
  it("the same types and signatures", () => {
    const o: ParseOptions = { userFunctions: new Set(["f"]), decimalComma: false, chips: {}, chipNames: false, units: false };
    const info: ParseInfo = parse.parseLatexInfo("x", o);
    const u: UnitsInfo | undefined = info.units;
    expect(u).toBeUndefined();
    expect(parse.parseLatex("x+1", o)).toEqual(["Add", "x", { num: "1" }]);
    expect(parse.GREEK.beta).toBe("beta_");
    expect(parse.LETTER_NAMES.e).toBe("e_");
  });
});
