// SPDX-License-Identifier: GPL-3.0-or-later
// R17: a selection survives every key. The contract (spec/keyboard.yaml header, docs/decisions.md "A selection is the
// argument of the key"):
//   1. a non-empty selection is the argument of any key with an argument slot (functions: inside the brackets; ÷ and
//      a/b: the numerator; roots: the radicand; power keys: the base, in brackets unless it is one plain term);
//   2. keys with no argument slot, and operators and typed characters, replace the selection, as typing does;
//   3. with nothing selected every key does what it did before;
//   4. checked for EVERY key and layer in the yaml (and every Tmpl cell), so a key added later cannot break it.
// Expected strings are derived by hand: `(1+2)^2` is 9, `(1+2)^-1` is 1/3. The values themselves are checked through the
// parser in src/input/selection.test.ts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { entryValue, open, tap } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const doc = parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as {
  keys: Record<string, unknown>[];
  templates: { items: { id: string; key?: string; layer?: string; insert?: string; line?: { insert?: string } }[] };
};

type Layer = "primary" | "shift" | "alpha";
interface Act { insert?: string; type?: string; line?: Act }
const LAYERS: Layer[] = ["primary", "shift", "alpha"];

/**
 * Insert actions that take NO argument, so a selection is replaced (rule 2). `key/layer` or `key/layer/line`.
 * Each has its reason; a new key that is not an argument-taker must be added here on purpose (keyboard.test.ts has the
 * same list for the templates).
 */
const REPLACES = new Set([
  "eex/primary", // the exponent mark ×10ⁿ: a mark, not a function (R14 makes it a typed character)
  "eex/shift", // ▸ store: after the value, before the name
  "d9/shift", // ∞: a constant
  "mul/primary", // ×: an operator
  "mul/shift", // ∡: an operator (polar form)
  "d2/shift", // i: a constant
  "d3/shift", // π: a constant
  "add/shift", // Ans: a value
  "div/primary/line", // ÷ in one-line entry: an operator
  "frac/primary/line", // a b/c in one-line entry: an operator
]);
/** Typed keys that do not touch a selection at all (a space in math mode is ignored; Shift + space is the subscript mark). */
const IGNORES = new Set(["space/primary", "space/shift"]);
const NO_ARGUMENT_CELLS = new Set([
  "cases", // a table of two lines: no main argument
  "matrix22",
  "rowvec",
  "colvec", // cells of a matrix are not an argument
  "dms", // three boxes of equal standing: none is the argument
]);

const act = (key: Record<string, unknown>, layer: Layer, line: boolean): Act | undefined => {
  const a = key[layer] as Act | undefined;
  return line ? (a?.line ?? a) : a;
};

const keyIds = doc.keys.map((k) => k["id"] as string);

async function select(page: Page, latex: string, from?: number, to?: number): Promise<void> {
  await page.evaluate(
    ([l, a, b]) => {
      const mf = window.pascaline.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = l as string;
      mf.focus();
      if (a === undefined) mf.executeCommand("selectAll");
      else mf.selection = { ranges: [[a as number, b as number]] };
    },
    [latex, from, to] as const,
  );
}

async function press(page: Page, id: string, layer: Layer): Promise<void> {
  await tap(page, layer === "primary" ? [id] : [layer, id]);
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("every key and layer, normal and one-line entry: 1+2 selected stays an argument or is replaced (rules 1, 2)", async ({ page }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];
  let pressed = 0;
  for (const line of [false, true]) {
    await page.evaluate((l) => window.pascaline.session.setEntry(l ? "line" : "textbook"), line);
    for (const key of doc.keys) {
      for (const layer of LAYERS) {
        const a = act(key, layer, line);
        if (!a || (a.insert === undefined && a.type === undefined)) continue; // specials and commands move or act, they do not take an argument
        if (line && (key[layer] as Act).line === undefined) continue; // the same action as in textbook entry
        const id = key["id"] as string;
        await select(page, "1+2");
        await press(page, id, layer);
        const value = await entryValue(page);
        const label = `${id}/${layer}${line ? "/line" : ""}`;
        if (IGNORES.has(label)) continue;
        const replaces = a.type !== undefined || REPLACES.has(label);
        pressed++;
        if (replaces) {
          if (value.includes("1+2")) failures.push(`${label} should replace the selection but left ${value}`);
        } else if (!value.includes("1+2")) failures.push(`${label} lost the selection: ${value}`);
      }
    }
  }
  expect(pressed).toBeGreaterThan(60); // 82 today: the keys and layers with an insert or a typed character, plus the one-line forms
  expect(failures).toEqual([]);
});

