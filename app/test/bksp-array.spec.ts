// SPDX-License-Identifier: GPL-3.0-or-later
// R26g (bug F20): ⌫ and Del at the 2×2 matrix, the row and column vectors and piecewise. MathLive keeps such a table as
// one atom whose cells are its branches, in reading order, each from its empty sentinel one level deeper; piecewise's
// condition cells start with the letters of `\text{if }`. Its own delete removes the □ of an emptied cell (a cell with
// nothing in it) and then nothing more, does nothing at the start of a cell, and deletes a filled table whole from right
// after it. The rule (decisions.md "⌫ and Del keep a template whole", points 2-5): every cell is a box. An emptied cell
// keeps its □; ⌫ at the start of a cell steps to the end of the cell before it, in reading order, and Del is the
// mirror; at the first cell an empty table goes in one ⌫ and a filled one is selected first (no cell is the main box);
// ⌫ right after a table steps into its last cell. A row is never removed: the table keeps its shape (the brief's
// default). By keys; the palette cells by the key path (`run`), as the Tmpl palette inserts them. Expected lines
// derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const PH = "\\placeholder{}";
const MATRIX = "\\begin{pmatrix}#? & #?\\\\ #? & #?\\end{pmatrix}";
const ROW = "\\begin{pmatrix}#? & #?\\end{pmatrix}";
const COL = "\\begin{pmatrix}#?\\\\ #?\\end{pmatrix}";
const CASES = "\\begin{cases}#? & \\text{if }#?\\\\ #? & \\text{if }#?\\end{cases}";
const IF = "\\text{if }";
const m22 = (a: string, b: string, c: string, d: string): string => `\\begin{pmatrix}${a} & ${b}\\\\ ${c} & ${d}\\end{pmatrix}`;
const cases = (a: string, b: string, c: string, d: string): string =>
  `\\begin{cases}${a} & ${IF}${b}\\\\ ${c} & ${IF}${d}\\end{cases}`;

async function bksp(page: Page): Promise<string> {
  await tap(page, ["bksp"]);
  return entryValue(page);
}
async function del(page: Page): Promise<string> {
  await tap(page, ["shift", "bksp"]);
  return entryValue(page);
}
/** A Tmpl palette cell, by the key path (`run`), as the palette inserts it. */
const insert = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => window.pascaline.entry.run({ kind: "insert", latex: l }), latex);
/** A MathLive command by the key path (the grid's way to reach the line's ends). */
const cmd = (page: Page, name: string): Promise<void> =>
  page.evaluate((n) => window.pascaline.entry.run({ kind: "cmd", name: n }), name);
/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });
/** 5, then the matrix filled with 1 2 3 4 by keys (▶ goes to the next cell). */
async function filledMatrix(page: Page): Promise<string> {
  await tap(page, ["d5"]);
  await insert(page, MATRIX);
  await tap(page, ["d1", "right", "d2", "right", "d3", "right", "d4"]);
  const line = `5${m22("1", "2", "3", "4")}`;
  expect(await entryValue(page)).toBe(line);
  return line;
}

// ---- an empty table goes in one ⌫ (point 4) ----------------------------------------------------------------------------
for (const [name, latex, cells] of [["the 2×2 matrix", MATRIX, 4], ["the row vector", ROW, 2], ["the column vector", COL, 2], ["piecewise", CASES, 4]] as const) {
  test(`${name} on an empty line, then ⌫ empties the line`, async ({ page }) => {
    await insert(page, latex);
    expect(await bksp(page)).toBe("");
  });

  test(`5 ${name}, then ⌫ ⌫: the table goes whole, then the 5`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    expect(await bksp(page)).toBe("5");
    expect(await bksp(page)).toBe("");
  });

  test(`5 ${name}, Del from right before it: into the first cell, through the cells, then the empty table goes`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    const line = await entryValue(page);
    await page.evaluate(() => {
      if (window.pascaline.entry.field) window.pascaline.entry.field.position = 1; // right after the 5
    });
    // into the first cell, then on to the start of each later cell: nothing deleted (points 5 and 3)
    for (let i = 0; i < cells; i++) {
      expect(await del(page)).toBe(line);
      expect(await selected(page)).toBe(PH);
    }
    expect(await del(page)).toBe("5"); // Del at the end of the last cell: the empty table goes (point 4)
  });
}

