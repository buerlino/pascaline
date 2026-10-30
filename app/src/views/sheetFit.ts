// SPDX-License-Identifier: GPL-3.0-or-later
// How big a sheet's rows and cells are (R21a, docs/05 3.1 "fit, then scroll"): they shrink to the room over the
// keypad, from their normal size down to a floor; only below the floor does the sheet scroll. Plain numbers, no DOM:
// Sheet.svelte measures the room once per resize and sets the result as CSS.
import type { MenuItem } from "../apps/types.ts";

/** A list row: normal height and the floor (font and padding together). */
export const ROW = 42;
export const ROW_FLOOR = 36;
/** The reason line under a disabled row (docs/05 3.1). */
export const REASON = 16;
/** A row whose value has ◀ ▶ buttons is at least as tall as they are (44 × 44 px for the thumb). */
export const STEP = 44;
/** Grid cells: the floor, and the gap between them. Their normal height is the palette's own (58 Tmpl, 46 Shift). */
export const CELL_FLOOR = 44;
export const GAP = 4;

/** What a row needs besides its line: a reason line, ◀ ▶ buttons. */
export interface RowNeeds {
  readonly reason: boolean;
  readonly steps: boolean;
}

/** A row's height for a line height `row`. */
export const rowHeight = (row: number, r: RowNeeds): number => Math.max(row + (r.reason ? REASON : 0), r.steps ? STEP : 0);

/** The line height that fits `rows` into `room` px: the normal height when they fit, else as low as needed down to
 *  the floor (half-pixel steps). At the floor the list scrolls. */
export function fitRow(room: number, rows: readonly RowNeeds[]): number {
  const total = (row: number): number => rows.reduce((s, r) => s + rowHeight(row, r), 0);
  for (let row = ROW; row > ROW_FLOOR; row -= 0.5) if (total(row) <= room) return row;
  return ROW_FLOOR;
}

/** A grid cell's height that fits `rows` rows of cells into `room` px, between the floor and `normal`. */
export function fitCell(room: number, rows: number, normal: number): number {
  if (rows <= 0) return normal;
  const cell = Math.floor((room - GAP * (rows - 1)) / rows);
  return Math.max(CELL_FLOOR, Math.min(normal, cell));
}

/** A disabled row says why, once for a run of neighbouring disabled rows with the same reason: under the run's last
 *  row (R7 open point 5: five rows saying "Define a function first" do not fit, and say nothing more). */
export function showsReason(items: readonly MenuItem[], i: number): boolean {
  const item = items[i];
  if (!item?.disabled || !item.reason) return false;
  const next = items[i + 1];
  return !(next?.disabled && next.reason === item.reason);
}

/** The row has a second line: its reason (showsReason) or its hint (R49). */
export const twoLines = (items: readonly MenuItem[], i: number): boolean => showsReason(items, i) || items[i]?.hint !== undefined;

/** The row has a value that ◀ ▶ change in place (the Mode sheet, R21a). */
export const hasSteps = (item: MenuItem): boolean => item.adjust !== undefined && item.value !== undefined;
