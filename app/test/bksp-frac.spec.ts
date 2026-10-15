// SPDX-License-Identifier: GPL-3.0-or-later
// R26e (bug F18): ⌫ and Del at a fraction or a root. MathLive's own delete removes an emptied index or part (`\sqrt[3]{8}`
// minus the 3 is `\sqrt8`, and Enter computes √8), joins a fraction's parts at the start of the denominator (`5 ÷ 2 3
// ◀ ◀ ⌫` gave 523), leaves a root at the start of its index and deletes what stands before it, and deletes ∂ marks
// alone. The rule (decisions.md "⌫ and Del keep a template whole", points 2-5): an emptied box shows □; ⌫ at the start
// of a box but the first steps to the end of the box before it; ⌫ at the start of the first box removes the template
// when every box is empty, keeps the main box's content when only it holds something, and selects the template first
// otherwise (ⁿ√: first whenever anything is typed, brief R26e); a key's argument (the numerator ÷ took, a mixed
// number's whole part) with every other box empty goes back alone, as an empty exponent on a typed base (R26d).
// By keys; expected lines derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const PH = "\\placeholder{}";
const MIXED = "#@\\tfrac{#?}{#?}";
const DERIV = "\\frac{\\partial#0}{\\partial#?}";

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
/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });
const position = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.entry.field?.position ?? -1);

// ---- ⁿ√ -------------------------------------------------------------------------------------------------------------
test("ⁿ√ on an empty line, then ⌫ in the empty index empties the line", async ({ page }) => {
  await tap(page, ["shift", "pow"]);
  expect(await entryValue(page)).toBe(`\\sqrt[${PH}]{${PH}}`);
  expect(await bksp(page)).toBe("");
});

test("³√8 with the 3 deleted keeps the index □, and 4 typed there gives ⁴√8", async ({ page }) => {
  await tap(page, ["shift", "pow", "d3", "right", "d8", "left", "left"]);
  expect(await entryValue(page)).toBe("\\sqrt[3]{8}");
  expect(await bksp(page)).toBe(`\\sqrt[${PH}]{8}`);
  expect(await selected(page)).toBe(PH);
  await tap(page, ["d4"]);
  expect(await entryValue(page)).toBe("\\sqrt[4]{8}");
});

