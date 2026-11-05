// SPDX-License-Identifier: GPL-3.0-or-later
// R135 (F71): a LaTeX over MAX_DRAWN_LATEX, or one MathLive refuses, is a drawn note, never the LaTeX source, and a LaTeX
// over the cut never reaches MathLive (its SSR build took 2.5 s and then overflowed the stack on Σ_{k=1}^{2000} cos(k)/k).
// Server-rendered (the History test's way); the stand-in module is what `mathlive.mod` holds once MathLive is loaded.
import { afterEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type * as MathLive from "mathlive";
import Math from "./Math.svelte";
import { MAX_DRAWN_LATEX, tooLongNote } from "./longResult.ts";
import { mathlive, renderStats } from "./mathlive.svelte.ts";

const stand = (f: (latex: string) => string): typeof MathLive => ({ convertLatexToMarkup: f }) as unknown as typeof MathLive;
const draw = (latex: string, extra: Record<string, unknown> = {}): string => render(Math, { props: { latex, ...extra } }).body;
const long = "\\frac{" + "7".repeat(MAX_DRAWN_LATEX) + "}{3}";

afterEach(() => {
  mathlive.mod = undefined;
});

describe("Math: a result too long to draw (R135)", () => {
  it("over the cut: MathLive is not called, the note is shown, the LaTeX is nowhere in the markup", () => {
    mathlive.mod = stand((l) => `<i>${l}</i>`);
    const before = renderStats.count;
    const html = draw(long);
    expect(renderStats.count).toBe(before);
    expect(html).toContain("Too long to draw (6 kB): Copy holds it");
    expect(html).not.toContain("777777");
    expect(html).not.toContain("\\frac");
  });
  it("the size in the note is the text's length when given", () => {
    mathlive.mod = stand((l) => l);
    expect(draw(long, { size: 1_749_440 })).toContain("Too long to draw (1.7 MB)");
  });
  it("the aria-label is the note, never the LaTeX over the cut", () => {
    mathlive.mod = stand((l) => l);
    const html = draw(long, { label: "" });
    expect(html).toMatch(/aria-label="Too long to draw/);
  });
  it("over the cut and before MathLive has loaded: the note too, not the source", () => {
    const html = draw(long);
    expect(html).toContain("Too long to draw");
    expect(html).not.toContain("777777");
  });
  it("a LaTeX MathLive refuses (it throws): the note, not the LaTeX", () => {
    mathlive.mod = stand(() => {
      throw new RangeError("Maximum call stack size exceeded");
    });
    const html = draw("\\frac{1}{2}");
    expect(html).toContain("Too long to draw");
    expect(html).not.toContain("frac");
  });
  it("under the cut: drawn as before, with its LaTeX", () => {
    mathlive.mod = stand((l) => `<b>M(${l})</b>`);
    const before = renderStats.count;
    const html = draw("\\frac{1}{2}");
    expect(renderStats.count).toBe(before + 1);
    expect(html).toContain("<b>M(\\frac{1}{2})</b>");
    expect(html).toContain('data-latex="\\frac{1}{2}"');
  });
  it("under the cut and before MathLive has loaded: the plain text fallback is unchanged", () => {
    expect(draw("x+1")).toContain("x+1");
    expect(draw("x+1")).not.toContain("Too long");
  });
});

describe("tooLongNote", () => {
  it("kB below 1 MB, MB with one decimal above", () => {
    expect(tooLongNote(6001)).toBe("Too long to draw (6 kB): Copy holds it");
    expect(tooLongNote(1_773_448)).toContain("(1.8 MB)");
    expect(tooLongNote(120)).toContain("(1 kB)");
  });
});
