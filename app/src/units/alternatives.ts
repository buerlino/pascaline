// SPDX-License-Identifier: GPL-3.0-or-later
// R60: the unit result's alternatives as data (docs/archive/r17-unit-result.md sections 0.2 and 3, docs/04 4.3
// "Result"): the row of units a result can be shown in, each an end slot. A tap sets the request's end slot (withEnd)
// and the caller runs Calc.units() again, so value, mark, σ and note come from the evaluator: nothing is converted here.
// `units.targets` (the last unit tapped per dimension) orders the row only; it never changes the unit shown (G25).
// Main thread, synchronous, no Giac; loaded with the unit view only. Only erasable TypeScript syntax (the golden gate).
import type { Kv } from "../state/storage.ts";
import { shownUnits, slotText } from "./build.ts";
import { isExponent, powerText, siSlot } from "./dims.ts";
import type { FactorTable } from "./factors.ts";
import { cellText, type PadLegUnit, type PadUnitCell } from "./padCells.ts";
import type { Quantity, ShownUnit, UnitRequest, UnitSlot, UnitToken } from "./types.ts";

/** Where an alternative comes from: the coherent SI unit with no prefix, the SI unit with its prefix, the last unit
 *  used for the dimension, a pad or user cell, a unit typed in the request. */
export type AltKind = "si" | "siPrefixed" | "target" | "pad" | "typed";

export interface Alternative {
  /** The end slot a tap sets. */
  slot: UnitSlot;
  /** The chip's text ("m/s", "ft²", "mil", "Δ°C"). */
  text: string;
  kind: AltKind;
}

export interface AltContext {
  table: FactorTable;
  /** The pad's unit cells in the pad's order (padUnitCells of spec/unit-pad.yaml, units/pad.ts padUnitList). */
  pad: readonly PadUnitCell[];
  /** The user cells U1–U6 (userUnitCells of the pad's UserCells). */
  user: readonly PadUnitCell[];
  /** The request the result came from: its typed units, and whether a temperature in it is absolute. */
  req: UnitRequest;
  /** `units.targets[q.dimension]`, the last unit tapped for this dimension. */
  target?: UnitSlot;
}

/** A slot's identity: its tokens as prefix:unit^signed power, sorted (kg and k·g are one). */
function keyOf(slot: UnitSlot): string {
  const per = slot.per ?? slot.tokens.length;
  return slot.tokens
    .map((t, i) => {
      const [prefix, unit] = t.prefix === "k" && t.unit === "g" ? ["", "kg"] : [t.prefix ?? "", t.unit];
      const p = t.power ?? "1";
      return `${prefix}:${unit}^${i >= per ? (p.startsWith("-") ? p.slice(1) : `-${p}`) : p}`;
    })
    .sort()
    .join(" ");
}

/** A slot as one typed unit: its dimension key and factor to SI (build.ts shownUnits), or null (a fractional power,
 *  a unit with no exact factor, °C or °F). */
function unitOf(slot: UnitSlot, table: FactorTable): ShownUnit | null {
  return shownUnits({ formula: "pasu1", slots: [slot] }, table)[0] ?? null;
}

const noPrefix = (slot: UnitSlot): UnitSlot => ({ ...slot, tokens: slot.tokens.map(({ prefix, ...t }) => (prefix === "k" && t.unit === "g" ? { ...t, unit: "kg" } : t)) });

/** r17 section 3: the coherent SI unit is picked, never found by factor 1 alone (Hz and Bq, J/kg and Gy share one): a
 *  typed unit of the dimension without its prefixes when that has factor 1 (N·m for a torque), then the pad's tap unit
 *  when it is coherent (Hz), then the base form of the dimension key (dims.ts siSlot: m/s, m²/s², kg). */
function coherent(dim: string, typed: readonly ShownUnit[], ctx: AltContext): UnitSlot {
  for (const t of typed) {
    const bare = noPrefix(t.slot);
    if (unitOf(bare, ctx.table)?.factor === "1") return bare;
  }
  for (const c of ctx.pad) {
    const tap = c.legs[0];
    if (!tap || tap.prefix !== undefined) continue;
    const u = ctx.table.units.get(tap.unit);
    if (u?.dim === dim && u.si === "1") return { tokens: [{ unit: tap.unit }] };
  }
  return siSlot(dim);
}

/** A leg's unit when it has an exact factor (no °C, °F offset) and a known prefix: its dimension key, else null. */
function legDim(leg: PadLegUnit, table: FactorTable): string | null {
  const u = table.units.get(leg.unit);
  if (!u?.si || u.dim === undefined || u.si.includes("+")) return null;
  if (leg.prefix !== undefined && !table.prefixes.has(leg.prefix)) return null;
  return u.dim;
}

/** The dimension key `dim` divided by n, when every exponent is an integer multiple of n. */
function root(dim: string, n: number): string | null {
  const parts = [...dim.matchAll(/([A-Za-z]+?)(-?\d+(?:\/\d+)?)/g)];
  if (!parts.length) return null;
  let out = "";
  for (const m of parts) {
    if (!/^-?\d+$/.test(m[2]!) || Number(m[2]) % n !== 0) return null;
    out += `${m[1]}${Number(m[2]) / n}`;
  }
  return out;
}

/** The pad's legs for `dim`: the cells of that dimension in the pad's order (each cell's tap, ↑, ↓); when there is none,
 *  the cells of its square or cube root, each leg to that power (L² from the length cells: ft², in²…); then the user
 *  cells' legs of that dimension. */
