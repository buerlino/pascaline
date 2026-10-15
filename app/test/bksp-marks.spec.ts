// SPDX-License-Identifier: GPL-3.0-or-later
// R26h (bug F21): ⌫ and Del at the log base, EQ, DMS and evaluate-at templates. MathLive's own delete removes the
// whole `\log_{…}` on any ⌫ in its base (mathlive.mjs 31863), deletes EQ's comma and DMS's ° ′ ″ as plain atoms, takes a
// □ as an atom (`EQ(,□)`), and leaves evaluate-at's subscript without its bar. The rule (decisions.md "⌫ and Del keep
// a template whole", points 1-5): the comma, ° ′ ″ and the bar are marks of their template; an emptied box shows □;
// ⌫ at the start of a box but the first steps to the end of the box before it, and Del is the mirror; at the first box
// an empty template goes in one ⌫, one that holds only its main box (#0) keeps it, and any other is selected first;
// ⌫ right after a template steps into its last box. In the log base ⌫ deletes one character. By keys; the palette cells
// by the key path (`run`), as the Tmpl palette inserts them. Expected lines derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const PH = "\\placeholder{}";
const LOGB = "\\log_{#?}\\left(#0\\right)";
const EQ = "\\operatorname{EQ}\\left(#0,#?\\right)";
const DMS = "#?\\degree#?\\prime#?\\doubleprime";
const EVAL = "\\left.#0\\right|_{#?=#?}";
/** (MathLive writes a one-character base without braces) */
const logb = (b: string, a: string): string => `\\log_${b.length === 1 ? b : `{${b}}`}\\left(${a}\\right)`;
const eq = (a: string, b: string): string => `\\operatorname{\\mathrm{EQ}}\\left(${a},${b}\\right)`;
const dms = (d: string, m: string, s: string): string => `${d}\\degree${m}\\prime${s}\\doubleprime`;
const at = (e: string, v: string, a: string): string => `\\left.${e}\\right|_{${v}=${a}}`;

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
const position = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.entry.field?.position ?? -1);

// ---- every template on an empty line goes in one ⌫ (point 4) ------------------------------------------------------------
for (const [name, latex] of [["log base", LOGB], ["EQ", EQ], ["DMS", DMS], ["evaluate-at", EVAL]] as const) {
  test(`${name} on an empty line, then ⌫ empties the line`, async ({ page }) => {
    await insert(page, latex);
    expect(await bksp(page)).toBe("");
  });

  test(`5 ${name}, then ⌫ ⌫: the template goes whole, then the 5`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    expect(await bksp(page)).toBe("5");
    expect(await bksp(page)).toBe("");
  });
}

// ---- log base -------------------------------------------------------------------------------------------------------
test("log base 16, then ⌫ deletes the 6 alone; the base shows □, then the template goes", async ({ page }) => {
  await insert(page, LOGB);
  await tap(page, ["d1", "d6"]);
  expect(await entryValue(page)).toBe(logb("16", PH));
  expect(await bksp(page)).toBe(logb("1", PH));
  expect(await bksp(page)).toBe(logb(PH, PH));
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("");
});

test("5 log base 2 3 ◀ ◀ ⌫ selects the template, the next ⌫ deletes it, and the 5 stays", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, LOGB);
  await tap(page, ["d2", "d3", "left", "left"]);
  const line = `5${logb("23", PH)}`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(logb("23", PH));
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

test("log base 16 ▶ 8, ⌫ at the start of the argument steps to the end of the base, and nothing goes", async ({ page }) => {
  await insert(page, LOGB);
  await tap(page, ["d1", "d6", "right", "d8", "left"]);
  const line = logb("16", "8");
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await bksp(page)).toBe(logb("1", "8")); // one character of the base
});

test("log base 2, then Del: into the argument, then the template is selected and goes", async ({ page }) => {
  await insert(page, LOGB);
  await tap(page, ["d2"]);
  const line = logb("2", PH);
  expect(await del(page)).toBe(line); // to the argument's □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // the base holds the 2: selected first
  expect(await selected(page)).toBe(line);
  expect(await del(page)).toBe("");
});

test("log base with only the argument typed: ⌫ in the empty base keeps the argument", async ({ page }) => {
  await insert(page, LOGB);
  await tap(page, ["right", "d8", "d1"]);
  expect(await entryValue(page)).toBe(logb(PH, "81"));
  await cmd(page, "moveToMathfieldStart");
  await cmd(page, "moveToNextChar");
  expect(await bksp(page)).toBe("81");
});

test("5 log base 2, ⌫ from the end of the line: into the argument, back to the base, one digit, then the template", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, LOGB);
  await tap(page, ["d2"]);
  await cmd(page, "moveToMathfieldEnd");
  const line = `5${logb("2", PH)}`;
  expect(await bksp(page)).toBe(line); // into the argument: never the bracket alone
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(line); // to the end of the base
  expect(await bksp(page)).toBe(`5${logb(PH, PH)}`);
  expect(await bksp(page)).toBe("5");
});

