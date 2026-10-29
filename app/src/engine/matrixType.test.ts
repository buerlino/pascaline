// SPDX-License-Identifier: GPL-3.0-or-later
// G130 (backlog F125): Giac's matrix type (subtype 11: matrix(2,3), idn, tran, a matrix times one) printed `matrix[…]`, which
// Home and CAS showed as text. Home shows the rows a plain [[…]] shows, with one mark; CAS's text is the rows and its drawing
// stays Giac's latex() of the matrix; Ans reads the rows back. Values derived by hand.
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { markOf } from "./format.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { MATRIX_ROWS, matrixTyped } from "./giacPrint.ts";

describe("matrixTyped", () => {
  it("tells Giac's matrix print from a plain vector", () => {
    expect(matrixTyped("matrix[[0,0],[0,0]]")).toBe(true);
    expect(matrixTyped("[[0,0],[0,0]]")).toBe(false);
    expect(matrixTyped("list[[1,2]]")).toBe(false);
    expect(MATRIX_ROWS("pasans")).toContain("op(pasans)");
  });
});

describe.skipIf(!giacAvailable())("G130 Giac's matrix type", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("shows in Home as the rows of a plain matrix, one mark, and Ans reads them back", () => {
    for (const [input, rows] of [
      ["matrix(2,3)", "[[0,0,0],[0,0,0]]"],
      ["idn(2)", "[[1,0],[0,1]]"],
      ["tran([[1,2],[3,4]])", "[[1,3],[2,4]]"],
      ["[[1,2],[3,4]]*matrix(2,2)", "[[0,0],[0,0]]"],
      ["matrix(list[list[1,2],list[3,4]])", "[[1,2],[3,4]]"],
    ] as const) {
      const r = home(input);
      expect(r, input).toMatchObject({ ok: true, display: rows, exact: rows, full: rows });
      expect(r.shape, input).toBeDefined();
      expect(markOf(precisionFacts(r), { format: "STD", digits: 12 })?.mark, input).toBe("=");
    }
    // Ans holds the rows: tran's [[1,3],[2,4]] doubled
    home("tran([[1,2],[3,4]])");
    expect(home("pasans*2")).toMatchObject({ ok: true, display: "[[2,6],[4,8]]" });
  });

  it("gives CAS the rows as its text and Giac's matrix drawing", () => {
    const r = cas("idn(2)");
    expect(r).toMatchObject({ ok: true, text: "[[1,0],[0,1]]" });
    expect(r.latex).toContain("\\begin{array}{cc}");
    expect(cas("matrix(list[list[1,2],list[3,4]])")).toMatchObject({ ok: true, text: "[[1,2],[3,4]]" });
  });
});
