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
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("5\\sin\\left(23\\right)");
});

/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });

test("a filled log base: ⌫ at the start of the argument steps into the base; at the start of the base it selects the whole template, then deletes it (nothing from two boxes joins)", async ({ page }) => {
  await tmpl(page, "logbase");
  await tap(page, ["d1", "d6", "right", "d2", "left"]);
  expect(await entryValue(page)).toBe("\\log_{16}\\left(2\\right)");
  // (R26h: the base is a box; point 3 of "⌫ and Del keep a template whole")
  expect(await bksp(page)).toBe("\\log_{16}\\left(2\\right)");
  expect(await selected(page)).toBe("");
  await tap(page, ["left", "left"]);
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

// (R26f: the body is lim's last box, so ⌫ at its start steps back through the bounds, "keep a template whole" point
// 3; at the start of the first bound, with only the body typed, the body stays, point 4)
test("lim with empty bounds: ⌫ at the start of its body steps back through the bounds, then keeps the body", async ({ page }) => {
  await tmpl(page, "limit");
  await page.evaluate(() => window.pascaline.entry.field?.executeCommand("moveToMathfieldEnd"));
  await tap(page, ["left", "d7", "left"]);
  const line = "\\lim_{\\placeholder{}\\to\\placeholder{}}\\left(7\\right)";
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line); // to the target's □
  expect(await bksp(page)).toBe(line); // to the variable's □
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

// R26c (F15): ⌫ right after a pair steps into its body and deletes nothing (decisions.md "⌫ and Del keep a template
// whole", point 5); MathLive alone set the closing bracket to `\right.`, and no key types it back. Del right before a
// function name or an opening bracket is the mirror. An emptied body shows □ (point 2), and the next ⌫ removes the
// template (R23). G2 item 46 is open: these follow the default.
const PAIRS: [keys: string[], open: string, close: string][] = [
  [["sin"], "\\sin\\left(", "\\right)"],
  [["shift", "sin"], "\\arcsin\\left(", "\\right)"],
  [["cos"], "\\cos\\left(", "\\right)"],
  [["tan"], "\\tan\\left(", "\\right)"],
  [["ln"], "\\ln\\left(", "\\right)"],
  [["log"], "\\log\\left(", "\\right)"],
  [["paren"], "\\left(", "\\right)"],
  [["shift", "neg"], "\\left|", "\\right|"],
  [["shift", "enter"], "\\operatorname{\\mathrm{approx}}\\left(", "\\right)"],
];

for (const [keys, open, close] of PAIRS) {
  test(`${keys.join(" ")} 2 ▶ ⌫ steps into the body; ⌫ ⌫ then empties the line`, async ({ page }) => {
    await tap(page, [...keys, "d2", "right"]);
    expect(await entryValue(page)).toBe(`${open}2${close}`);
    expect(await bksp(page)).toBe(`${open}2${close}`);
    await tap(page, ["d7"]);
    expect(await entryValue(page)).toBe(`${open}27${close}`);
    await tap(page, ["right"]);
    expect(await bksp(page)).toBe(`${open}27${close}`);
    expect(await bksp(page)).toBe(`${open}2${close}`);
    expect(await bksp(page)).toBe(`${open}\\placeholder{}${close}`);
    expect(await bksp(page)).toBe("");
  });
}

test("sin 2 ▶ ⌫ ⌫ 3 gives sin(3), not sin(3 with the bracket gone", async ({ page }) => {
  await tap(page, ["sin", "d2", "right"]);
  expect(await bksp(page)).toBe("\\sin\\left(2\\right)");
  expect(await bksp(page)).toBe("\\sin\\left(\\placeholder{}\\right)");
  await tap(page, ["d3"]);
  expect(await entryValue(page)).toBe("\\sin\\left(3\\right)");
});

test("5 |2| ▶ ⌫ keeps both bars; a function inside a sum keeps its pair", async ({ page }) => {
  await tap(page, ["d5", "shift", "neg", "d2", "right"]);
  expect(await bksp(page)).toBe("5\\left|2\\right|");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d1", "add", "log", "d2", "right"]);
  expect(await bksp(page)).toBe("1+\\log\\left(2\\right)");
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toBe("1+\\log\\left(25\\right)");
});

test("sin sin 2 ▶ ▶ then ⌫ until the line is empty: one step at a time, no half pair", async ({ page }) => {
  await tap(page, ["sin", "sin", "d2", "right", "right"]);
  const s = (body: string): string => `\\sin\\left(${body}\\right)`;
  expect(await entryValue(page)).toBe(s(s("2")));
  expect(await bksp(page)).toBe(s(s("2"))); // into the outer body
  expect(await bksp(page)).toBe(s(s("2"))); // into the inner body
  expect(await bksp(page)).toBe(s(s("\\placeholder{}")));
  expect(await bksp(page)).toBe(s("\\placeholder{}"));
  expect(await bksp(page)).toBe("");
});

test("from the end of 5 sin 2, ⌫ reaches the empty line with no half pair", async ({ page }) => {
  await tap(page, ["d5", "sin", "d2", "right"]);
  const lines: string[] = [];
  for (let i = 0; i < 5; i++) lines.push(await bksp(page));
  noHalfPair(lines);
  expect(lines).toEqual(["5\\sin\\left(2\\right)", "5\\sin\\left(\\placeholder{}\\right)", "5", "", ""]);
});

test("the one-line √: √ 2 ▶ ⌫ steps into the body; the name goes with its pair", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setEntry("line"));
  await tap(page, ["shift", "sq", "d2", "right"]);
  const open = "\\operatorname{\\mathrm{sqrt}}\\left(";
  expect(await entryValue(page)).toBe(`${open}2\\right)`);
  expect(await bksp(page)).toBe(`${open}2\\right)`);
  expect(await bksp(page)).toBe(`${open}\\placeholder{}\\right)`);
  expect(await bksp(page)).toBe("");
});

/** Put the cursor at the start of the line. */
const toStart = (page: Page): Promise<void> =>
  page.evaluate(() => window.pascaline.entry.field?.executeCommand("moveToMathfieldStart")).then(() => undefined);

test("Del mirror: Del right before a function name steps to the start of its body and deletes nothing", async ({ page }) => {
  await tap(page, ["sin", "d2"]);
  await toStart(page);
  expect(await del(page)).toBe("\\sin\\left(2\\right)");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("\\sin\\left(72\\right)");
  await toStart(page);
  expect(await del(page)).toBe("\\sin\\left(72\\right)");
  expect(await del(page)).toBe("\\sin\\left(2\\right)");
  expect(await del(page)).toBe("\\sin\\left(\\placeholder{}\\right)");
  expect(await del(page)).toBe("");
});

test("Del mirror: before an opening bracket, and from the start of 5 sin 2 to the empty line", async ({ page }) => {
  await tap(page, ["d5", "shift", "neg", "d2"]);
  await toStart(page);
  expect(await del(page)).toBe("\\left|2\\right|");
  expect(await del(page)).toBe("\\left|2\\right|");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("\\left|72\\right|");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d5", "sin", "d2"]);
  await toStart(page);
  const lines: string[] = [];
  for (let i = 0; i < 5; i++) lines.push(await del(page));
  noHalfPair(lines);
  expect(lines).toEqual([
    "\\sin\\left(2\\right)",
    "\\sin\\left(2\\right)",
    "\\sin\\left(\\placeholder{}\\right)",
    "",
    "",
  ]);
});

test("Shift + Cancel (undo) after sin 2 ▶ ⌫ ⌫ brings the 2 back", async ({ page }) => {
  await tap(page, ["sin", "d2", "right"]);
  await bksp(page);
  expect(await bksp(page)).toBe("\\sin\\left(\\placeholder{}\\right)");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("\\sin\\left(2\\right)");
});

test("hardware Backspace right after a closing bracket takes the same path", async ({ page }) => {
  await tap(page, ["sin", "d2", "right"]);
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("\\sin\\left(2\\right)");
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("\\sin\\left(\\placeholder{}\\right)");
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("");
});
