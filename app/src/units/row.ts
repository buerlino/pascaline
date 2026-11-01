// SPDX-License-Identifier: GPL-3.0-or-later
// R63: the way back from the unit view (docs/04 4.3 "The way back", 2.8; docs/archive/r17-unit-result.md section 2). A
// unit-view result is a Home history row: Home's own fields hold the number and its facts by Home's rule (results.ts
// homeItem on Quantity.value, as R61's chip), and `units` (types.ts UnitRow) keeps the request (the line, its filled
// slots and end slot), the Quantity summary (unit, dimension, σ, note) and R61's chip. One row per visit of the view: a
// later result of the same visit (an alternative tapped, a slot changed) takes its place. Loaded with the unit view.
import type { ChipTable } from "../input/chips.ts";
import { unitLatex, validSlots } from "../input/chipUnit.ts";
import { homeResultToLatex } from "../render/home.ts";
import { HISTORY_LIMIT, homeItem } from "../state/results.ts";
import { uncDigitsOf } from "../engine/constUnc.ts";
// (types only from the session: a value import of it from this lazy chunk makes Rolldown split modules out of the
// start chunk, +0.8 kB gzip there)
import type { HistoryItem, Session } from "../state/session.svelte.ts";
import { quantityChip } from "./chip.ts";
import type { Quantity, UnitRow, UnitSlot } from "./types.ts";

export interface RowIn {
  /** The entry line the view was opened on, and its chips. */
  line: string;
  chips: ChipTable;
  q: Quantity;
  /** The filled slots and end slot by prompt id (UnitView.filled). */
  slots: Record<string, UnitSlot>;
  /** The request as drawn (UnitView.drawn). */
  input: string;
  /** The digits setting the result was worked out at (σ's `uncDigits` counts the shown value's digits). */
  digits: number;
}

/** The row of a unit result (no id yet: putRow gives it one). */
export function unitRow({ line, chips, q, slots, input, digits }: RowIn): Omit<HistoryItem, "id"> {
  // a σ (an uncertain input or a constant with one) or a value flagged inexact went in: never "=" (as quantityChip)
  const inexact = q.unc !== undefined || q.value.facts.inexact === true;
  const chip = quantityChip(q);
  const sigma = q.unc ? `\\pm${q.unc.text}` : "";
  const units: UnitRow = {
    slots,
    unit: q.unit,
    dim: q.dimension,
    dimText: q.dimensionText,
    ...(q.unc ? { unc: { text: q.unc.text, shown: q.unc.shown, ...(q.unc.why ? { why: q.unc.why } : {}) } } : {}),
    ...(q.note ? { note: q.note } : {}),
    latex: sigma + (q.unit ? unitLatex(q.unit) : ""),
    text: (q.unc ? ` ± ${q.unc.text}` : "") + (q.unit ? ` ${q.unit}` : ""),
    input,
    ...(chip ? { chip } : {}),
  };
  // σ's digits (R61): the shown value's digits past σ's first are not confirmed, as for a chip with σ in Home
  const home = homeItem(q.value, inexact);
  const n = q.value.value && q.unc?.value.value ? uncDigitsOf(q.value.value.re, q.unc.value.value.re, Math.trunc(q.value.digits ?? digits)) : null;
  if (n !== null && home.facts) home.facts = { ...home.facts, uncDigits: n };
  return {
    view: "home",
    latex: line,
    status: "done",
    resultLatex: homeResultToLatex(q.value.display),
    text: q.value.display,
    ...home,
    ...(inexact ? { inexactInput: true } : {}),
    ...(Object.keys(chips).length ? { chips } : {}),
    units,
    startedAt: performance.now(),
  };
}

/** Put `row` in Home's history: in place of the row `id` while that is still there, else as a new last row. Saved
 *  with the history. Returns the row's id. */
export function putRow(s: Session, row: Omit<HistoryItem, "id">, id?: number): number {
  const list = s.home;
  const k = id === undefined ? -1 : list.findIndex((i) => i.id === id);
  const item: HistoryItem = { ...row, id: k < 0 ? s.newId() : (id as number) };
  if (k < 0) list.push(item);
  else list[k] = item;
  if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
  s.saveHistory();
  return item.id;
}

/** A unit row's slots, read back checked (a stored row is kept as read): the well-formed ones by prompt id; undefined
 *  for a row that is no unit row or holds none. */
export const rowSlots = (item: HistoryItem | undefined): Record<string, UnitSlot> | undefined =>
  validSlots((item?.units as { slots?: unknown } | undefined)?.slots);
