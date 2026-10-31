// SPDX-License-Identifier: GPL-3.0-or-later
// R61: the check of a result chip's unit (units/chip.ts quantityChip makes it). The loader keeps a stored unit as it
// reads it (chips.ts validChips, at start); this check runs where the unit is used, off the start chunk (R91's pin): do
// not import this file from code loaded at start. Pure; only erasable TypeScript.
import type { Chip, ChipUnit } from "./chips.ts";

/** A stored text of this form (a non-string never passes). */
const str = (x: unknown, re: RegExp): x is string => typeof x === "string" && re.test(x);
const ID = /^[^\s{}\\]{1,32}$/;

/** R61: a chip's unit when it has its shape (text ≤ 40 characters, a dimension key, a slot of 1 to 16 Find ids with an
 *  optional prefix id and power), else undefined: a stored table keeps the unit unchecked (chips.ts validChips, so the
 *  check is not in the start chunk), and a bad one is dropped here, never thrown. Each field read is checked. */
export function chipUnit(c: Chip | undefined): ChipUnit | undefined {
  const { text, dim, slot } = (c?.unit ?? {}) as Partial<Record<keyof ChipUnit, unknown>>;
  const { tokens: t, per } = (slot ?? {}) as Partial<Record<"tokens" | "per", unknown>>;
  if (!str(text, /^[^]{1,40}$/) || !str(dim, /^(?=.{1,64}$)(?:[A-Za-z]+-?\d+)+$/) || !Array.isArray(t) || t.length === 0 || t.length > 16) return undefined;
  if (per !== undefined && !(typeof per === "number" && Number.isInteger(per) && per >= 0 && per <= t.length)) return undefined;
  const tokens: ChipUnit["slot"]["tokens"] = [];
  for (const x of t as unknown[]) {
    const { unit, prefix, power } = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (!str(unit, ID) || (prefix !== undefined && !str(prefix, /^[^\s{}\\]{1,8}$/)) || (power !== undefined && !str(power, /^-?\d{1,8}(?:\/\d{1,8})?$/))) return undefined;
    tokens.push({ ...(prefix !== undefined ? { prefix } : {}), unit, ...(power !== undefined ? { power } : {}) });
  }
  return { text, dim, slot: { tokens, ...(per !== undefined ? { per } : {}) } };
}
