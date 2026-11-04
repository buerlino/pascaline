// SPDX-License-Identifier: GPL-3.0-or-later
// R40: the digits past a constant's σ are muted on the screen's row, never in the text, a chip or Copy; the σ line a tap
// shows. G·5.972ᴇ24 = 3.98589196ᴇ14 with σ = 1.5ᴇ-15·5.972ᴇ24 = 8.958ᴇ9 and uncDigits 5 (derived, host.test.ts G26).
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE } from "../engine/format.ts";
import { mutedTail } from "../render/home.ts";
import { renderNumeric, type DisplayContext, type NumericResult } from "./displayMode.ts";
import { sigmaLine } from "./sigmaLine.ts";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "./session.svelte.ts";

const value = { re: decimalFromString("398589196000000")!, im: ZERO_VALUE };
const facts = { exact: false, reliableDigits: null, inexact: true as const, uncDigits: 5, uncSigma: "0.8958e10" };
const r: NumericResult = { value, facts, inexactInput: true };
const ctx = (o: Partial<DisplayContext> = {}): DisplayContext => ({ format: "std", digits: 12, fixDecimals: 4, angle: "rad", ...o });

describe("muted digits past uncDigits (R40)", () => {
  it("the screen's row mutes the digits from the sixth on; the text keeps every digit", () => {
    const d = renderNumeric(r, undefined, ctx(), true)!;
    expect(d.latex).toBe("3.985\\,8\\class{unc}{91\\,96}\\times10^{14}"); // grouped as R55 draws it
    expect(d.text).toBe("3.98589196E14");
  });
  it("a chip, the entry line and Copy (not grouped) get no muted span", () => {
    expect(renderNumeric(r, undefined, ctx(), false)!.latex).toBe("3.98589196\\times10^{14}");
  });
  it("the same cut at 30 digits: five digits hold, the rest of the integer is muted, groups and all", () => {
    expect(renderNumeric(r, undefined, ctx({ digits: 30 }), true)!.latex).toBe("398\\,58\\class{unc}{9\\,196\\,000\\,000}");
  });
  it("in every notation the cut stays at the same place value", () => {
    expect(renderNumeric(r, "sci", ctx(), true)!.latex).toBe("3.985\\,8\\class{unc}{91\\,960\\,00}\\times10^{14}");
    expect(renderNumeric(r, "eng", ctx(), true)!.latex).toBe("398.58\\class{unc}{9\\,196\\,000}\\times10^{12}");
    expect(renderNumeric(r, "pfx", ctx(), true)!.latex).toBe("398.58\\class{unc}{9\\,196\\,000}\\,\\class{pfx}{\\mathrm{T}}");
    expect(renderNumeric(r, "fix", ctx({ fixDecimals: 2 }), true)!.latex).toBe("398\\,58\\class{unc}{9\\,196\\,000\\,000.00}");
    expect(renderNumeric(r, undefined, ctx({ decimalComma: true }), true)!.latex).toBe("3{,}985\\,8\\class{unc}{91\\,96}\\times10^{14}");
  });
  it("no uncDigits (only exact constants), a σ below every shown digit or a complex value: no muted digit", () => {
    const { uncDigits: _u, uncSigma: _s, ...exactFacts } = facts;
    expect(renderNumeric({ ...r, facts: exactFacts }, undefined, ctx(), true)!.latex).not.toContain("unc");
    expect(renderNumeric({ ...r, facts: { ...facts, uncDigits: 12 } }, undefined, ctx(), true)!.latex).not.toContain("unc");
    expect(renderNumeric({ ...r, value: { re: value.re, im: value.re } }, undefined, ctx(), true)!.latex).not.toContain("unc");
  });
  it("mutedTail places each digit by the mantissa's power of ten", () => {
    expect(mutedTail("0.001234", 0, -4)).toBe("0.0012\\class{unc}{34}");
    expect(mutedTail("1234", 0, 5)).toBe("\\class{unc}{1234}");
    expect(mutedTail("1234", 0, 0)).toBe("1234");
  });
});

describe("the σ line (R40)", () => {
  it("σ with two significant digits and U = 2σ (k = 2), in the row's notation", () => {
    expect(sigmaLine(facts, "std")).toBe("σ = 9.0ᴇ9 · U = 2σ = 1.8ᴇ10 (k = 2)"); // 2 × 8.958ᴇ9 = 1.7916ᴇ10
    expect(sigmaLine(facts, "eng")).toBe("σ = 9.0ᴇ9 · U = 2σ = 18ᴇ9 (k = 2)");
    expect(sigmaLine(facts, "pfx")).toBe("σ = 9.0 G · U = 2σ = 18 G (k = 2)");
    expect(sigmaLine({ ...facts, uncSigma: "0.15e-14" }, "fix", true)).toBe("σ = 1,5ᴇ-15 · U = 2σ = 3,0ᴇ-15 (k = 2)");
  });
  it("none without σ", () => {
    expect(sigmaLine({ exact: false, reliableDigits: null }, "std")).toBeNull();
    expect(sigmaLine(undefined, "std")).toBeNull();
  });
  it("the session shows it with Muted digits, σ on tap, once its code is in, and not with Muted digits", async () => {
    const s = new Session(new FakeCalc(), { get: async () => undefined, set: async () => {} });
    const item = { id: 1, view: "home" as const, latex: "", status: "done" as const, resultLatex: "", text: "", approximate: true, value, facts, startedAt: 0 };
    await s.sigmaReady();
    expect(s.sigma(item)).toBe("σ = 9.0ᴇ9 · U = 2σ = 1.8ᴇ10 (k = 2)");
    s.setUncertainty("muted");
    expect(s.sigma(item)).toBeNull();
  });
});
