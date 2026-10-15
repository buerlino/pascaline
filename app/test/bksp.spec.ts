// SPDX-License-Identifier: GPL-3.0-or-later
// R23 (bug F10): ⌫ at a bracket. ⌫ with the cursor right after an opening bracket removes the whole template the
// bracket belongs to (a function's name with it) and keeps what was inside, with the cursor where the bracket was;
// Shift + ⌫ (Del) right before a closing bracket is the mirror (decisions.md "⌫ at a bracket"). MathLive alone sets
// the opening bracket to `\left.` and is stuck there (backlog F10). By keys; expected lines derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const BK = "bksp";
const DEL = ["shift", "bksp"];
const EMPTY_LOG = "\\log\\left(\\placeholder{}\\right)";

/** Press ⌫ once and return the line. */
async function bksp(page: Page): Promise<string> {
  await tap(page, [BK]);
  return entryValue(page);
}
async function del(page: Page): Promise<string> {
  await tap(page, DEL);
  return entryValue(page);
}

/** Tmpl, then a tap on the cell. */
async function tmpl(page: Page, id: string): Promise<void> {
  await tap(page, ["tmpl"]);
  await page.getByTestId("menu").locator(`[data-id="${id}"]`).tap();
  await expect(page.getByTestId("menu")).toBeHidden();
}

/** Every line ⌫ or Del left: a `\left.` belongs only to the evaluate-at bar, a `\right.` to nothing (no half pair). */
function noHalfPair(lines: string[]): void {
  for (const l of lines) {
    const opens = (l.match(/\\left\./g) ?? []).length;
    const bars = (l.match(/\\right\|_/g) ?? []).length;
    expect(opens, `half pair in ${l}`).toBeLessThanOrEqual(bars);
    expect(l, `half pair in ${l}`).not.toMatch(/\\right\./);
  }
}

test("log log, then ⌫ until the line is empty: one ⌫ per log key", async ({ page }) => {
  await tap(page, ["log", "log"]);
  expect(await entryValue(page)).toBe("\\log\\left(\\log\\left(\\placeholder{}\\right)\\right)");
  expect(await bksp(page)).toBe(EMPTY_LOG);
  expect(await bksp(page)).toBe("");
});

for (const [key, name] of [
  ["sin", "\\sin"],
  ["ln", "\\ln"],
] as const) {
  test(`${key} ${key}, then ⌫ until the line is empty`, async ({ page }) => {
    await tap(page, [key, key]);
    expect(await bksp(page)).toBe(`${name}\\left(\\placeholder{}\\right)`);
    expect(await bksp(page)).toBe("");
  });
}

test("√ √, then ⌫ ⌫ empties the line (control: a root already dissolves)", async ({ page }) => {
  await tap(page, ["shift", "sq", "shift", "sq"]);
  expect(await entryValue(page)).toBe("\\sqrt{\\sqrt{\\placeholder{}}}");
  await bksp(page);
  expect(await bksp(page)).toBe("");
});

test("Tmpl log base, then ⌫ until the line is empty", async ({ page }) => {
  await tmpl(page, "logbase");
  expect(await entryValue(page)).toBe("\\log_{\\placeholder{}}\\left(\\placeholder{}\\right)");
  const lines = [await bksp(page)];
  if (lines[0] !== "") lines.push(await bksp(page));
  noHalfPair(lines);
  expect(lines.at(-1)).toBe("");
});

test("log 2 ⌫ ⌫ empties the line; ( ) 2 ⌫ ⌫ too", async ({ page }) => {
  // (the first ⌫ deletes the 2 by MathLive's own path; the box it empties is R26a's point 2)
  await tap(page, ["log", "d2"]);
  noHalfPair([await bksp(page)]);
  expect(await bksp(page)).toBe("");
  await tap(page, ["paren", "d2"]);
  expect(await entryValue(page)).toBe("\\left(2\\right)");
  noHalfPair([await bksp(page)]);
  expect(await bksp(page)).toBe("");
});