// ---- an emptied cell keeps its □ (point 2) -----------------------------------------------------------------------------
test("matrix, 2, ⌫: the cell shows □ again, and the next ⌫ removes the empty matrix", async ({ page }) => {
  await insert(page, MATRIX);
  await tap(page, ["d2"]);
  expect(await bksp(page)).toBe(m22(PH, PH, PH, PH));
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("");
});

test("matrix, ▶ 7, ⌫: the second cell shows □, ⌫ steps back to the first cell's □", async ({ page }) => {
  await insert(page, MATRIX);
  await tap(page, ["right", "d7"]);
  expect(await bksp(page)).toBe(m22(PH, PH, PH, PH));
  expect(await bksp(page)).toBe(m22(PH, PH, PH, PH)); // to the first cell: nothing deleted
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("");
});

// ---- ⌫ at the start of a cell steps back, in reading order (point 3) --------------------------------------------------
test("matrix, ▶ 2 3 ◀ ◀ ⌫: to the end of the first cell, nothing deleted", async ({ page }) => {
  await insert(page, MATRIX);
  await tap(page, ["right", "d2", "d3", "left", "left"]);
  const line = m22(PH, "23", PH, PH);
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(PH); // the first cell's □, as after the key
});

test("matrix, 1 ▶ 2 ▶ 3: ⌫ at the start of the second row goes to the end of the first row, and no row is removed", async ({ page }) => {
  await insert(page, MATRIX);
  await tap(page, ["d1", "right", "d2", "right", "d3", "left"]);
  const line = m22("1", "2", "3", PH);
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line); // to the end of the 2
  expect(await bksp(page)).toBe(m22("1", PH, "3", PH)); // the 2 goes, its cell shows □
});

test("piecewise: ⌫ at the start of a condition steps to the end of the value before it; the if stays", async ({ page }) => {
  await insert(page, CASES);
  await tap(page, ["x", "right", "d0", "left"]);
  const line = cases("x", "0", PH, PH);
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line); // to the end of the x
  expect(await bksp(page)).toBe(cases(PH, "0", PH, PH));
});

test("piecewise: Del at the end of a value steps over the if to the start of its condition", async ({ page }) => {
  await insert(page, CASES);
  await tap(page, ["x"]);
  const line = cases("x", PH, PH, PH);
  expect(await del(page)).toBe(line);
  expect(await selected(page)).toBe(PH);
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe(cases("x", "0", PH, PH));
});

// ---- at the first cell: a filled table is selected first (point 4) ----------------------------------------------------
test("5 matrix 2 3 ◀ ◀ ⌫ selects the matrix, the next ⌫ deletes it, and the 5 stays", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, MATRIX);
  await tap(page, ["d2", "d3", "left", "left"]);
  const line = `5${m22("23", PH, PH, PH)}`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(m22("23", PH, PH, PH));
  expect(await bksp(page)).toBe("5");
});

// ---- ⌫ right after a table steps into its last cell (point 5) ---------------------------------------------------------
test("5, a filled matrix, ⌫ from the end of the line steps into the last cell and deletes nothing", async ({ page }) => {
  const line = await filledMatrix(page);
  await cmd(page, "moveToMathfieldEnd");
  expect(await bksp(page)).toBe(line);
  expect(await bksp(page)).toBe(`5${m22("1", "2", "3", PH)}`);
});

test("5, a filled matrix, Del from before it steps into the first cell and deletes nothing", async ({ page }) => {
  const line = await filledMatrix(page);
  await cmd(page, "moveToMathfieldStart");
  await cmd(page, "moveToNextChar");
  expect(await del(page)).toBe(line);
  expect(await del(page)).toBe(`5${m22(PH, "2", "3", "4")}`);
});

test("5, a filled matrix: repeated ⌫ from the end empties the line, one cell at a time (point 8)", async ({ page }) => {
  await filledMatrix(page);
  await cmd(page, "moveToMathfieldEnd");
  const seen: string[] = [];
  for (let i = 0; i < 16 && (await entryValue(page)) !== ""; i++) seen.push(await bksp(page));
  expect(seen.at(-1)).toBe("");
  // each cell shows □ before the matrix goes, and the matrix goes before the 5
  for (const v of [m22("1", "2", "3", PH), m22("1", "2", PH, PH), m22("1", PH, PH, PH), m22(PH, PH, PH, PH)]) {
    expect(seen).toContain(`5${v}`);
  }
  expect(seen.at(-2)).toBe("5");
});
