// SPDX-License-Identifier: GPL-3.0-or-later
// The Undo copy of Clear history and Delete (R98): what the last such act took out of a view's list, one level, with
// the place of each row, so Undo puts every row back where it was. The session keeps it in memory and in the stored
// history record (one write, so a relaunch keeps it); the next Enter, or a Clear that finds nothing to take, drops it.
import type { HistoryItem, View } from "./session.svelte.ts";
import { HISTORY_LIMIT } from "./results.ts";
import { restoredItem } from "./storedItem.ts";

export type RemovedKind = "clear" | "delete";
/** A row taken out: its index in the list then (`at`), and its index among the rows the store keeps (`storedAt`). */
export interface RemovedRow {
  at: number;
  storedAt: number;
  item: HistoryItem;
}
export interface RemovedRows {
  view: View;
  kind: RemovedKind;
  /** In list order. */
  rows: RemovedRow[];
}
/** The copy as the history record holds it: the stored rows only, each at its place among the stored rows. */
export interface StoredRemoved {
  view: View;
  kind: RemovedKind;
  rows: { at: number; item: HistoryItem }[];
}

/** A row the history record keeps (flushHistory): finished or an error. */
export const storable = (i: HistoryItem): boolean => i.status === "done" || i.status === "error";

/** Take the rows `take` picks out of `list` (a running row is never picked by the callers); returns them in order. */
export function takeOut(list: HistoryItem[], take: (i: HistoryItem) => boolean): RemovedRow[] {
  const rows: RemovedRow[] = [];
  let stored = 0;
  list.forEach((item, at) => {
    if (take(item)) rows.push({ at, storedAt: stored, item });
    if (storable(item)) stored++;
  });
  for (let j = rows.length - 1; j >= 0; j--) list.splice(rows[j]!.at, 1);
  return rows;
}

/** Put the rows back in their places: in order, each at its old index (the rows that stayed keep theirs). */
export function putBack(list: HistoryItem[], rows: readonly { at: number; item: HistoryItem }[]): void {
  for (const r of rows) list.splice(Math.min(r.at, list.length), 0, r.item);
}

/** The copy for the store (a snapshot); undefined when none of its rows is stored. */
export function storedCopy(c: RemovedRows | null): StoredRemoved | undefined {
  const rows = (c?.rows ?? []).filter((r) => storable(r.item)).map((r) => ({ at: r.storedAt, item: r.item }));
  return c && rows.length ? { view: c.view, kind: c.kind, rows } : undefined;
}

/** A stored copy read back: every row well formed, or no copy at all (the history itself is read as before). */
export function readCopy(x: unknown, nextId: () => number): RemovedRows | null {
  const c = x && typeof x === "object" ? (x as Partial<StoredRemoved>) : {};
  if ((c.view !== "home" && c.view !== "cas") || (c.kind !== "clear" && c.kind !== "delete") || !Array.isArray(c.rows) || c.rows.length === 0 || c.rows.length > HISTORY_LIMIT) return null;
  const ok = c.rows.every(
    (r: unknown) => {
      const o = r as { at?: unknown; item?: Partial<HistoryItem> } | null;
      return Number.isInteger(o?.at) && (o!.at as number) >= 0 && typeof o!.item?.latex === "string" && storable(o!.item as HistoryItem);
    },
  );
  if (!ok) return null;
  return { view: c.view, kind: c.kind, rows: c.rows.map((r) => ({ at: r.at, storedAt: r.at, item: restoredItem(r.item, nextId()) })) };
}
