// SPDX-License-Identifier: GPL-3.0-or-later
// R43: the cursor grid, built like R26a's ⌫ grid. Every template the keys insert (read from spec/keyboard.yaml, so a
// new key joins by itself) is put on the line with a digit in each box, and with each box empty in turn, and walked:
// - alone on the line: ◀ from the end visits every stop (isStop true) and nothing else, ▶ from the start reaches the
//   end, and every stop of either walk is at the edge of a box (next to a digit or □) or at an end of the line;
// - in a box of an outer template whose last box is empty (a fraction's numerator, EQ's first box, ∫'s integrand):
//   ▶ from the end of the template's last box stops at the end of the box that holds it, and the next ▶ goes to the
//   outer template's empty box (bug F34: the first ▶ jumped straight to the empty box, and a key typed next landed
//   there). The checks are derived from the rule ("The cursor stops only at a box", "The cursor goes where the user
//   aims" point 2, R43), not from today's output. A case that fails today is marked test.fail() with F34 in KNOWN_FAIL;
//   the fix removes it.
// One page for the whole file; a template is one page.evaluate through `window.pascaline.entry.run` (the key path).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devices, expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { open } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { insert?: string }
interface Cell { id: string; insert?: string }
const doc = parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as {
  keys: Record<string, unknown>[];
  templates: { items: Cell[] };
  relations: { items: Cell[] };
};

/** A template: an insert with a box, a bracket pair or a power (as the ⌫ grid). Textbook inserts only. */
const isTemplate = (latex: string): boolean => /#|\\left|\^/.test(latex);

function collect(): { name: string; latex: string }[] {
  const out: { name: string; latex: string }[] = [];
  const seen = new Set<string>();
  const add = (name: string, latex: string | undefined): void => {
    if (latex === undefined || !isTemplate(latex) || seen.has(latex)) return;
    seen.add(latex);
    out.push({ name, latex });
  };
  for (const key of doc.keys)
    for (const layer of ["primary", "shift", "alpha"]) add(`${key["id"] as string}/${layer}`, (key[layer] as Act | undefined)?.insert);
  for (const c of doc.templates.items) add(`tmpl:${c.id}`, c.insert);
  for (const c of doc.relations.items) add(`rel:${c.id}`, c.insert);
  return out;
}
const TEMPLATES = collect();

