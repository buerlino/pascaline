// SPDX-License-Identifier: GPL-3.0-or-later
// Find (R4a, docs/04 3.3–3.7): the index and its rows for the sheet. A lazy chunk: App.svelte loads it when the
// browser is idle after the engine is ready, or on the first Math press. The index is a Vite asset outside every
// chunk (find-index.<hash>.json), fetched here and prepared once. No usage ranking and nothing stored (P11).
import indexUrl from "./_gen/find-index.json?url";
import type { MenuItem } from "../apps/types.ts";
import { t } from "../i18n/index.ts";
import { CATEGORIES, categoryItems } from "./categories.ts";
import { prepare, search, type PreparedIndex } from "./rank.ts";
import type { FindItem, IndexItem } from "./types.ts";

export interface FindIndex {
  readonly prepared: PreparedIndex;
  readonly items: readonly FindItem[];
  readonly byId: ReadonlyMap<string, FindItem>;
}

/** The index from its items (prepared: every item has its insert). */
export function makeIndex(raw: readonly IndexItem[]): FindIndex {
  const prepared = prepare(raw);
  const items = prepared.items.map((p) => p.item);
  return { prepared, items, byId: new Map(items.map((it) => [it.id, it])) };
}

let loading: Promise<FindIndex> | null = null;
/** Fetch and prepare the index, once; a failed fetch is tried again on the next call. */
export function loadIndex(): Promise<FindIndex> {
  loading ??= fetch(indexUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`find index: HTTP ${r.status}`);
      return r.json() as Promise<IndexItem[]>;
    })
    .then(makeIndex)
    .catch((e: unknown) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** The name a row shows: the first name, as typed. */
const shownName = (it: FindItem): string => it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);

/** The dB family converts only; any other unit without `si` has no exact factor (check 2026-10-19, finding 17). */
const LOG_IDS = new Set(["unit:dB", "unit:dBm", "unit:dBW", "unit:bel", "unit:Np"]);

/** A unit's mark in its row: a pick of it would not convert (R4a, finding 17). */
export function unitNote(it: FindItem): string | undefined {
  if (it.kind !== "unit" || it.si !== undefined) return undefined;
  return LOG_IDS.has(it.id) || /^Np/.test(it.dim ?? "") ? t("find.convertsOnly") : t("find.noFactor");
}

/** The highlighted item's details, under the list (docs/04 3.6): syntax and line, a value with its uncertainty. */
export function preview(it: FindItem): string {
  const name = shownName(it);
  const parts: string[] = [];
  if (it.kind === "fn" || it.kind === "tmpl") parts.push(it.syntax ?? `${name}(…)`, it.desc ?? it.title);
  else if (it.kind === "const") parts.push(`${name} = ${it.value ?? "?"}${it.unit ? ` ${it.unit}` : ""}`, it.unc ? `± ${it.unc}` : t("find.exact"));
  else parts.push(it.title, it.si !== undefined ? t("find.factor", { si: it.si }) : (unitNote(it) ?? ""));
  if (it.tier === 1) parts.push(t("find.notChecked"));
  return parts.filter(Boolean).join(" · ");
}

/** One item as a row of the sheet; picking it runs `pick`. */
export function itemRow(it: FindItem, pick: (it: FindItem) => void): MenuItem {
  const note = unitNote(it);
  return { id: it.id, label: it.title, value: shownName(it), preview: preview(it), ...(note ? { note } : {}), run: () => pick(it) };
}

/** Find's sheet: the categories on an empty query, and the search for typed letters (in a category: its items only). */
export function findMenu(index: FindIndex, pick: (it: FindItem) => void): { categories: MenuItem[]; search: (q: string) => MenuItem[] } {
  const rows = (hits: readonly FindItem[]): MenuItem[] => hits.map((it) => itemRow(it, pick));
  const find = (q: string, within?: ReadonlySet<string>): MenuItem[] =>
    rows(search(index.prepared, q, { limit: within ? index.items.length : 50 }).map((h) => h.item).filter((it) => !within || within.has(it.id)).slice(0, 50));
  const categories = CATEGORIES.map((cat): MenuItem => {
    const items = categoryItems(cat, index.items, index.byId);
    const ids = new Set(items.map((it) => it.id));
    const title = t(cat.title);
    return { id: `cat:${cat.id}`, label: title, submenu: { title, items: rows(items), search: (q) => find(q, ids) } };
  });
  return { categories, search: (q) => find(q) };
}

/** The chip a constant goes on the line with (docs/04 3.6): its exact value text, its uncertainty, `exact` false then. */
export function constChipOf(it: FindItem): { id: string; symbol: string; chip: { value: string; exact: boolean; unc?: string } } | undefined {
  const m = /^\\const\{([^{}]*)\}\{(.*)\}$/.exec(it.insert);
  if (it.kind !== "const" || !m || it.value === undefined) return undefined;
  const chip = it.unc === undefined ? { value: it.value, exact: true } : { value: it.value, exact: false, unc: it.unc };
  return { id: m[1] as string, symbol: m[2] as string, chip };
}
