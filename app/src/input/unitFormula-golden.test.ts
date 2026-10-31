// SPDX-License-Identifier: GPL-3.0-or-later
// R24cf1 (bug family 8: a second reader of the same text): slotFormula finds the numbers again, separately from the
// parser. Over every LaTeX row of tests/golden/parser.yaml that the units mode parses, the slots slotFormula puts in
// must be exactly the parser's: one pasu name per slot, in the order written. A relation's test writes its sides more
// than once and a piecewise puts its conditions first, so the Giac text holds each pasu name, in no fixed order. The
// group units rows already hold their slots: the line typed is the row without them, and slotFormula must put them
// back where the row has them.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { ChipTable } from "./chips.ts";
import { latexToGiacInfo } from "./latex-to-giac.ts";
import { END, slotFormula } from "./unitFormula.ts";

interface Case {
  id: string;
  latex?: string;
  error?: boolean;
  chips?: ChipTable;
}

const file = fileURLToPath(new URL("../../../tests/golden/parser.yaml", import.meta.url));
const cases = (parse(readFileSync(file, "utf8")) as { cases: Case[] }).cases.filter(
  (c): c is Case & { latex: string } => typeof c.latex === "string" && c.error !== true,
);

/** The row as the units mode reads it, or null when the mode refuses it (then the unit view refuses it too). */
function units(latex: string, chips: ChipTable | undefined): ReturnType<typeof latexToGiacInfo> | null {
  try {
    return latexToGiacInfo(latex, { units: true, ...(chips ? { chips } : {}) });
  } catch {
    return null;
  }
}

const parsed = cases.filter((c) => units(c.latex, c.chips) !== null);

describe("slotFormula against the parser's units mode, over parser.yaml (family 8)", () => {
  it("reads most rows (the sweep is not empty)", () => {
    expect(parsed.length).toBeGreaterThan(300);
  });

  it.each(parsed.map((c) => [c.id, c] as const))("%s: one pasu per slot, in order", (_id, c) => {
    const typed = c.latex.replace(/\\to\\placeholder\[end\]\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/, "").replace(/\\placeholder\[u\d+\]\{\}/g, "");
    const f = slotFormula(typed);
    if (typed !== c.latex) expect(f.latex).toBe(`${c.latex.replace(/\\to\\placeholder\[end\]\{.*\}$/, "")}\\to\\placeholder[end]{}`);
    const r = units(f.latex, c.chips);
    expect(r, `the formula does not parse: ${f.latex}`).not.toBeNull();
    const u = r?.units ?? { slots: [], consts: [] };
    expect(u.slots).toEqual(f.slots);
    expect(u.end).toBe(END);
    const names = new Set([...(r?.giac ?? "").matchAll(/pasu(\d+)/g)].map((m) => Number(m[1])));
    expect([...names].sort((a, b) => a - b)).toEqual(f.slots.map((_, i) => i + 1));
  });
});