test("sin 2 3 ◀ ◀ ⌫ keeps 23, with the cursor before the 2", async ({ page }) => {
  await tap(page, ["sin", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("23");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("723");
});

test("5 ( ) 2 ◀ ⌫ gives 52, with the cursor between them", async ({ page }) => {
  await tap(page, ["d5", "paren", "d2", "left"]);
  expect(await bksp(page)).toBe("52");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("572");
});

test("5 |x| 2 ◀ ⌫ gives 52, with the cursor between them", async ({ page }) => {
  await tap(page, ["d5", "shift", "neg", "d2", "left"]);
  expect(await entryValue(page)).toBe("5\\left|2\\right|");
  expect(await bksp(page)).toBe("52");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("572");
});

test("a function inside a sum: 1 + log 2 ◀ ⌫ gives 1+2", async ({ page }) => {
  await tap(page, ["d1", "add", "log", "d2", "left"]);
  expect(await bksp(page)).toBe("1+2");
});

test("Del right before a closing bracket is the mirror: sin 2 3 then Del keeps 23, cursor after it", async ({ page }) => {
  await tap(page, ["sin", "d2", "d3"]);
  expect(await del(page)).toBe("23");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("237");
});

test("Del mirror: 5 ( ) 2 Del gives 52; log log Del Del empties the line", async ({ page }) => {
  await tap(page, ["d5", "paren", "d2"]);
  expect(await del(page)).toBe("52");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("527");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["log", "log"]);
  expect(await del(page)).toBe(EMPTY_LOG);
  expect(await del(page)).toBe("");
});

test("no half pair after any ⌫ from the keys (the evaluate-at bar owns its \\left.)", async ({ page }) => {
  const seqs: string[][] = [
    ["sin", "d2", "d3", "left", "left"],
    ["d5", "paren", "d2", "left"],
    ["log", "log", "d2"],
    ["d5", "shift", "neg", "d2", "left"],
    ["shift", "enter", "d2", "left"],
    ["sin", "paren", "d2"],
  ];
  for (const s of seqs) {
    await page.evaluate(() => window.pascaline.entry.clear());
    await tap(page, s);
    const lines: string[] = [];
    for (let i = 0; i < 5; i++) lines.push(await bksp(page));
    noHalfPair(lines);
    expect(lines.at(-1), s.join(" ")).not.toContain("\\left");
  }
});

test("evaluate-at: ⌫ at the start of its body removes the template and keeps the body", async ({ page }) => {
  await tmpl(page, "evalat");
  await tap(page, ["d2", "left"]);
  const line = await bksp(page);
  noHalfPair([line]);
  expect(line).toBe("2");
});

test("⌫ still removes one character, one ᴇ and one chip", async ({ page }) => {
  await tap(page, ["d1", "d2"]);
  expect(await bksp(page)).toBe("1");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["emark", "d5"]);
  expect(await entryValue(page)).toBe("1\\emark5");
  expect(await bksp(page)).toBe("1\\emark");
  expect(await bksp(page)).toBe("1");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d2", "add"]);
  await page.evaluate(() => window.pascaline.entry.insertResult("7", { value: "7", exact: true }));
  expect(await entryValue(page)).toBe("2+\\res{1}{7}");
  expect(await bksp(page)).toBe("2+");
});

test("Shift + Cancel (undo) brings the removed template back whole", async ({ page }) => {
  await tap(page, ["d5", "sin", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("523");
  await tap(page, ["shift", "cancel"]);
  expect(await entryValue(page)).toBe("5\\sin\\left(23\\right)");
});

/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });

test("a filled log base: the first ⌫ selects the whole template, the second deletes it (nothing from two boxes joins)", async ({ page }) => {
  await tmpl(page, "logbase");
  await tap(page, ["d1", "d6", "right", "d2", "left"]);
  expect(await entryValue(page)).toBe("\\log_{16}\\left(2\\right)");
  expect(await bksp(page)).toBe("\\log_{16}\\left(2\\right)");
  expect(await selected(page)).toBe("\\log_{16}\\left(2\\right)");
  expect(await bksp(page)).toBe("");
});

test("an exponent on a bracket stays on it: ⌫ at the start of (1+2)² selects it whole", async ({ page }) => {
  await tap(page, ["paren", "d1", "add", "d2", "right", "sq"]);
  expect(await entryValue(page)).toBe("\\left(1+2\\right)^2");
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 1; // the start of the body
  });
  expect(await bksp(page)).toBe("\\left(1+2\\right)^2");
  expect(await selected(page)).toBe("\\left(1+2\\right)^2");
  expect(await bksp(page)).toBe("");
});

test("lim with empty bounds: ⌫ at the start of its body keeps the body", async ({ page }) => {
  await tmpl(page, "limit");
  await page.evaluate(() => window.pascaline.entry.field?.executeCommand("moveToMathfieldEnd"));
  await tap(page, ["left", "d7", "left"]);
  expect(await entryValue(page)).toBe("\\lim_{\\placeholder{}\\to\\placeholder{}}\\left(7\\right)");
  expect(await bksp(page)).toBe("7");
});

test("EQ: ⌫ at the start of its first value with the second one filled selects the whole template", async ({ page }) => {
  await page.evaluate(() => window.pascaline.entry.set("\\operatorname{EQ}\\left(2,3\\right)"));
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 5; // the start of the body (after the name's letters)
  });
  expect(await bksp(page)).toBe("\\operatorname{EQ}\\left(2,3\\right)");
  expect(await selected(page)).toBe("\\operatorname{EQ}\\left(2,3\\right)");
});

// R26b (F16): the hardware Backspace and Delete take the same path as the on-screen keys
test("hardware Backspace: log log, then four presses reach the empty line", async ({ page }) => {
  await tap(page, ["log", "log"]);
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe(EMPTY_LOG);
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("");
});

test("hardware Delete is the mirror: sin 2 3 then Delete keeps 23; log log Delete Delete empties the line", async ({ page }) => {
  await tap(page, ["sin", "d2", "d3"]);
  await page.keyboard.press("Delete");
  expect(await entryValue(page)).toBe("23");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["log", "log"]);
  await page.keyboard.press("Delete");
  expect(await entryValue(page)).toBe(EMPTY_LOG);
  await page.keyboard.press("Delete");
  expect(await entryValue(page)).toBe("");
});
