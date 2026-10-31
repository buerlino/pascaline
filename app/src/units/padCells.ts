// SPDX-License-Identifier: GPL-3.0-or-later
// R60: the unit pad's unit cells as data for the result's alternatives (units/alternatives.ts, R62's row): per cell its
// legs in the pad's order (tap, flick up, flick down), each a Find unit id with its prefix and label. Read from
// spec/unit-pad.yaml's `units:` as parsed (units/pad.ts holds the import, so the yaml loads with the unit view only) and
// from the user cells (pad.ts UserCells). Plain TS with only erasable syntax: the golden gate runs it in Node.
import type { UserCells } from "./pad.ts";

/** Find's ids are ASCII (`oC`, `u`, `ohm`, `deg`): the symbols they are drawn as. */
export const SYMBOL: Readonly<Record<string, string>> = { oC: "°C", oF: "°F", deg: "°", u: "µ", ohm: "Ω" };
export const symbol = (id: string, label?: string): string => label ?? SYMBOL[id] ?? id;

/** One leg of a cell: a Find unit id, its prefix id when it is a pair (`M` and `Pa`), and the text to draw where it is
 *  not the symbol of the ids (`mil` for Find's `thou`). */
export interface PadLegUnit {
  readonly unit: string;
  readonly prefix?: string;
  readonly label?: string;
}

/** The legend of a cell unit: its label, else the prefix and the unit as symbols. */
export const cellText = (c: PadLegUnit): string => c.label ?? symbol(c.prefix ?? "") + symbol(c.unit);

/** A unit cell: its key and its legs in the pad's order (tap, ↑, ↓; a leg the cell has not is left out). */
export interface PadUnitCell {
  readonly key: string;
  readonly legs: readonly PadLegUnit[];
}

const LEGS = ["tap", "up", "down"] as const;
type Labels = { tap?: unknown; up?: unknown; down?: unknown };

function legsOf(c: Record<string, unknown>, pfx: Labels | undefined, label: Labels | undefined): PadLegUnit[] {
  const out: PadLegUnit[] = [];
  for (const l of LEGS) {
    const unit = c[l];
    if (typeof unit !== "string" || unit === "") continue;
    const p = pfx?.[l];
    const t = label?.[l];
    out.push({ unit, ...(typeof p === "string" && p !== "" ? { prefix: p } : {}), ...(typeof t === "string" && t !== "" ? { label: t } : {}) });
  }
  return out;
}

/** The unit cells of spec/unit-pad.yaml (its `units:`, parsed), in the file's order; throws on a file without them. */
export function padUnitCells(spec: unknown): PadUnitCell[] {
  const units = (spec as { units?: unknown } | null)?.units;
  if (!Array.isArray(units)) throw new Error("unit-pad.yaml: no units");
  return units.map((raw) => {
    const c = raw as Record<string, unknown>;
    if (typeof c["key"] !== "string") throw new Error("unit-pad.yaml: a unit cell without a key");
    return { key: c["key"], legs: legsOf(c, undefined, c["label"] as Labels | undefined) };
  });
}

/** The user cells (U1–U6 as the pad holds them: the user's legs over the spec's defaults), in key order. */
export function userUnitCells(user: UserCells): PadUnitCell[] {
  return Object.entries(user).map(([key, set]) => ({ key, legs: legsOf(set as Record<string, unknown>, set.pfx, set.label) }));
}
