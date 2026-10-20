// SPDX-License-Identifier: GPL-3.0-or-later
// Every unit and prefix id of spec/unit-pad.yaml and every grid entry and constant of spec/units-menu.yaml resolves to
// an item of the generated Find index (G7; r9 section 7). Products in a grid ("ft*lbf", "Btu/h", "m^3/h") are split
// into their factors. Needs the full index like queries.test.ts (skipped without one; FIND_INDEX=required fails).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const ids = new Set(items.map((i) => i.id));
const spec = (f: string): unknown => parse(readFileSync(join(here, "../../../spec", f), "utf8"));

interface Cell { tap?: string; up?: string; down?: string }
const pad = spec("unit-pad.yaml") as { prefixes: Cell[]; units: Cell[]; user: Cell[] };
const menu = spec("units-menu.yaml") as {
  prefixes: { items: string[] };
  categories: { name: string; first: string[] }[];
  add_to_find: { id: string }[];
  constants: { lists: { name: string; items: string[] | string }[] };
};
const cellIds = (cs: Cell[]): string[] => cs.flatMap((c) => [c.tap, c.up, c.down]).filter((x): x is string => !!x);

/** The index ids a grid entry stands for: itself when it is an item, else its factors ("ft*lbf", "Btu/h", "m^3/h"). */
function unitIds(entry: string): string[] {
  if (ids.has(`unit:${entry}`)) return [`unit:${entry}`];
  return entry.split(/[*/]/).map((f) => `unit:${f.replace(/\^-?\d+$/, "")}`);
}

describe.skipIf(!hasIndex)("spec ids resolve to Find items", () => {
  it("the unit pad's units and prefixes", () => {
    const missing = [
      ...cellIds(pad.units).concat(cellIds(pad.user)).flatMap(unitIds).filter((i) => !ids.has(i)),
      ...cellIds(pad.prefixes).map((p) => `pfx:${p}`).filter((i) => !ids.has(i)),
    ];
    expect(missing).toEqual([]);
  });

  it("the units menu's grid entries and prefixes", () => {
    const missing = menu.categories.flatMap((c) => c.first.flatMap(unitIds).filter((i) => !ids.has(i)).map((i) => `${c.name}: ${i}`));
    expect(missing).toEqual([]);
    const pfx = menu.prefixes.items.filter((p) => !items.some((i) => i.kind === "pfx" && (i.id === `pfx:${p}` || i.names.includes(p))));
    expect(pfx).toEqual([]);
  });

  it("the menu's add_to_find units and the constants lists", () => {
    expect(menu.add_to_find.map((a) => `unit:${a.id}`).filter((i) => !ids.has(i))).toEqual([]);
    const consts = menu.constants.lists.flatMap((l) => (Array.isArray(l.items) ? l.items : [])).filter((c) => !["e", "π", "i"].includes(c));
    expect(consts.map((c) => `const:${c}`).filter((i) => !ids.has(i))).toEqual([]);
  });
});

it("finds the full generated index (otherwise the spec-id test was skipped)", () => {
  if (hasIndex) return;
  const msg = "app/src/find/_gen/find-index.json is missing or holds functions only; run npm run index";
  if (process.env["FIND_INDEX"] === "required") expect.fail(msg);
  console.warn(`specids.test: ${msg}; the test was skipped`);
});
