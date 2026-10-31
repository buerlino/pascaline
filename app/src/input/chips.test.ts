// SPDX-License-Identifier: GPL-3.0-or-later
// Chips (docs/04 2.8, 3.6): value conversion, the inexact flag and the chip table helpers. The round trips through
// Giac are in tests/golden/parser.yaml (group "chips").
import { describe, expect, it } from "vitest";
import { basisOf } from "../engine/constBasis.ts";
import { chipToGiac } from "./chip-giac.ts";
import { pruneChips, validChips, type ChipTable } from "./chips.ts";
import { EQ_INEXACT_FLAG, SerializeError } from "./emit.ts";
import { latexToGiac, latexToGiacInfo } from "./latex-to-giac.ts";
import { chipUnit } from "./chipUnit.ts";

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
  it("carries an open == or ≠ test as the value test again, never as Giac's structural == (R18f3)", () => {
    for (const v of ["(x==2)", "((x*y)==2)", "((cos(pi/7)-cos(2*pi/7)+cos(3*pi/7))==(1/2))", "x<>2", "(x*y)<>(2)"]) {
      const g = chipToGiac(v);
      expect(g, v).toContain(`sto(1,${EQ_INEXACT_FLAG})`);
      expect(g, v).toMatch(v.includes("<>") ? /'\(.*\)!=\(.*\)'/ : /'\(.*\)==\(.*\)'/);
    }
    expect(chipToGiac("((x*y)==2)")).toContain("'((x*y))==(2)'");
  });
  it("carries every test inside a list, an and or a sum, and leaves the rest as it is (R18f3)", () => {
    const tests = (g: string): number => g.split(`sto(1,${EQ_INEXACT_FLAG})`).length - 1;
    for (const [v, n] of [["[((x*y)==2),1]", 1], ["[(x+1)<>2,(x==y)]", 2], ["((x<>2) and ((y==3)))", 2], ["not((x==2))", 1], ["(x==2)+1", 1], ["[[(x==2)]]", 1], ["(x==2)=y", 1]] as const) {
      const g = chipToGiac(v);
      expect(tests(g), v).toBe(n);
      expect(g, v).not.toMatch(/(^|[^'])\((x|\(x\*y\))==/); // no == left outside the quoted kept form
    }
    expect(chipToGiac("[((x*y)==2),1]")).toMatch(/^\(\[\(\(\(a_,b_\)->.*\),1\]\)$/);
  });
  it("refuses a test it cannot carry as typed", () => {
    expect(() => chipToGiac("x<>2=y")).toThrow(SerializeError); // beside another relation
    expect(() => chipToGiac('["a",(x==2)]')).toThrow(SerializeError); // a string
    expect(() => chipToGiac("(x==2")).toThrow(SerializeError); // unbalanced
    expect(() => chipToGiac("(==2)")).toThrow(SerializeError); // a missing side
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
  it("G81: a constant's basis is kept with its leaves; a malformed leaf keeps today's path (basisOf refuses it)", () => {
    const leaves = { fine_structure: { value: "7.29735256434E-3", unc: "1.13E-12" } };
    const mu = { value: "1.25663706127E-6", exact: false, unc: "2.0E-16", basis: "2*pasl_fine_structure", basisLeaves: leaves };
    expect(validChips({ "const:mu_0": mu })).toEqual({ "const:mu_0": mu });
    expect(basisOf(validChips({ "const:mu_0": mu })!["const:mu_0"]!)).toBe(mu.basis);
    for (const basisLeaves of [{ fine_structure: { value: 7 } }, { fine_structure: null }, "x", 5, {}]) {
      const back = validChips({ "const:mu_0": { ...mu, basisLeaves } })!["const:mu_0"]!;
      expect(back).toMatchObject({ value: mu.value, exact: false, unc: mu.unc });
      expect(basisOf(back)).toBeUndefined();
    }
    expect(basisOf(validChips({ "const:mu_0": { ...mu, basis: 3 } })!["const:mu_0"]!)).toBeUndefined();
    expect(validChips({ "const:mu_0": { value: mu.value, exact: false, unc: mu.unc } })).toEqual({ "const:mu_0": { value: mu.value, exact: false, unc: mu.unc } });
    // an exact chip's basis is never read
    expect(basisOf(validChips({ "const:c": { value: "299792458", exact: true, basis: "pasl_x", basisLeaves: { x: { value: "1", unc: "1" } } } })!["const:c"]!)).toBeUndefined();
  });
  // R61: a unit result's chip keeps its σ and its unit (label and slot) across a restart.
  const T10 = {
    value: "4936/125",
    exact: false,
    reliableDigits: null,
    unc: "sqrt(1548381)/1000",
    unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } },
  };
  const KMH = { value: "72", exact: true, unit: { text: "km/h", dim: "m1s-1", slot: { tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 } } };
  it("R61: a result chip with unit and unc round-trips", () => {
    const stored = JSON.parse(JSON.stringify({ "res:1": T10, "res:2": KMH })) as unknown;
    expect(validChips(stored)).toStrictEqual({ "res:1": T10, "res:2": KMH });
  });
  it("R61: a bad unit is dropped, not thrown; the chip stays", () => {
    const slot = KMH.unit.slot;
    const bad: unknown[] = [
      "km/h",
      null,
      { text: "x".repeat(41), dim: "m1s-1", slot },
      { text: "", dim: "m1s-1", slot },
      { text: "km/h", dim: "m 1", slot },
      { text: "km/h", dim: 3, slot },
      { text: "km/h", dim: "m1s-1" },
      { text: "km/h", dim: "m1s-1", slot: { tokens: "km" } },
      { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "" }] } },
      { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "m", prefix: 3 }] } },
      { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "m", power: "x" }] } },
      { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "m" }], per: 5 } },
      { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "m{}" }] } },
    ];
    // the loader keeps the chip and its unit as stored (no check at start, R91's pin); chipUnit drops a bad one
    for (const unit of bad) {
      const back = validChips({ "res:2": { ...KMH, unit }, "res:3": KMH })!;
      expect(back["res:2"], JSON.stringify(unit)).toMatchObject({ value: "72", exact: true });
      expect(chipUnit(back["res:2"]), JSON.stringify(unit)).toBeUndefined();
      expect(back["res:3"]).toStrictEqual(KMH);
      expect(chipUnit(back["res:3"])).toStrictEqual(KMH.unit);
    }
    // a unit that is no object is not kept; a constant chip has none
    for (const unit of ["km/h", null, 3]) expect(validChips({ "res:2": { ...KMH, unit } })).toStrictEqual({ "res:2": { value: "72", exact: true } });
    expect(validChips({ "const:G": { value: "1", exact: true, unit: KMH.unit } })).toStrictEqual({ "const:G": { value: "1", exact: true } });
    // a token's other keys are not read
    expect(chipUnit({ ...KMH, unit: { ...KMH.unit, slot: { tokens: [{ unit: "m", x: 1 } as never] } } })).toStrictEqual({ ...KMH.unit, slot: { tokens: [{ unit: "m" }] } });
  });
  it("R61: an exact chip with an uncertainty is refused", () => {
    expect(validChips({ "res:1": { ...T10, exact: true } })).toBeUndefined();
    expect(validChips({ "const:G": { value: "6.67430E-11", exact: true, unc: "0.00015E-11" } })).toBeUndefined();
  });
});

describe("bracket messages (F10)", () => {
  it("a \\left. closed by a real bracket is an unmatched bracket, not a missing evaluate-at bar", () => {
    expect(() => latexToGiac("\\log\\left.2\\right)")).toThrow(/unmatched bracket/);
    expect(() => latexToGiac("\\left.\\right)")).toThrow(/unmatched bracket/);
    expect(() => latexToGiac("\\left.x^2\\right|")).toThrow(/evaluate-at bar/);
  });
});