test("5 ⁿ√ 2 3 ◀ ◀ ⌫ selects the root, the next ⌫ deletes it, and the 5 stays", async ({ page }) => {
  await tap(page, ["d5", "shift", "pow", "d2", "d3", "left", "left"]);
  const line = `5\\sqrt[23]{${PH}}`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(`\\sqrt[23]{${PH}}`);
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

test("⌫ at the start of ⁿ√'s radicand steps to the end of the index", async ({ page }) => {
  await tap(page, ["shift", "pow", "d3", "right", "d8", "left"]);
  expect(await bksp(page)).toBe("\\sqrt[3]{8}");
  await tap(page, ["d1"]);
  expect(await entryValue(page)).toBe("\\sqrt[31]{8}");
});

test("⁴√8 ⌫ from the end: into the radicand, □, back to the index, □, then the root goes", async ({ page }) => {
  await tap(page, ["shift", "pow", "d4", "right", "d8", "right"]);
  expect(await bksp(page)).toBe("\\sqrt[4]{8}"); // steps in
  expect(await bksp(page)).toBe(`\\sqrt[4]{${PH}}`);
  expect(await bksp(page)).toBe(`\\sqrt[4]{${PH}}`); // steps to the end of the index
  expect(await bksp(page)).toBe(`\\sqrt[${PH}]{${PH}}`);
  expect(await bksp(page)).toBe("");
});

// ---- √ --------------------------------------------------------------------------------------------------------------
test("5 √ 2 3 ◀ ◀ ⌫ keeps the content, as a bracket does (F10): 523", async ({ page }) => {
  await tap(page, ["d5", "shift", "sq", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("523");
});

test("5 √ 2 ⌫ shows □ in the root, and ⌫ ⌫ then gives 5 and the empty line", async ({ page }) => {
  await tap(page, ["d5", "shift", "sq", "d2"]);
  expect(await bksp(page)).toBe(`5\\sqrt{${PH}}`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

test("√ 2 then Del at the end of the root keeps the 2", async ({ page }) => {
  await tap(page, ["shift", "sq", "d2"]);
  expect(await del(page)).toBe("2");
});

// ---- fractions ------------------------------------------------------------------------------------------------------
// G2 item 47 (the owner's G2, 2026-10-15): ⌫ at the start of the denominator dissolves the fraction and joins its
// parts, the cursor between them (5‸23)
test("5 ÷ 2 3 ◀ ◀ ⌫ joins the parts as on the G2: 5‸23", async ({ page }) => {
  await tap(page, ["d5", "div", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("523");
  expect(await position(page)).toBe(1);
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("5723");
});

test("÷ ▶ 2 3 ◀ ◀ ⌫ with an empty numerator leaves 23, the cursor before it", async ({ page }) => {
  await tap(page, ["div", "right", "d2", "d3", "left", "left"]);
  expect(await entryValue(page)).toBe(`\\frac{${PH}}{23}`);
  expect(await bksp(page)).toBe("23");
  expect(await position(page)).toBe(0);
});

test("÷ inside a sum: 1 + 5 ÷ 2 3 ◀ ◀ ⌫ joins only the fraction's parts", async ({ page }) => {
  await tap(page, ["d1", "add", "d5", "div", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("1+523");
  expect(await position(page)).toBe(3);
});

for (const key of ["div", "frac"]) {
  test(`5 ${key} ⌫ gives 5 back: the key took the 5, the empty part goes with it`, async ({ page }) => {
    await tap(page, ["d5", key]);
    expect(await entryValue(page)).toBe(`\\frac{5}{${PH}}`);
    expect(await bksp(page)).toBe("5");
    expect(await position(page)).toBe(1);
  });
}

test("÷ ÷ on an empty line (a nested fraction), then ⌫ ⌫ empties the line through a □ numerator", async ({ page }) => {
  await tap(page, ["div", "div"]);
  expect(await entryValue(page)).toBe(`\\frac{\\frac{${PH}}{${PH}}}{${PH}}`);
  expect(await bksp(page)).toBe(`\\frac{${PH}}{${PH}}`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("");
});

test("2 + ÷ 2 ▶ 3 4 ◀ ◀ ◀ ◀ ⌫ at the start of the numerator selects the fraction, and the + stays", async ({ page }) => {
  await tap(page, ["d2", "add", "div", "d2", "right", "d3", "d4", "left", "left", "left", "left"]);
  const line = "2+\\frac{2}{34}";
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe("\\frac{2}{34}");
  expect(await bksp(page)).toBe("2+");
});

test("5/23 with the cursor at the end of the numerator, Del joins the parts (the mirror of ⌫): 5‸23", async ({ page }) => {
  await tap(page, ["d5", "div", "d2", "d3", "left", "left", "left"]);
  expect(await entryValue(page)).toBe("\\frac{5}{23}");
  expect(await position(page)).toBe(2);
  expect(await del(page)).toBe("523");
  expect(await position(page)).toBe(1);
});

// review: the parts' LaTeX was glued with no separator, so a numerator ending in a control word ran into a letter
// (\pi + x gave \pix, one unknown command)
test("π ÷ x ◀ ⌫ joins the parts as π‸x, not one unknown command", async ({ page }) => {
  await tap(page, ["shift", "d3", "div", "x", "left"]);
  expect(await entryValue(page)).toBe("\\frac{\\pi}{x}");
  expect(await bksp(page)).toBe("\\pi x");
  expect(await position(page)).toBe(1);
});

test("π ÷ x ◀ ◀ Del at the end of the numerator joins the parts as π‸x (the mirror)", async ({ page }) => {
  await tap(page, ["shift", "d3", "div", "x", "left", "left"]);
  expect(await entryValue(page)).toBe("\\frac{\\pi}{x}");
  expect(await del(page)).toBe("\\pi x");
  expect(await position(page)).toBe(1);
});

// ---- the mixed number -----------------------------------------------------------------------------------------------
test("the mixed number on an empty line, then ⌫ empties the line", async ({ page }) => {
  await insert(page, MIXED);
  expect(await entryValue(page)).toBe(`${PH}\\tfrac{${PH}}{${PH}}`);
  expect(await bksp(page)).toBe("");
});

test("5 mixed ⌫ gives 5 back", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, MIXED);
  expect(await bksp(page)).toBe("5");
});

test("5 mixed 2 3 ◀ ◀ ⌫ ⌫ keeps the whole part's box and the fraction", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, MIXED);
  await tap(page, ["d2", "d3", "left", "left"]);
  const line = `5\\tfrac{23}{${PH}}`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line); // to the end of the whole part
  expect(await position(page)).toBe(1);
  expect(await bksp(page)).toBe(`${PH}\\tfrac{23}{${PH}}`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(`${PH}\\tfrac{23}{${PH}}`); // selects the mixed number
  expect(await bksp(page)).toBe("");
});

// ---- ∂ --------------------------------------------------------------------------------------------------------------
test("∂ on an empty line, then ⌫ empties the line", async ({ page }) => {
  await insert(page, DERIV);
  expect(await bksp(page)).toBe("");
});

test("5 ∂ 2 3 ◀ ◀ ⌫ never deletes a ∂ alone: only the expression holds something, so it stays", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, DERIV);
  await tap(page, ["d2", "d3", "left", "left"]);
  expect(await entryValue(page)).toBe(`5\\frac{\\partial23}{\\partial${PH}}`);
  expect(await bksp(page)).toBe("523");
  expect(await position(page)).toBe(1);
});

test("∂ 2 ▶ x, then ⌫ to the empty line: the two ∂ marks go together", async ({ page }) => {
  await insert(page, DERIV);
  await tap(page, ["d2", "right"]);
  await page.evaluate(() => window.pascaline.entry.run({ kind: "type", text: "x" }));
  expect(await entryValue(page)).toBe("\\frac{\\partial2}{\\partial x}");
  const seen: string[] = [];
  for (let i = 0; i < 8 && (await entryValue(page)) !== ""; i++) seen.push(await bksp(page));
  expect(seen.at(-1)).toBe("");
  for (const l of seen) expect((l.match(/\\partial/g) ?? []).length % 2).toBe(0);
  expect(seen).toContain(`\\frac{\\partial2}{\\partial${PH}}`);
  expect(seen).toContain(`\\frac{\\partial${PH}}{\\partial${PH}}`);
});

// ---- a template that fills a fraction's part leaves its □ when it goes (point 2) ------------------------------------
for (const [keys, name, presses] of [
  [["paren"], "( )", 1],
  [["shift", "sq"], "√", 1],
  [["sq"], "x²", 2],
] as const) {
  test(`÷ ${name} on an empty line, then ⌫ leaves the numerator's □, and one more ⌫ empties the line`, async ({ page }) => {
    await tap(page, ["div", ...keys]);
    let line = "";
    for (let i = 0; i < presses; i++) line = await bksp(page);
    expect(line).toBe(`\\frac{${PH}}{${PH}}`);
    expect(await selected(page)).toBe(PH);
    expect(await bksp(page)).toBe("");
  });
}
