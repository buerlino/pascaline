// SPDX-License-Identifier: GPL-3.0-or-later
// R135f2: a result too long to draw is not put on the entry line (its LaTeX made MathLive overflow its stack at 1.77 MB).
// A chip stands for any result, and a result at or under the cut goes in as drawn.
import { describe, expect, it } from "vitest";
import { MAX_DRAWN_LATEX, tooLongToInsert, tooLongToInsertNote } from "./longResult.ts";

describe("tooLongToInsert (R135f2)", () => {
  it("no chip and just over the cut: refused", () => {
    expect(tooLongToInsert("7".repeat(MAX_DRAWN_LATEX + 1), false)).toBe(true);
  });
  it("no chip and exactly at the cut: inserted as drawn", () => {
    expect(tooLongToInsert("7".repeat(MAX_DRAWN_LATEX), false)).toBe(false);
  });
  it("a chip carries its value, however long the drawn LaTeX", () => {
    expect(tooLongToInsert("7".repeat(MAX_DRAWN_LATEX + 1), true)).toBe(false);
  });
  it("the notice says it is too long to insert and that Copy holds it", () => {
    expect(tooLongToInsertNote()).toBe("Too long to insert: Copy holds it");
  });
});