test("every Tmpl cell with 1+2 selected: an argument slot takes it, the others replace it", async ({ page }) => {
  test.setTimeout(120_000);
  const failures: string[] = [];
  for (const item of doc.templates.items) {
    const own = item.key === undefined;
    if (!own) continue; // a cell that is a key's template is that key's row above
    await select(page, "1+2");
    await tap(page, ["tmpl"]);
    await page.getByTestId("menu").locator(`[data-id="${item.id}"]`).tap();
    const value = await entryValue(page);
    if (NO_ARGUMENT_CELLS.has(item.id)) {
      if (value.includes("1+2")) failures.push(`${item.id} should replace the selection but left ${value}`);
    } else if (!value.includes("1+2")) failures.push(`${item.id} lost the selection: ${value}`);
  }
  expect(failures).toEqual([]);
});

// [key, layer, 1+2 all selected, 2 of 4+2 selected, nothing selected after 4+2]
type Row = [string, Layer, string, string, string];
const BOX = "\\placeholder{}";
const ROWS: Row[] = [
  ["neg", "shift", "\\left|1+2\\right|", "4+\\left|2\\right|", `4+2\\left|${BOX}\\right|`],
  ["sin", "primary", "\\sin\\left(1+2\\right)", "4+\\sin\\left(2\\right)", `4+2\\sin\\left(${BOX}\\right)`],
  ["sin", "shift", "\\arcsin\\left(1+2\\right)", "4+\\arcsin\\left(2\\right)", `4+2\\arcsin\\left(${BOX}\\right)`],
  ["ln", "shift", "\\exponentialE^{1+2}", "4+\\exponentialE^2", `4+2\\exponentialE^{${BOX}}`],
  ["log", "shift", "10^{1+2}", "4+10^2", `4+210^{${BOX}}`],
  ["enter", "shift", "\\operatorname{approx}\\left(1+2\\right)", "4+\\operatorname{approx}\\left(2\\right)", `4+2\\operatorname{\\mathrm{approx}}\\left(${BOX}\\right)`],
  ["sq", "primary", "\\left(1+2\\right)^2", "4+2^2", "4+2^2"],
  ["pow", "primary", `\\left(1+2\\right)^{${BOX}}`, `4+2^{${BOX}}`, `4+2^{${BOX}}`],
  ["div", "shift", "\\left(1+2\\right)^{-1}", "4+2^{-1}", "4+2^{-1}"],
  ["sq", "shift", "\\sqrt{1+2}", "4+\\sqrt{2}", `4+2\\sqrt{${BOX}}`],
  ["paren", "primary", "\\left(1+2\\right)", "4+\\left(2\\right)", `4+2\\left(${BOX}\\right)`],
  ["div", "primary", `\\frac{1+2}{${BOX}}`, `4+\\frac{2}{${BOX}}`, `4+\\frac{2}{${BOX}}`],
];

for (const [id, layer, all, atom, none] of ROWS) {
  test(`${id}/${layer}: 1+2 selected → ${all}; the 2 of 4+2 → ${atom}; nothing selected → ${none}`, async ({ page }) => {
    await select(page, "1+2");
    await press(page, id, layer);
    expect(await entryValue(page)).toBe(all);
    await select(page, "4+2", 2, 3);
    await press(page, id, layer);
    expect(await entryValue(page)).toBe(atom);
    await select(page, "4+2");
    await page.evaluate(() => window.pascaline.entry.field?.executeCommand("moveToMathfieldEnd"));
    await press(page, id, layer);
    expect(await entryValue(page)).toBe(none);
  });
}

test("one-line entry: 1+2 selected, x², xʸ and x⁻¹ bracket it; a single term stays bare", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setEntry("line"));
  await select(page, "1+2");
  await press(page, "sq", "primary");
  expect(await entryValue(page)).toBe('\\left(1+2\\right)\\char"5E 2');
  await select(page, "1+2");
  await press(page, "pow", "primary");
  expect(await entryValue(page)).toBe('\\left(1+2\\right)\\char"5E ');
  await select(page, "1+2");
  await press(page, "div", "shift");
  expect(await entryValue(page)).toBe("\\left(1+2\\right)^{-1}");
  await select(page, "4+2", 2, 3);
  await press(page, "sq", "primary");
  expect(await entryValue(page)).toBe('4+2\\char"5E 2');
  await select(page, "1+2");
  await press(page, "sq", "shift");
  expect(await entryValue(page)).toBe("\\operatorname{sqrt}\\left(1+2\\right)");
});
