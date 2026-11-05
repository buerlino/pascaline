// SPDX-License-Identifier: GPL-3.0-or-later
// R132 (docs/04 3.2 E3): a Find key builds few rows. The rows Sheet.svelte draws for a search are the built prefix of
// the level's rows (sheetWindow.ts), keyed by item; Svelte's keyed {#each} builds a row for a key it had not drawn,
// patches one whose row object changed and leaves one whose row object is the same. This test replays that per key
// on the generated index: a hit that stays is not built again (and not patched where it keeps its place), rows below
// the sheet's room are not built until the list is scrolled or the highlight reaches them. The DOM count in a real
// browser is test/findrows.spec.ts. Skipped like finder.test.ts when the index is missing or holds functions only.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findMenu } from "../find/finder.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { IndexItem } from "../find/types.ts";
import type { MenuItem } from "../apps/types.ts";
import { Sheet, type Row } from "./sheet.svelte.ts";
import { ROW_FLOOR } from "./sheetFit.ts";
import { builtRows, FIRST, keyedById, MARGIN, rowKey, sameRows } from "./sheetWindow.ts";

const file = join(dirname(fileURLToPath(import.meta.url)), "../find/_gen/find-index.json");
const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];
const full = raw.some((it) => it.kind === "unit");

/** The sheet's room in the test: 400 px (a phone's list over the history) holds 12 rows at the floor. */
const ROOM = 400;
const inRoom = Math.ceil(ROOM / ROW_FLOOR) + MARGIN;

/** One draw of the list, as Svelte's keyed {#each} does it against the previous one. */
interface Drawn {
  readonly rows: ReadonlyMap<string | number, Row>;
  readonly built: number;
  readonly patched: number;
  readonly kept: number;
}
const made = new WeakMap<MenuItem, Row>(); // as Sheet.svelte's (each test's Find makes its own items)
function draw(before: ReadonlyMap<string | number, Row>, level: readonly Row[], searching: boolean, at: number, seen = 0): Drawn {
  const rows = sameRows(made, level);
  const n = searching ? builtRows(rows.length, ROOM, seen, at) : rows.length;
  const byId = keyedById(rows, searching);
  const now = new Map(rows.slice(0, n).map((r) => [rowKey(r, byId), r] as const));
  let built = 0, patched = 0, kept = 0;
  for (const [k, r] of now) {
    const was = before.get(k);
    if (was === undefined) built++;
    else if (was !== r) patched++;
    else kept++;
  }
  return { rows: now, built, patched, kept };
}

describe.skipIf(!full)("Find's rows per key (R132)", () => {
  const index = makeIndex(raw);
  const open = (): Sheet => {
    const { categories, search } = findMenu(index, () => {});
    return new Sheet("find", "Find", () => categories, { search, remember: false });
  };

  it("builds only the rows the sheet's room shows plus a margin, the first key of a query too", () => {
    const s = open();
    let d = draw(new Map(), s.level.rows, s.level.searching, s.level.highlight);
    expect(d.built).toBe(10); // the categories
    for (const ch of "pres") {
      s.level.type(ch);
      const hits = s.level.rows.length;
      if (ch === "p") expect(hits).toBe(50);
      d = draw(d.rows, s.level.rows, s.level.searching, s.level.highlight);
      expect(d.rows.size, ch).toBe(Math.min(hits, inRoom));
      expect(d.built + d.patched, ch).toBeLessThanOrEqual(inRoom);
    }
    expect(builtRows(50, 0, 0, 0)).toBe(FIRST); // before the room is measured
  });

  it("a hit that stays in the result is not built again; one that keeps its place is not patched either", () => {
    const s = open();
    let d = draw(new Map(), s.level.rows, s.level.searching, s.level.highlight);
    let stayed = 0;
    for (const ch of "pressure") {
      const before = new Map([...d.rows].map(([k, r]) => [k, r.item.id] as const));
      const placeOf = new Map([...d.rows.values()].map((r) => [r.item.id, r.index] as const));
      s.level.type(ch);
      d = draw(d.rows, s.level.rows, s.level.searching, s.level.highlight);
      const shown = [...d.rows.values()];
      const fresh = shown.filter((r) => ![...before.values()].includes(r.item.id)).length;
      expect(d.built, `${s.level.filter}: rows built`).toBe(fresh);
      const samePlace = shown.filter((r) => placeOf.get(r.item.id) === r.index).length;
      expect(d.kept, `${s.level.filter}: rows left as they were`).toBe(samePlace);
      stayed += shown.length - fresh;
    }
    expect(stayed).toBeGreaterThan(10); // the case is not empty: hits of "press…" stay from key to key
    // the same query again (⌫ then its letter, searched afresh): the same rows, nothing built or patched
    const was = d.rows;
    s.level.backspace();
    s.level.type("e");
    const again = draw(was, s.level.rows, s.level.searching, s.level.highlight);
    expect([again.built, again.patched, again.kept], "pressure again").toEqual([0, 0, was.size]);
  });

  it("rows below the room are built when the list is scrolled to them or the highlight moves down to them", () => {
    const s = open();
    s.level.type("s");
    const rows = s.level.rows;
    expect(draw(new Map(), rows, true, s.level.highlight).rows.size).toBe(inRoom);
    // scrolled down by a page: the page under it is built too
    expect(draw(new Map(), rows, true, s.level.highlight, 2 * ROOM + ROOM).rows.size).toBe(Math.ceil((3 * ROOM) / ROW_FLOOR) + MARGIN);
    for (let i = 0; i < 25; i++) s.level.move(1);
    const at = rows.findIndex((r) => r.index === s.level.highlight);
    expect(at).toBe(25);
    expect(draw(new Map(), rows, true, at).rows.size).toBe(at + 1 + MARGIN);
    // ▲ from the first row goes round to the last: every row is built
    for (let i = 0; i < 26; i++) s.level.move(-1);
    expect(draw(new Map(), rows, true, rows.findIndex((r) => r.index === s.level.highlight)).rows.size).toBe(50);
  });
});
