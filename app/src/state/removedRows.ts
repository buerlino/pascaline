// SPDX-License-Identifier: GPL-3.0-or-later
// The Undo copy of Clear history and Delete (R98): what the last such act took out of a view's list, one level, with
// the place of each row, so Undo puts every row back where it was. The session keeps one per view (R119) in memory and in
// the stored history record (one write, so a relaunch keeps it); that view's next Enter, or a Clear there that finds
// nothing to take, drops it.
// A lazy chunk (out of the start chunk): it imports types only, so the bundler keeps the start's modules in one file.
import type { HistoryItem, View } from "./session.svelte.ts";

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
/** The session's copies, one per view (R119). */
export type Copies = Readonly<Record<View, RemovedRows | null>>;
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

/** The copies with every place moved down by the rows the stored history's read put in front of the list each was
 *  taken from (`home`, `cas`: a Clear or Delete before the read, R98). */
export function front(cs: Copies, home: number, cas: number): Copies {
  const by = (c: RemovedRows | null, n: number): RemovedRows | null => c && { ...c, rows: c.rows.map((r) => ({ ...r, at: r.at + n, storedAt: r.storedAt + n })) };
  return { home: by(cs.home, home), cas: by(cs.cas, cas) };
}

/** The copies for the store (a snapshot; one per view, R119); undefined when none of their rows is stored. */
export function storedCopies(cs: Copies): StoredRemoved[] | undefined {
  const out = [cs.home, cs.cas].flatMap((c) => {
    const rows = (c?.rows ?? []).filter((r) => storable(r.item)).map((r) => ({ at: r.storedAt, item: r.item }));
    return c && rows.length ? [{ view: c.view, kind: c.kind, rows }] : [];
  });
  return out.length ? out : undefined;
}

/** `cs` with the stored copies read back into their views: a list of them (R119), or one copy alone (a record from
 *  before R119); each well formed (readCopy) or dropped, the first one per view kept. */
export function withStored(cs: Copies, x: unknown, restore: (i: HistoryItem) => HistoryItem, limit: number): Copies {
  const out: Partial<Record<View, RemovedRows>> = {};
  for (const one of Array.isArray(x) ? x : [x]) {
    const c = readCopy(one, restore, limit);
    if (c) out[c.view] ??= c;
  }
  return { ...cs, ...out };
}

/** A stored copy read back: every row well formed, at most `limit` rows, or no copy at all (the history itself is read
 *  as before); `restore` reads each row as the history's rows are read (storedItem.ts, with a fresh id). */
function readCopy(x: unknown, restore: (i: HistoryItem) => HistoryItem, limit: number): RemovedRows | null {
  const c = x && typeof x === "object" ? (x as Partial<StoredRemoved>) : {};
  if ((c.view !== "home" && c.view !== "cas") || (c.kind !== "clear" && c.kind !== "delete") || !Array.isArray(c.rows) || c.rows.length === 0 || c.rows.length > limit) return null;
  const ok = c.rows.every(
    (r: unknown) => {
      const o = r as { at?: unknown; item?: Partial<HistoryItem> } | null;
      return Number.isInteger(o?.at) && (o!.at as number) >= 0 && typeof o!.item?.latex === "string" && storable(o!.item as HistoryItem);
    },
  );
  if (!ok) return null;
  return { view: c.view, kind: c.kind, rows: c.rows.map((r) => ({ at: r.at, storedAt: r.at, item: restore(r.item) })) };
}
