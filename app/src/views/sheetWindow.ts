// SPDX-License-Identifier: GPL-3.0-or-later
// Which rows of a search Sheet.svelte builds, and by what key (R132, docs/04 3.2 E3: a Find key updates the list within
// one frame). A key changes Find's hits; building all 50 of them cost the Tab One 26 ms a key, and the first key of a
// query (the ten categories become 50 hits) most. So the sheet builds the hits its room can show plus a margin, the
// rest as the list is scrolled or the highlight moves down, under a spacer as tall as they are; and it keys a hit by
// its item, so a hit that stays in the result is moved, not built again. Plain numbers, no DOM.
import type { MenuItem } from "../apps/types.ts";
import type { Row } from "./sheet.svelte.ts";
import { ROW_FLOOR } from "./sheetFit.ts";

/** Rows built past the last one in view (a row cut at the bottom edge, the next one); a scroll builds a page ahead
 *  and ▼ the rows past the highlight. */
export const MARGIN = 2;
/** Before the sheet's room is measured (its first frame): about a phone's list. */
export const FIRST = 16;

/** How many of a search's `total` hits are built: those the list's `room` (px, the most it can grow to) can show at
 *  `rowPx` a row (the lowest a row is) plus a margin; more when the list has been scrolled (`seen`: px from its top to
 *  the bottom of what was scrolled into view, and a page further) or the highlight is on row `at` (its place among
 *  the rows, -1: none). */
export function builtRows(total: number, room: number, seen: number, at: number, rowPx = ROW_FLOOR): number {
  const fits = (px: number): number => Math.ceil(Math.max(0, px) / rowPx);
  const first = room > 0 ? fits(room) + MARGIN : FIRST;
  return Math.min(total, Math.max(first, fits(seen) + MARGIN, at + 1 + MARGIN));
}

/** The rows are drawn keyed by their item's id (a search whose ids are unique), else by their place. */
export function keyedById(rows: readonly Row[], searching: boolean): boolean {
  return searching && new Set(rows.map((r) => r.item.id)).size === rows.length;
}

/** A row's key in the sheet's list (see keyedById). */
export const rowKey = (r: Row, byId: boolean): string | number => (byId ? r.item.id : r.index);

/** A row with a label and at most a note and a value (Find's hits): the sheet draws it with the light row, the same
 *  markup without the blocks for what it does not have (a row is built for less, R132). */
export const plainRow = (it: MenuItem): boolean =>
  !it.disabled && it.reason === undefined && it.hint === undefined && it.selected === undefined && it.options === undefined && it.submenu === undefined && it.glyph === undefined && it.dots === undefined && it.adjust === undefined;
