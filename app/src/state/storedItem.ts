// SPDX-License-Identifier: GPL-3.0-or-later
// A history row read back from IndexedDB (split out of session.svelte.ts by R98): its fields are kept when they have
// their shape, else dropped. The history's start read and the stored Undo copy of Clear and Delete (removedRows.ts) use it.
import { readValueFacts } from "../engine/types.ts";
import type { ComplexValue, PrecisionFacts } from "../engine/format.ts";
import { validChips } from "../input/chips.ts";
import { isFormStep, type ResultFacts } from "./displayMode.ts";
import { FULL_LIMIT, ITEMS_LIMIT } from "./results.ts";
import type { HistoryItem, UsedValue } from "./session.svelte.ts";

/** A stored `uses` read back from IndexedDB: the well-formed entries only. */
function validUses(x: unknown): UsedValue[] | undefined {
  const ok = (Array.isArray(x) ? (x as Partial<UsedValue>[]) : []).filter(
    (u): u is UsedValue => typeof u?.name === "string" && typeof u.preview === "string" && (u.view === "home" || u.view === "cas"),
  );
  return ok.length ? ok : undefined;
}

/** Stored facts read back from IndexedDB, through the one mapping for stored facts (readValueFacts: an item stored
 *  before G76 says `exactRational`): kept when they have the shape, else dropped (the item then shows no mark). */
function validFacts(x: unknown): ResultFacts | undefined {
  if (!x || typeof x !== "object") return undefined;
  const f = x as Record<string, unknown>;
  const exactKey = (o: Record<string, unknown>): boolean => typeof (o["exact"] ?? o["exactRational"]) === "boolean";
  const facts = readValueFacts(f);
  if (!facts || !exactKey(f) || f["reliableDigits"] === undefined) return undefined;
  const d = f["digits"];
  if (d !== undefined && !(typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 1000)) return undefined;
  const items = f["items"];
  if (items !== undefined && (!Array.isArray(items) || items.length > ITEMS_LIMIT)) return undefined;
  const els: PrecisionFacts[] = [];
  for (const it of Array.isArray(items) ? (items as unknown[]) : []) {
    const e = it && typeof it === "object" ? (it as Record<string, unknown>) : null;
    const ef = e && exactKey(e) ? readValueFacts(e) : null;
    if (!e || !ef) return undefined;
    els.push({ ...ef, ...(e["value"] ? { value: e["value"] as ComplexValue } : {}) });
  }
  return {
    ...facts,
    ...(d !== undefined ? { digits: d } : {}),
    ...(Array.isArray(items) ? { items: els } : {}),
    ...(f["shape"] !== undefined ? { shape: f["shape"] as [number, number] } : {}),
  };
}

/** A stored history item with a fresh id; chip fields that do not have their shape are dropped. */
export function restoredItem(i: HistoryItem, id: number): HistoryItem {
  const { chips, full, fullExact, drawn, facts, uses, settingReset, ...rest } = i as HistoryItem & { form?: unknown };
  const { form, ...base } = rest;
  const out: HistoryItem = { ...base, id };
  if (isFormStep(form)) out.form = form;
  const f = validFacts(facts);
  if (f) out.facts = f;
  const c = validChips(chips);
  if (c) out.chips = c;
  const u = validUses(uses);
  if (u) out.uses = u;
  if (settingReset === true) out.settingReset = true;
  if (typeof full === "string" && full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = fullExact === true;
  }
  if (typeof drawn === "string" && drawn.length <= FULL_LIMIT) out.drawn = drawn;
  return out;
}

