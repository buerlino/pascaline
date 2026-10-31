// SPDX-License-Identifier: GPL-3.0-or-later
// Chips on the entry line (docs/04 sections 2.8 and 3.6): a history result `\res{k}{shown}`, the last result
// `\ans` and a constant `\const{ID}{symbol}`. Each chip is one MathLive macro the cursor cannot enter; the
// second argument is only what the chip shows. The value lives in the entry's chip table, which each history
// item stores beside its entry LaTeX, so the parser never waits for an engine or the Find index.
import type { ValueFacts } from "../engine/types.ts";
import type { UnitSlot } from "../units/types.ts";

/** R61: the unit a result chip from the unit view was shown in. Home has no units (P8): the unit is the chip's label
 *  ("unit dropped") and the slot the units key fills in again; it never reaches Home's arithmetic. */
export interface ChipUnit {
  /** The unit as shown ("km/h", "m²"), at most 40 characters. */
  text: string;
  /** Its dimension key, as the index writes it ("m1s-1"). */
  dim: string;
  /** Its tokens (Find unit and prefix ids), as Quantity.shownSlot (R60). */
  slot: UnitSlot;
}

/** The chip's facts are ValueFacts (G76): `exact` false when `value` is not the exact value (a rounded decimal, a
 *  constant with an uncertainty), so a result computed from it is never "="; a result chip that is not exact keeps the
 *  significant digits confirmed when it was shown and its ⚠ reason, which the next line keeps (R65, decisions M4-5).
 *  `reliableDigits` may be absent (stored chips and constants have none): the same as null. */
export interface Chip extends Omit<ValueFacts, "reliableDigits">, Partial<Pick<ValueFacts, "reliableDigits">> {
  /** Giac text the parser puts in place of the chip: an exact text (`1/3`, `sqrt(2)`) or a decimal with every confirmed digit. */
  value: string;
  /** A constant's standard uncertainty (CODATA), or a unit result's σ in the unit shown (R61); absent when exact. */
  unc?: string;
  /** R61: a unit result's unit (label and slot); absent on every other chip. */
  unit?: ChipUnit;
  /** G81: an inexact constant's basis (Find's item, G80): its value over `pasl_<leaf>` names; absent on a chip
   *  stored before G81, which keeps its own value and σ. */
  basis?: string;
  /** G81: the leaves `basis` uses, with their values and standard uncertainties. */
  basisLeaves?: Record<string, { value: string; unc: string }>;
}

/** Keys: `res:<k>` for `\res{k}{…}`, `const:<ID>` for `\const{ID}{…}`, `ans` for `\ans` (filled at Enter). */
export type ChipTable = Record<string, Chip>;

export const resKey = (k: number | string): string => `res:${k}`;
export const constKey = (id: string): string => `const:${id}`;
export const ANS_KEY = "ans";

/** The chip table keyboard template samples are parsed with (spec/keyboard.yaml: Shift + `+` = Ans, sample Ans = 7). */
export const SAMPLE_CHIPS: ChipTable = { [ANS_KEY]: { value: "7", exact: true } };

/** The chips a LaTeX string refers to, as table keys (to keep only those in a history item). */
export function chipKeysIn(latex: string): Set<string> {
  const keys = new Set<string>();
  for (const m of latex.matchAll(/\\(res|const)\{([^{}]*)\}|\\ans(?![A-Za-z])/g)) {
    if (m[1] === "res") keys.add(resKey(m[2] as string));
    else if (m[1] === "const") keys.add(constKey(m[2] as string));
    else keys.add(ANS_KEY);
  }
  return keys;
}

/** Only the entries of `table` that `latex` refers to (Ans is resolved at Enter, never stored). */
export function pruneChips(table: ChipTable, latex: string): ChipTable {
  const used = chipKeysIn(latex);
  const out: ChipTable = {};
  for (const [k, c] of Object.entries(table)) if (k !== ANS_KEY && used.has(k)) out[k] = c;
  return out;
}

const isText = (x: unknown, max: number, re = /^[^\s{}\\]+$/): x is string => typeof x === "string" && x.length <= max && re.test(x);

/** R61: a stored chip unit with its shape (text ≤ 40 characters, a dimension key, a slot of Find ids), else undefined. */
function validUnit(x: unknown): ChipUnit | undefined {
  if (!x || typeof x !== "object") return undefined;
  const { text, dim, slot } = x as Record<string, unknown>;
  if (typeof text !== "string" || text === "" || text.length > 40 || !isText(dim, 64, /^(?:[A-Za-z]+-?\d+)+$/)) return undefined;
  if (!slot || typeof slot !== "object") return undefined;
  const { tokens, per } = slot as Record<string, unknown>;
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > 16) return undefined;
  if (per !== undefined && !(typeof per === "number" && Number.isInteger(per) && per >= 0 && per <= tokens.length)) return undefined;
  const out: UnitSlot["tokens"] = [];
  for (const t of tokens as unknown[]) {
    const { unit, prefix, power } = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    if (!isText(unit, 32) || (prefix !== undefined && !isText(prefix, 8)) || (power !== undefined && !isText(power, 16, /^-?\d+(?:\/\d+)?$/))) return undefined;
    out.push({ ...(prefix !== undefined ? { prefix } : {}), unit, ...(power !== undefined ? { power } : {}) });
  }
  return { text, dim, slot: { tokens: out, ...(per !== undefined ? { per } : {}) } };
}

/** A stored chip table read back from IndexedDB: keep the well-formed entries only. */
export function validChips(x: unknown): ChipTable | undefined {
  if (!x || typeof x !== "object") return undefined;
  const out: ChipTable = {};
  for (const [k, c] of Object.entries(x as Record<string, unknown>)) {
    if (!/^(res:\d+|const:[A-Za-z0-9_]+)$/.test(k) || !c || typeof c !== "object") continue;
    const { value, exact, unc, reliableDigits: rd, warn, basis, basisLeaves, unit } = c as Record<string, unknown>;
    if (typeof value !== "string" || typeof exact !== "boolean") continue;
    // R61: a value with an uncertainty is never exact (decisions M4-4); such an entry is not ours
    if (exact && typeof unc === "string") continue;
    // G81: a constant's basis and leaves as stored, unchecked: basisOf (constBasis.ts) checks their types and each
    // leaf the basis names before any use, so a malformed or absent one keeps today's path (the check is not in the
    // start chunk)
    const chip: Chip = { value, exact };
    if (typeof unc === "string") Object.assign(chip, { unc }, basis !== undefined ? { basis } : {}, basisLeaves !== undefined ? { basisLeaves } : {});
    if (rd === null || (typeof rd === "number" && Number.isInteger(rd) && rd >= 0 && rd <= 1000)) chip.reliableDigits = rd;
    if (warn === "unaudited" || warn === "unchecked") chip.warn = warn;
    const u = k.startsWith("res:") ? validUnit(unit) : undefined;
    if (u) chip.unit = u;
    out[k] = chip;
  }
  return Object.keys(out).length ? out : undefined;
}