// ---- EQ -----------------------------------------------------------------------------------------------------------------
test("5 EQ 2, ⌫: the first box shows □ (no bare comma), then the template goes, then the 5", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, EQ);
  await tap(page, ["d2"]);
  expect(await bksp(page)).toBe(`5${eq(PH, PH)}`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

test("EQ 2, Del before the comma: into the second box, the comma stays; the next Del keeps the 2", async ({ page }) => {
  await insert(page, EQ);
  await tap(page, ["d2"]);
  const line = eq("2", PH);
  expect(await del(page)).toBe(line);
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe("2"); // only the main box holds something: it stays
});

test("EQ 2 ▶ 3 ◀, ⌫ at the start of the second box steps to the end of the first, and nothing goes", async ({ page }) => {
  await insert(page, EQ);
  await tap(page, ["d2", "right", "d3", "left"]);
  const line = eq("2", "3");
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe(eq("27", "3"));
});

test("EQ 2 ▶ 3, ⌫ from the end of the line: back through both boxes, the comma stays until the template goes", async ({ page }) => {
  await insert(page, EQ);
  await tap(page, ["d2", "right", "d3"]);
  await cmd(page, "moveToMathfieldEnd");
  const line = eq("2", "3");
  expect(await bksp(page)).toBe(line); // into the second box
  expect(await bksp(page)).toBe(eq("2", PH));
  expect(await bksp(page)).toBe(eq("2", PH)); // to the end of the first box
  expect(await bksp(page)).toBe(eq(PH, PH));
  expect(await bksp(page)).toBe("");
});

// ---- DMS ------------------------------------------------------------------------------------------------------------
test("DMS 2 3 ▶ 4 ▶ 6, ⌫ from the end of the line: the marks stay, each emptied box shows □, then the template goes", async ({ page }) => {
  await insert(page, DMS);
  await tap(page, ["d2", "d3", "right", "d4", "right", "d6"]);
  await cmd(page, "moveToMathfieldEnd");
  expect(await entryValue(page)).toBe(dms("23", "4", "6"));
  expect(await bksp(page)).toBe(dms("23", "4", "6")); // into the seconds
  expect(await bksp(page)).toBe(dms("23", "4", PH));
  expect(await bksp(page)).toBe(dms("23", "4", PH)); // to the end of the minutes
  expect(await bksp(page)).toBe(dms("23", PH, PH));
  expect(await bksp(page)).toBe(dms("23", PH, PH)); // to the end of the degrees
  expect(await bksp(page)).toBe(dms("2", PH, PH));
  expect(await bksp(page)).toBe(dms(PH, PH, PH));
  expect(await bksp(page)).toBe("");
});

test("DMS 2, then Del: the marks stay, every box is visited, then the template is selected and goes", async ({ page }) => {
  await insert(page, DMS);
  await tap(page, ["d2"]);
  const line = dms("2", PH, PH);
  expect(await del(page)).toBe(line); // to the minutes' □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // to the seconds' □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // the degrees hold the 2: selected first
  expect(await selected(page)).toBe(line);
  expect(await del(page)).toBe("");
});

test("DMS 3 0 ▶ 1 5 ◀ ◀, ⌫ at the start of the minutes steps to the end of the degrees", async ({ page }) => {
  await insert(page, DMS);
  await tap(page, ["d3", "d0", "right", "d1", "d5", "left", "left"]);
  const line = dms("30", "15", PH);
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await bksp(page)).toBe(dms("3", "15", PH));
});

test("x DMS 2 3 ◀ ◀ ⌫: before typed degrees the cursor is on the line, so ⌫ deletes the x and the template stays whole", async ({ page }) => {
  await tap(page, ["x"]);
  await insert(page, DMS);
  await tap(page, ["d2", "d3", "left", "left"]);
  expect(await entryValue(page)).toBe(`x${dms("23", PH, PH)}`);
  expect(await bksp(page)).toBe(dms("23", PH, PH));
});

// ---- evaluate-at ----------------------------------------------------------------------------------------------------
test("5 evaluate-at 2 ▶ x ▶ 3, ⌫ from the end of the line: the bar and = stay, each box shows □, then the template goes", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, EVAL);
  await tap(page, ["d2", "right", "x", "right", "d3"]);
  await cmd(page, "moveToMathfieldEnd");
  expect(await entryValue(page)).toBe(`5${at("2", "x", "3")}`);
  expect(await bksp(page)).toBe(`5${at("2", "x", "3")}`); // into the value
  expect(await bksp(page)).toBe(`5${at("2", "x", PH)}`);
  expect(await bksp(page)).toBe(`5${at("2", "x", PH)}`); // to the end of the variable
  expect(await bksp(page)).toBe(`5${at("2", PH, PH)}`);
  expect(await bksp(page)).toBe(`5${at("2", PH, PH)}`); // to the end of the body
  expect(await bksp(page)).toBe(`5${at(PH, PH, PH)}`);
  expect(await bksp(page)).toBe("5");
});

test("evaluate-at 2, Del right before the bar: into the variable, the bar stays", async ({ page }) => {
  await insert(page, EVAL);
  await tap(page, ["d2"]);
  const line = at("2", PH, PH);
  expect(await del(page)).toBe(line);
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // to the value's □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe("2"); // only the body holds something: it stays
});

test("evaluate-at ▶ x ▶ 3, ⌫ in the empty body with the boxes typed selects the template first", async ({ page }) => {
  await insert(page, EVAL);
  await tap(page, ["right", "x", "right", "d3"]);
  await cmd(page, "moveToMathfieldStart");
  await cmd(page, "moveToNextChar");
  const line = at(PH, "x", "3");
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(line);
  expect(await bksp(page)).toBe("");
  expect(await position(page)).toBe(0);
});
