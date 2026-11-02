// SPDX-License-Identifier: GPL-3.0-or-later
// Test helper: the index from its items in one go (the app prepares it a slice at a time, finder.ts makeIndexIdle).
import type { FindIndex } from "./finder.ts";
import { prepare } from "./rank.ts";
import type { IndexItem } from "./types.ts";

/** The index from its items (prepared: every item has its insert). */
export function makeIndex(raw: readonly IndexItem[]): FindIndex {
  const prepared = prepare(raw);
  const items = prepared.items.map((p) => p.item);
  return { prepared, items, byId: new Map(items.map((it) => [it.id, it])) };
}