/** The template's line with box `empty` left as □ and a 1 in every other box (−1: every box filled). */
function filled(latex: string, empty: number): string {
  let k = 0;
  return latex.replace(/#[@?0]/g, () => (k++ === empty ? "\\placeholder{}" : "1"));
}
const boxCount = (latex: string): number => (latex.match(/#[@?0]/g) ?? []).length;

/** The outer templates (their last box empty) a template is put in: the line before it and after it. */
const CONTEXTS: [string, string, string][] = [
  ["a numerator", "\\frac{", "}{\\placeholder{}}"],
  ["EQ's first box", "\\operatorname{EQ}\\left(", ",\\placeholder{}\\right)"],
  ["∫'s integrand", "\\int_{1}^{1}", "\\,\\mathrm{d}\\placeholder{}"],
];

const KNOWN_FAIL = new Set<string>([]);

let page: Page;
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  page = await ctx.newPage();
  await open(page);
});
test.afterAll(async () => {
  await page.context().close();
});

/** Every line of one template through both walks; returns the failures, one line each. */
function check(lines: string[], contexts: [string, string, string][]): Promise<string[]> {
  return page.evaluate(
    async ([lines, contexts]) => {
      const stops = (await (0, eval)('import("/src/entry/stops.ts")')) as typeof import("../src/entry/stops.ts");
      const entry = window.pascaline.entry;
      const mf = entry.field!;
      const fail: string[] = [];
      const latexAt = (o: number): string => mf.getElementInfo(o)?.latex ?? "";
      const depthAt = (o: number): number => mf.getElementInfo(o)?.depth ?? 0;
      /** What a box holds: a digit, □, or a key's own exponent (the − of x⁻¹). */
      const content = (o: number): boolean => o >= 1 && o <= mf.lastOffset && /^(?:\d|-|\\placeholder\{\})$/.test(latexAt(o));
      /** The atom right after position `p` on its level, or "" where its box ends. */
      const next = (p: number): string => {
        for (let o = p + 1; o <= mf.lastOffset; o++) {
          if (depthAt(o) < depthAt(p)) return "";
          if (depthAt(o) === depthAt(p)) return latexAt(o);
        }
        return "";
      };
      /**
       * At the edge of a box: after its content, before its content (on the same level), at the end of a power's base
       * (eˣ's e is the key's own base), or at an end of the line.
       */
      const edge = (p: number): boolean =>
        p === 0 || p === mf.lastOffset || content(p) || (content(p + 1) && depthAt(p + 1) === depthAt(p)) || next(p).startsWith("^");
      const press = (dir: 1 | -1): void => entry.run({ kind: "cmd", name: dir === 1 ? "moveToNextChar" : "moveToPreviousChar" });
      const walk = (line: string, dir: 1 | -1): number[] => {
        entry.set(line);
        mf.position = dir === 1 ? 0 : mf.lastOffset;
        const seen = [mf.position];
        let sel = JSON.stringify(mf.selection.ranges);
        for (let k = 0; k < 80; k++) {
          press(dir);
          const now = JSON.stringify(mf.selection.ranges);
          // (a press may only select the □ next to the cursor: the walk goes on while the cursor or the selection moves)
          if (mf.position === seen[seen.length - 1] && now === sel) break;
          sel = now;
          if (mf.position !== seen[seen.length - 1]) seen.push(mf.position);
        }
        return seen;
      };
      for (const line of lines) {
        // alone on the line
        const back = walk(line, -1);
        const fwd = walk(line, 1);
        const all: number[] = [];
        // (a □ is one stop: the cursor selects it, so the place before it, after a box's sentinel or a mark, is no stop
        // of its own; the line's start is)
        const beforeBox = (p: number): boolean => p > 0 && latexAt(p + 1) === "\\placeholder{}" && depthAt(p + 1) === depthAt(p);
        for (let p = mf.lastOffset; p >= 0; p--) if (stops.isStop(mf, p) && !beforeBox(p)) all.push(p);
        if (JSON.stringify(back) !== JSON.stringify(all)) fail.push(`${line}: ◀ visits [${back}], the stops are [${all}]`);
        if (fwd[fwd.length - 1] !== mf.lastOffset) fail.push(`${line}: ▶ ends at ${fwd[fwd.length - 1]}, not at the end`);
        for (const p of new Set([...fwd, ...back])) {
          if (!stops.isStop(mf, p)) fail.push(`${line}: stops at ${p}, where isStop is false`);
          else if (!edge(p)) fail.push(`${line}: stops at ${p}, not at the edge of a box`);
        }
        // in a box of an outer template: the box holding it ends 3 offsets before the line's end (all three contexts)
        for (const [where, before, after] of contexts) {
          const outer = before + line + after;
          entry.set(outer);
          const end = mf.lastOffset - 3;
          const s = end - 1; // the end of the template's last box
          if (!stops.isStop(mf, s) || depthAt(s) < depthAt(end)) continue; // (∫: its variable ends where the box ends)
          mf.position = s;
          press(1);
          if (!mf.selectionIsCollapsed || mf.position !== end) {
            fail.push(`${line} in ${where}: ▶ from ${s} went to ${mf.position}, not to ${end} (the end of the box)`);
            continue;
          }
          press(1);
          if (mf.getValue(mf.selection, "latex") !== "\\placeholder{}" || mf.position <= end)
            fail.push(`${line} in ${where}: the next ▶ went to ${mf.position}, not to the empty box`);
        }
      }
      return fail;
    },
    [lines, contexts] as const,
  );
}

for (const t of TEMPLATES) {
  test(`▶ and ◀ stop at the boxes: ${t.name} ${t.latex}`, async () => {
    test.fail(KNOWN_FAIL.has(t.name), "F34 (R43)");
    const n = boxCount(t.latex);
    const lines = [filled(t.latex, -1)];
    for (let k = 0; k < n; k++) lines.push(filled(t.latex, k));
    expect(await check(lines, CONTEXTS)).toEqual([]);
  });
}
