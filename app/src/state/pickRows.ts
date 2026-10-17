// SPDX-License-Identifier: GPL-3.0-or-later
// Which history row Up and Down pick (P4). A "note" row is a line the app says itself (G19's safe start): it is never
// drawn as picked, so it is never picked.
import type { HistoryItem } from "./session.svelte.ts";

type Row = Pick<HistoryItem, "status">;

const pickable = (items: readonly Row[], i: number): boolean => items[i] !== undefined && items[i]!.status !== "note";

/** The nearest row at or before `from` that can be picked, or null when there is none. */
export function pickAtOrBefore(items: readonly Row[], from: number): number | null {
  for (let i = Math.min(from, items.length - 1); i >= 0; i--) if (pickable(items, i)) return i;
  return null;
}

/** The nearest row after `from` that can be picked, or null when there is none. */
export function pickAfter(items: readonly Row[], from: number): number | null {
  for (let i = Math.max(from + 1, 0); i < items.length; i++) if (pickable(items, i)) return i;
  return null;
}

/** True when `i` is a row that can be picked. */
export const canPick = (items: readonly Row[], i: number): boolean => pickable(items, i);
