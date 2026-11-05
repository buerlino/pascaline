// SPDX-License-Identifier: GPL-3.0-or-later
// R36: the picked row's line, per reason, on items built by hand (the engine's own facts are in why.spec.ts). Expected
// texts are the package's; the uncertainty of G is CODATA's 0.00015E-11 as the index writes it.
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { MarkInfo } from "../engine/format.ts";
import { uncText, whyLine } from "./whyLine.ts";

const item = (over: Partial<HistoryItem>): HistoryItem =>
  ({ id: 1, latex: "1", status: "done", resultLatex: "", text: "1", approximate: false, startedAt: 0, ...over }) as HistoryItem;
const facts = (f: Partial<NonNullable<HistoryItem["facts"]>>): HistoryItem["facts"] => ({ exact: false, reliableDigits: null, ...f }) as HistoryItem["facts"];
const line = (i: HistoryItem, m: MarkInfo | null): string | null => whyLine(i, m, 12);

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
  it("R134: a constant is named by its symbol as text: a Greek letter, a symbol with braces", () => {
    const chips = {
      "const:G": { value: "(667430/10^16)", exact: false, unc: "0.00015E-11" },
      "const:alpha": { value: "0.0072973525643", exact: false, unc: "1.1E-12" },
      "const:mu0": { value: "1.25663706127E-6", exact: false, unc: "2.0E-16" },
      "const:mu_B": { value: "9.2740100657E-24", exact: false, unc: "2.9E-33" },
    };
    const ga = item({ latex: "\\const{G}{G}\\times\\const{alpha}{\\alpha}", chips });
    expect(line(ga, { mark: "≈" })).toBe("≈ uses G (± 1.5·10⁻¹⁵), α (± 1.1·10⁻¹²)");
    const mu = item({ latex: "\\const{mu0}{\\mu_{0}}\\times 2", chips });
    expect(line(mu, { mark: "≈" })).toBe("≈ uses μ_0 (± 2.0·10⁻¹⁶)");
    const b = item({ latex: "\\const{mu_B}{\\mu_{\\mathrm{B}}}", chips });
    expect(line(b, { mark: "≈" })).toBe("≈ uses μ_B (± 2.9·10⁻³³)");
  });
  it("R36f1: the σ's digits as the chip table holds them, neither rounded nor cut, a trailing zero kept", () => {
    expect(uncText("0.000123E-5")).toBe("1.23·10⁻⁹"); // three digits stay three
    expect(uncText("0.00999E-3")).toBe("9.99·10⁻⁶"); // not rounded up to 1.0·10⁻⁵
    expect(uncText("1.0E-36")).toBe("1.0·10⁻³⁶"); // CODATA's trailing zero
    expect(uncText("0.0E0")).toBeNull();
  });
  it("R36f1: the stored names behind ≈ are the engine's (why.rounded), never read from the entry text", () => {
    const i = item({ latex: "B+1", facts: facts({ why: { rounded: ["B"] } }) });
    expect(line(i, { mark: "≈" })).toBe("≈ uses B, itself rounded");
    expect(line(item({ latex: "A+x_1", facts: facts({ why: { rounded: ["A", "x_1"] } }) }), { mark: "≈" })).toBe("≈ uses A, x_1, itself rounded");
    // B in the entry with no rounded name from the engine (Home kept B = 1/3 exact): the exact value
    expect(line(item({ latex: "B+1", rational: { n: "4", d: "3" } }), { mark: "≈" })).toBe("≈ rounded: the exact value is 4/3");
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
