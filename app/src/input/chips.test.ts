// SPDX-License-Identifier: GPL-3.0-or-later
// Chips (docs/04 2.8, 3.6): value conversion, the inexact flag and the chip table helpers. The round trips through
// Giac are in tests/golden/parser.yaml (group "chips").
import { describe, expect, it } from "vitest";
import { chipToGiac } from "./chip-giac.ts";
import { pruneChips, validChips, type ChipTable } from "./chips.ts";
import { SerializeError } from "./emit.ts";
import { latexToGiac, latexToGiacInfo } from "./latex-to-giac.ts";

/** Exact SI 2019 constants (derived: exact by definition) and G with an uncertainty: a stand-in until G4's index. */
const SI: ChipTable = {
  "const:c": { value: "299792458", exact: true },
  "const:h": { value: "6.62607015E-34", exact: true },
  "const:e": { value: "1.602176634E-19", exact: true },
  "const:k_B": { value: "1.380649E-23", exact: true },
  "const:N_A": { value: "6.02214076E23", exact: true },
  "const:G": { value: "6.67430E-11", exact: false, unc: "0.00015E-11" },
};

describe("chipToGiac", () => {
  it("turns decimals into exact rational literals of their digits", () => {
    expect(chipToGiac("0.25")).toBe("(25/10^2)");
    expect(chipToGiac("-0.0012")).toBe("(-12/10^4)");
    expect(chipToGiac("6.62607015E-34")).toBe("(662607015/10^42)");
    expect(chipToGiac("6.02214076e23")).toBe("(602214076*10^15)");
    expect(chipToGiac("299792458")).toBe("(299792458)");
    expect(chipToGiac("12.")).toBe("(12)");
    expect(chipToGiac(".5")).toBe("(5/10^1)");
    expect(chipToGiac("0.000")).toBe("0");
  });
  it("keeps exact engine text, in brackets", () => {
    expect(chipToGiac("1/3")).toBe("(1/3)");
    expect(chipToGiac("sqrt(2)/2")).toBe("(sqrt(2)/2)");
    expect(chipToGiac("x+1")).toBe("(x+1)");
  });
  it("refuses statements", () => {
    expect(() => chipToGiac("1;purge(a)")).toThrow(SerializeError);
    expect(() => chipToGiac("a:=2")).toThrow(SerializeError);
    expect(() => chipToGiac(" ")).toThrow(SerializeError);
  });
});

describe("chips in the parser", () => {
  it("reports an inexact chip, so the result cannot be marked =", () => {
    expect(latexToGiacInfo("\\const{c}{c}\\times2", { chips: SI }).inexact).toBe(false);
    expect(latexToGiacInfo("\\const{G}{G}\\times2", { chips: SI }).inexact).toBe(true);
    expect(latexToGiacInfo("\\res{1}{0.33}", { chips: { "res:1": { value: "0.33333", exact: false } } }).inexact).toBe(true);
    expect(latexToGiacInfo("1+2").inexact).toBe(false);
  });
  it("uses the table, never the digits shown", () => {
    expect(latexToGiac("\\res{1}{0.333333333333}", { chips: { "res:1": { value: "1/3", exact: true } } })).toBe("(1/3)");
    expect(latexToGiac("\\const{N_A}{N_{A}}", { chips: SI })).toBe("(602214076*10^15)");
  });
  it("is an error without the chip's value", () => {
    expect(() => latexToGiac("\\res{1}{2}")).toThrow(/missing/);
    expect(() => latexToGiac("\\ans")).toThrow(/Ans/);
    expect(() => latexToGiac("\\const{c}{c}")).toThrow(SerializeError);
  });
  it("rejects 0x, 0b and 0o followed by digits (docs/04 2.3 #1)", () => {
    expect(() => latexToGiac("0xFF")).toThrow(/other bases/);
    expect(() => latexToGiac("0b101")).toThrow(SerializeError);
    expect(latexToGiac("0x+1")).toBe("0*x+1");
  });
});

describe("chip table", () => {
  it("keeps only the chips still on the line, never Ans", () => {
    const t: ChipTable = { "res:1": { value: "1", exact: true }, "res:2": { value: "2", exact: true }, ans: { value: "3", exact: true } };
    expect(pruneChips(t, "\\res{2}{2}+\\ans")).toEqual({ "res:2": { value: "2", exact: true } });
  });
  it("reads back only well-formed stored chips", () => {
    expect(validChips({ "res:1": { value: "1/3", exact: true }, "res:x": { value: "1", exact: true }, "const:c": { value: 3 } })).toEqual({
      "res:1": { value: "1/3", exact: true },
    });
    expect(validChips(null)).toBeUndefined();
    expect(validChips({})).toBeUndefined();
  });
});
