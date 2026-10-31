// SPDX-License-Identifier: GPL-3.0-or-later
// Find (R4a, docs/04 3.3–3.7): the index and its rows for the sheet. A lazy chunk: App.svelte loads it when the
// browser is idle after the engine is ready, or on the first Math press. The index is a Vite asset outside every
// chunk (find-index.<hash>.json), fetched here and prepared once. No usage ranking and nothing stored (P11).
import indexUrl from "./_gen/find-index.json?url";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { EntryController } from "../entry/controller.ts";
import { findText as t } from "../i18n/enFind.ts";
import { constKey, type Chip } from "../input/chips.ts";
import type { Layer } from "../keyboard/keyboard.ts";
import type { UserBinding, UserKeys } from "../keyboard/userKeys.svelte.ts";
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

/** The index prepared a slice at a time, each in an idle moment, so the idle load never holds the main thread for
 *  long (a long task there delayed Solve's first Working… frame, working.spec.ts). `hurry()` (a Math press) makes the
 *  rest run at once. Without requestIdleCallback it is prepared in one go. */
const SLICE = 200;
let hurried = false;
/** True while a job runs (App.svelte sets it): the slices wait for it, so its Working… line keeps its timing. */
let busy: () => boolean = () => false;
export function pauseWhile(b: () => boolean): void {
  busy = b;
}
const idle = (): Promise<number> =>
  new Promise((done) => {
    if (hurried || typeof requestIdleCallback !== "function") return done(Infinity);
    const ask = (): void => {
      requestIdleCallback((d) => (busy() && !hurried ? ask() : done(d.didTimeout ? 4 : d.timeRemaining())), { timeout: 1000 });
    };
    ask();
  });
export async function makeIndexIdle(raw: readonly IndexItem[]): Promise<FindIndex> {
  const parts: PreparedIndex["items"][] = [];
  let i = 0;
  while (i < raw.length) {
    const room = await idle();
    const t0 = performance.now();
    do {
      parts.push(prepare(raw.slice(i, i + SLICE)).items);
      i += SLICE;
    } while (i < raw.length && performance.now() - t0 < room);
  }
  const prepared: PreparedIndex = { items: parts.flat() };
  const items = prepared.items.map((p) => p.item);
  return { prepared, items, byId: new Map(items.map((it) => [it.id, it])) };
}

let loading: Promise<FindIndex> | null = null;
/** Fetch and prepare the index, once; a failed fetch is tried again on the next call. `urgent` (a Math press): the
 *  preparing still to do runs at once. */
export function loadIndex(urgent = false): Promise<FindIndex> {
  if (urgent) hurried = true;
  loading ??= fetch(indexUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`find index: HTTP ${r.status}`);
      return r.json() as Promise<IndexItem[]>;
    })
    .then(makeIndexIdle)
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
  return LOG_IDS.has(it.id) || /^Np/.test(it.dim ?? "") ? t("convertsOnly") : t("noFactor");
}

/** The highlighted item's details, under the list (docs/04 3.6): syntax and line, a value with its uncertainty. */
export function preview(it: FindItem): string {
  const name = shownName(it);
  const parts: string[] = [];
  if (it.kind === "fn" || it.kind === "tmpl") parts.push(it.syntax ?? `${name}(…)`, it.desc ?? it.title);
  else if (it.kind === "const") parts.push(`${name} = ${it.value ?? "?"}${it.unit ? ` ${it.unit}` : ""}`, it.unc ? `± ${it.unc}` : t("exact"));
  else parts.push(it.title, it.si !== undefined ? t("factor", { si: it.si }) : (unitNote(it) ?? ""));
  if (it.tier === 1) parts.push(t("notChecked"));
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

/** The chip a constant goes on the line with (docs/04 3.6): its exact value text, its uncertainty, `exact` false then;
 *  G81: an inexact constant's basis and leaves (G80) with it. */
export function constChipOf(it: FindItem): { id: string; symbol: string; chip: Chip } | undefined {
  const m = /^\\const\{([^{}]*)\}\{(.*)\}$/.exec(it.insert);
  if (it.kind !== "const" || !m || it.value === undefined) return undefined;
  const { value, unc, basis, basisLeaves } = it;
  const chip: Chip = unc === undefined ? { value, exact: true } : basis && basisLeaves ? { value, exact: false, unc, basis, basisLeaves } : { value, exact: false, unc };
  return { id: m[1] as string, symbol: m[2] as string, chip };
}

/** A Find item as a free key's slot (R4b, Settings › Your keys): the item's name as the legend, its insert as the
 *  action; a constant carries its chip, so the key puts the value and uncertainty on the line as Find does. */
export function bindingOf(it: FindItem): UserBinding {
  const c = constChipOf(it);
  const label = it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  return { label, action: c ? { insert: it.insert, chip: { key: constKey(c.id), ...c.chip } } : { insert: it.insert } };
}

const LEG = { primary: "tap", shift: "up", alpha: "down" } as const;

/** The slot a pick sets instead of inserting (Settings › Your keys, R4b). */
export interface SlotTarget {
  readonly id: string;
  readonly layer: Layer;
  readonly userKeys: UserKeys;
}

/** Math (R4a): Find over the history or view, as a list that takes letters (decisions.md R21). A pick (docs/04 3.6)
 *  puts a constant on the line as a chip with its value and uncertainty, anything else as its insert (a function
 *  with the cursor in its first argument). With `slot` (R4b) a pick sets that free key's slot instead. */
export function showFind(shell: AppShell, entry: EntryController, index: FindIndex, slot?: SlotTarget): void {
  // R24d: a unit pad cell ("cell:u1", Settings › Your keys › Unit pad cells): Find on units, the pick sets that leg
  if (slot?.id.startsWith("cell:")) return void import("../units/find.ts").then((m) => m.showCellFind(shell, index, slot.id.slice(5), LEG[slot.layer]));
  const pick = (it: FindItem): void => {
    if (slot) return slot.userKeys.set(slot.id, slot.layer, bindingOf(it));
    const c = constChipOf(it);
    if (c) entry.insertConst(c.id, c.symbol, c.chip);
    else entry.run({ kind: "insert", latex: it.insert });
  };
  const { categories, search } = findMenu(index, pick);
  shell.showFind(slot ? t("slot.title") : t("title"), categories, search);
}

export { showNames } from "./names.svelte.ts";
