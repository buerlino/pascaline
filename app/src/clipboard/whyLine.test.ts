// SPDX-License-Identifier: GPL-3.0-or-later
// R36: the picked row's line, per reason, on items built by hand (the engine's own facts are in why.spec.ts). Expected
// texts are the package's; the uncertainty of G is CODATA's 0.00015E-11 as the index writes it.
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { MarkInfo } from "../engine/format.ts";
import { roundedNames, uncText, whyLine } from "./whyLine.ts";

const item = (over: Partial<HistoryItem>): HistoryItem =>
  ({ id: 1, latex: "1", status: "done", resultLatex: "", text: "1", approximate: false, startedAt: 0, ...over }) as HistoryItem;
const facts = (f: Partial<NonNullable<HistoryItem["facts"]>>): HistoryItem["facts"] => ({ exact: false, reliableDigits: null, ...f }) as HistoryItem["facts"];
const line = (i: HistoryItem, m: MarkInfo | null, names: string[] = []): string | null => whyLine(i, m, 12, names);

describe("whyLine", () => {
  it("no mark, no line; = is exact", () => {
    expect(line(item({}), null)).toBeNull();
    expect(line(item({}), { mark: "=" })).toBe("= exact");
  });
  it("≈ names the exact value when there is one", () => {
    expect(line(item({ rational: { n: "1", d: "3" } }), { mark: "≈" })).toBe("≈ rounded: the exact value is 1/3");
    expect(line(item({ full: "sqrt(2)", fullExact: true }), { mark: "≈" })).toBe("≈ rounded: the exact value is sqrt(2)");
    expect(line(item({}), { mark: "≈" })).toBe("≈ rounded");
  });
  it("a constant's σ: G (± 1.5·10⁻¹⁵)", () => {
    expect(uncText("0.00015E-11")).toBe("1.5·10⁻¹⁵");
    expect(uncText("3e4")).toBe("3·10⁴");
    expect(uncText("x")).toBeNull();
    const i = item({ latex: "\\const{G}{G}\\times2", chips: { "const:G": { value: "(667430/10^16)", exact: false, unc: "0.00015E-11" } } });
    expect(line(i, { mark: "≈" })).toBe("≈ uses G (± 1.5·10⁻¹⁵)");
  });
  it("a stored inexact name is read as a whole name only", () => {
    const i = item({ latex: "B+1", facts: facts({ reliableDigits: 39 }) });
    expect(line(i, { mark: "≈" }, ["B"])).toBe("≈ uses B, itself rounded");
    expect(line(item({ latex: "\\mathrm{BX}+1" }), { mark: "≈" }, ["B"])).toBe("≈ rounded");
    expect(line(item({ latex: "A+x_1", rational: { n: "1", d: "3" } }), { mark: "≈" }, ["A", "x_1"])).toBe("≈ uses A, x_1, itself rounded");
  });
  it("a stored name is rounded when the row that stored it was marked ≈ or ⚠, else by its facts", () => {
    const rows = [item({ id: 1, latex: "\\sqrt{2}\\blacktriangleright B" }), item({ id: 2, latex: "\\frac14\\blacktriangleright C" }), item({ id: 3, latex: "D:=2.5" })];
    const marks = (i: HistoryItem): MarkInfo => ({ mark: i.id === 2 ? "=" : "≈" });
    const names = [{ name: "B" }, { name: "C" }, { name: "D" }, { name: "E", facts: {} }, { name: "F" }];
    expect(roundedNames(names, rows, marks)).toEqual(["B", "D", "E"]);
  });
  it("the row that stores a name does not use it; a later overwrite does not change an earlier row", () => {
    const rows = [item({ id: 1, latex: "\\sqrt{2}+B" }), item({ id: 2, latex: "\\sqrt{2}\\cdot1.0\\blacktriangleright B" }), item({ id: 3, latex: "D:=2.5" }), item({ id: 4, latex: "1/3.0\\blacktriangleright B" })];
    const marks = (): MarkInfo => ({ mark: "≈" });
    const names = [{ name: "B", facts: {} }, { name: "D", facts: {} }];
    expect(roundedNames(names, rows, marks, rows[1])).toEqual([]);
    expect(roundedNames(names, rows, marks, rows[2])).toEqual(["B"]);
    expect(roundedNames(names, rows, marks, rows[0])).toEqual([]); // B was stored by a later row only
    expect(roundedNames(names, rows, marks)).toEqual(["B", "D"]);
  });
  it("⚠ with fewer digits confirmed and an unaudited function: 9 of 12", () => {
    const i = item({ facts: facts({ reliableDigits: 9, warn: "unaudited", why: { unaudited: ["normald_icdf"] } }) });
    expect(line(i, { mark: "⚠", warn: "unaudited" })).toBe("⚠ 9 of 12 digits confirmed · normald_icdf is not checked");
    expect(line(i, { mark: "⚠", n: 9 })).toBe("⚠ 9 of 12 digits confirmed · normald_icdf is not checked");
    const two = item({ facts: facts({ warn: "unaudited", why: { unaudited: ["tanh", "atan"] } }) });
    expect(line(two, { mark: "⚠", warn: "unaudited" })).toBe("⚠ tanh, atan are not checked");
  });
  it("G38 decided, G39 differ, once, inherited, and a ⚠ with no reason on record", () => {
    expect(line(item({ facts: facts({ warn: "unchecked", why: { decided: true } }) }), { mark: "⚠", warn: "unchecked" })).toBe("⚠ decided at limited precision");
    expect(line(item({ facts: facts({ reliableDigits: 0, why: { differ: true } }) }), { mark: "⚠", n: 0 })).toBe("⚠ no digit confirmed · the exact and numeric answers differ");
    expect(line(item({ facts: facts({ warn: "unchecked", why: { once: true } }) }), { mark: "⚠", warn: "unchecked" })).toBe("⚠ evaluated once, nothing to compare");
    expect(line(item({ facts: facts({ reliableDigits: 5, why: { inherited: ["B"] } }) }), { mark: "⚠", n: 5 })).toBe("⚠ 5 of 12 digits confirmed · uses B, itself uncertain");
    expect(line(item({}), { mark: "⚠", warn: "unchecked" })).toBe("⚠ not checked");
    expect(line(item({}), { mark: "⚠" })).toBe("⚠ fewer digits confirmed than shown");
  });
  it("G50: a complex function the audit does not cover is named", () => {
    const i = item({ facts: facts({ warn: "unaudited", why: { unaudited: ["atan"] } }) });
    expect(line(i, { mark: "⚠", warn: "unaudited" })).toBe("⚠ atan is not checked");
  });
});