function padLegs(dim: string, ctx: AltContext): { leg: PadLegUnit; power: number }[] {
  const of = (cells: readonly PadUnitCell[], d: string, power: number): { leg: PadLegUnit; power: number }[] =>
    cells.flatMap((c) => (c.legs[0] && legDim(c.legs[0], ctx.table) === d ? c.legs.filter((l) => legDim(l, ctx.table) === d).map((leg) => ({ leg, power })) : []));
  let pad = of(ctx.pad, dim, 1);
  for (const n of [2, 3]) {
    if (pad.length) break;
    const r = root(dim, n);
    if (r !== null) pad = of(ctx.pad, r, n);
  }
  const user = ctx.user.flatMap((c) => c.legs.filter((l) => legDim(l, ctx.table) === dim).map((leg) => ({ leg, power: 1 })));
  return [...pad, ...user];
}

/** Temperatures (docs/04 4.3): an absolute one (°C or °F alone in a slot or the end slot) offers K, °C, °F; an interval
 *  offers K, Δ°C, Δ°F (Find's aliases of K and °R, so Δ°C's slot is K). */
function temperatures(req: UnitRequest): { slot: UnitSlot; text: string; key?: string }[] {
  const lone = (s: UnitSlot | undefined): boolean => s?.tokens.length === 1 && (s.tokens[0]!.power ?? "1") === "1" && ["oC", "oF"].includes(s.tokens[0]!.unit);
  const absolute = req.slots.some(lone) || lone(req.end);
  const one = (unit: string): UnitSlot => ({ tokens: [{ unit }] });
  return absolute
    ? [{ slot: one("K"), text: "K" }, { slot: one("oC"), text: "°C" }, { slot: one("oF"), text: "°F" }]
    : [{ slot: one("K"), text: "K" }, { slot: one("K"), text: "Δ°C", key: "Δ°C" }, { slot: one("oR"), text: "Δ°F" }];
}

/**
 * The row for a result, in r17 0.2's order: the coherent SI unit with no prefix, the SI unit with its prefix, the target,
 * the pad cell's units of that dimension in the pad's order, then the user cells', then the typed units. Repeats and the
 * unit shown are left out; none for a pure number or a result without a dimension. A temperature gives its own three
 * (absolute or interval) after the SI units, and no target (an absolute target would read an interval as absolute).
 */
export function alternatives(q: Quantity, ctx: AltContext): Alternative[] {
  const dim = q.dimension;
  if (dim === null || dim === "") return [];
  const out: Alternative[] = [];
  const seen = new Set<string>(q.shownSlot ? [keyOf(q.shownSlot)] : []);
  const add = (slot: UnitSlot, kind: AltKind, text = slotText(slot, ctx.table), key = keyOf(slot)): void => {
    if (!slot.tokens.length || seen.has(key)) return;
    seen.add(key);
    out.push({ slot, text, kind });
  };
  const { end, ...asTyped } = ctx.req;
  void end;
  const typed = shownUnits(asTyped, ctx.table).filter((u) => u.dim === dim);
  add(coherent(dim, typed, ctx), "si");
  if (q.siPrefixed !== "") add(siSlot(dim, q.siPrefixed), "siPrefixed");
  if (dim === "K1") {
    for (const t of temperatures(ctx.req)) add(t.slot, "pad", t.text, t.key);
    return out;
  }
  if (ctx.target && unitOf(ctx.target, ctx.table)?.dim === dim) add(ctx.target, "target");
  for (const { leg, power } of padLegs(dim, ctx)) {
    const tok: UnitToken = { ...(leg.prefix !== undefined ? { prefix: leg.prefix } : {}), unit: leg.unit, ...(power !== 1 ? { power: `${power}` } : {}) };
    add({ tokens: [tok] }, "pad", cellText(leg) + powerText(`${power}`));
  }
  for (const t of typed) add(t.slot, "typed");
  return out;
}

/** A tap: the request with the alternative as its end slot (the caller runs Calc.units() on it). */
export function withEnd(req: UnitRequest, alt: Alternative): UnitRequest {
  return { ...req, end: alt.slot };
}

/** The stamped store's key (state/storage.ts) of `units.targets`, beside the user keys: per dimension key, the slot
 *  last tapped. Here, not in storage.ts: the start chunk does not carry it. */
export const UNIT_TARGETS = "units.targets";

function isSlot(v: unknown): v is UnitSlot {
  if (typeof v !== "object" || v === null) return false;
  const { tokens, per } = v as { tokens?: unknown; per?: unknown };
  if (!Array.isArray(tokens) || !tokens.length) return false;
  if (per !== undefined && (!Number.isInteger(per) || (per as number) < 0 || (per as number) > tokens.length)) return false;
  return tokens.every((t: unknown) => {
    if (typeof t !== "object" || t === null) return false;
    const { unit, prefix, power } = t as Record<string, unknown>;
    return typeof unit === "string" && unit !== "" && (prefix === undefined || (typeof prefix === "string" && prefix !== "")) && (power === undefined || (typeof power === "string" && isExponent(power)));
  });
}

/** `units.targets` as stored; an entry that is not a slot is left out, a missing or bad record is {}. */
export async function readTargets(kv: Kv): Promise<Record<string, UnitSlot>> {
  const v = await kv.get<unknown>(UNIT_TARGETS);
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, UnitSlot] => isSlot(e[1])));
}

/** A tap: `slot` becomes the target of dimension `dim`; returns the targets as written. */
export async function writeTarget(kv: Kv, dim: string, slot: UnitSlot): Promise<Record<string, UnitSlot>> {
  const next = { ...(await readTargets(kv)), [dim]: slot };
  await kv.set(UNIT_TARGETS, next);
  return next;
}
