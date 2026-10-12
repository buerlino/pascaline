// SPDX-License-Identifier: GPL-3.0-or-later
// docs/04 3.6 (to verify, R2): MathLive 0.111.1 accepts our chip macros and draws their definition. The other half
// (the field's value keeps the macro) needs a browser: app/test/chips.spec.ts. Uses MathLive's own SSR build.
import { convertLatexToMarkup, validateLatex } from "mathlive/ssr";
import { describe, expect, it } from "vitest";
import { CHIP_MACROS, constChip, resChip } from "./macros.ts";

const macros = CHIP_MACROS;

describe("chip macros (MathLive 0.111.1)", () => {
  it("are valid LaTeX for MathLive", () => {
    expect(validateLatex(`2\\times${resChip(1, "0.333333333333")}+\\ans-${constChip("c", "c")}`, { macros })).toEqual([]);
    expect(validateLatex(resChip(2, "\\frac{\\sqrt{2}}{2}"), { macros })).toEqual([]);
  });

  it("draw what the chip shows on the accent background, not the macro", () => {
    const m = convertLatexToMarkup(resChip(1, "0.333333333333"), { macros });
    expect(m).toContain("var(--chip-bg)");
    expect(m).not.toContain("\\res");
    expect(m.replace(/<[^>]*>/g, "")).toContain("0.333333333333");
    expect(convertLatexToMarkup("\\ans", { macros }).replace(/<[^>]*>/g, "")).toContain("Ans");
    expect(convertLatexToMarkup(constChip("G", "G"), { macros })).toContain("var(--chip-bg)");
  });

  it("draw constants and Ans upright (not as an italic variable)", () => {
    expect(convertLatexToMarkup(constChip("c", "c"), { macros })).toMatch(/ML__cmr">c</);
    expect(convertLatexToMarkup("c", { macros })).toMatch(/ML__mathit">c</);
  });
});
