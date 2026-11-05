// SPDX-License-Identifier: GPL-3.0-or-later
// Which rows of a search Sheet.svelte builds, and by what key (R132, docs/04 3.2 E3: a Find key updates the list within
// one frame). A key changes Find's hits; building all 50 of them cost the Tab One 26 ms a key, and the first key of a
// query (the ten categories become 50 hits) most. So the sheet builds the hits its room can show plus a margin, the
// rest as the list is scrolled or the highlight moves down, under a spacer as tall as they are; and it keys a hit by
// its item, so a hit that stays in the result is moved, not built again. Plain numbers, no DOM.
import type { Row } from "./sheet.svelte.ts";
import { ROW_FLOOR } from "./sheetFit.ts";

/** Rows built past the last one in view, so a short scroll or ▼ finds its row there. */
export const MARGIN = 4;
/** Before the sheet's room is measured (its first frame): about a phone's list. */
export const FIRST = 16;

/** The rows `px` of height can show: at the floor height, the most it can hold. */
const fits = (px: number): number => Math.ceil(Math.max(0, px) / ROW_FLOOR);

/** How many of a search's `total` hits are built: those the sheet's `room` (px) can show plus a margin; more when the
 *  list has been scrolled (`seen`: px from its top to the bottom of what was scrolled into view, and a page further)
 *  or the highlight is on row `at` (its place among the rows, -1: none). */
export function builtRows(total: number, room: number, seen: number, at: number): number {
  const first = room > 0 ? fits(room) + MARGIN : FIRST;
  return Math.min(total, Math.max(first, fits(seen) + MARGIN, at + 1 + MARGIN));
}

/** The rows are drawn keyed by their item's id (a search whose ids are unique), else by their place. */
export function keyedById(rows: readonly Row[], searching: boolean): boolean {
  return searching && new Set(rows.map((r) => r.item.id)).size === rows.length;
}

/** A row's key in the sheet's list (see keyedById). */
export const rowKey = (r: Row, byId: boolean): string | number => (byId ? r.item.id : r.index);
