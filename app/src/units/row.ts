// SPDX-License-Identifier: GPL-3.0-or-later
// R63: the way back from the unit view (docs/04 4.3 "The way back", 2.8; docs/archive/r17-unit-result.md section 2). A
// unit-view result is a Home history row: Home's own fields hold the number and its facts by Home's rule (results.ts
// homeItem on Quantity.value, as R61's chip), and `units` (types.ts UnitRow) keeps the request (the line, its filled
// slots and end slot), the Quantity summary (unit, dimension, σ, note) and R61's chip. One row per visit of the view: a
// later result of the same visit (an alternative tapped, a slot changed) takes its place. Loaded with the unit view.
import type { ChipTable } from "../input/chips.ts";
import { validSlot } from "../input/chipUnit.ts";
import { homeResultToLatex } from "../render/home.ts";
import { homeItem } from "../state/results.ts";
import { HISTORY_LIMIT, type HistoryItem, type Session } from "../state/session.svelte.ts";
import { quantityChip } from "./chip.ts";
import type { Quantity, UnitRow, UnitSlot } from "./types.ts";

/** A unit set apart after a number (r17 section 2): smaller, muted and upright, so the chip and the row read it as a
 *  label, never as a factor. Text mode, so any symbol (µ, Ω, °, ², ·) is drawn as it is; its few LaTeX specials escaped. */
export function unitLatex(text: string): string {
  const t = text.replace(/[\\^~]/g, "").replace(/[#$%&_{}]/g, (c) => `\\${c}`);
  return `\\htmlStyle{color:var(--muted);font-size:smaller}{\\,\\text{${t}}}`;
}

export interface RowIn {
  /** The entry line the view was opened on, and its chips. */
  line: string;
  chips: ChipTable;
  q: Quantity;
  /** The filled slots and end slot by prompt id (UnitView.filled). */
  slots: Record<string, UnitSlot>;
  /** The request as drawn (UnitView.drawn). */
  input: string;
}

/** The row of a unit result (no id yet: putRow gives it one). */
export function unitRow({ line, chips, q, slots, input }: RowIn): Omit<HistoryItem, "id"> {
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
    input,
    ...(chip ? { chip } : {}),
  };
  return {
    view: "home",
    latex: line,
    status: "done",
    resultLatex: homeResultToLatex(q.value.display),
    text: q.value.display,
    ...homeItem(q.value, inexact),
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

const SLOT_ID = /^(?:u\d{1,3}|end)$/;

/** A unit row's slots, read back checked (a stored row is kept as read, unchecked): the well-formed ones by prompt id;
 *  undefined for a row that is no unit row or holds none. */
export function rowSlots(item: HistoryItem | undefined): Record<string, UnitSlot> | undefined {
  const slots = (item?.units as { slots?: unknown } | undefined)?.slots;
  if (!slots || typeof slots !== "object") return undefined;
  const out: Record<string, UnitSlot> = {};
  for (const [id, x] of Object.entries(slots as Record<string, unknown>)) {
    const s = SLOT_ID.test(id) ? validSlot(x) : undefined;
    if (s) out[id] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The last unit row in Home whose line is `line` (the line recalled, or typed again, after a relaunch). */
export function rowFor(s: Session, line: string): HistoryItem | undefined {
  for (let i = s.home.length - 1; i >= 0; i--) {
    const item = s.home[i] as HistoryItem;
    if (item.units && item.latex === line && item.status === "done") return item;
  }
  return undefined;
}
