// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the user cells of the unit pad (docs/archive/r9-unit-pad.md section 1, decisions.md P14): U1–U6 while a unit
// slot is open, three legs each (tap, flick up, flick down), eighteen cells. A cell holds one Find unit, with or without
// a prefix (MPa is M and Pa); spec/unit-pad.yaml `user:` gives the defaults, and the user's choice for a leg replaces its
// default and is kept in the stamped store under UNIT_PAD_CELLS (state/storage.ts), the same pattern as the free keys'
// slots (keyboard/userKeys.svelte.ts). Settings › Your keys › Unit pad cells and Find's "Put on the unit pad" set a
// leg; the unit pad reads `userSet()`. Loaded with the unit view and with the Settings sheet, never in the start chunk.
import raw from "../../../spec/unit-pad.yaml";
import type { Layer } from "../keyboard/keyboard.ts";
import { idbKv, type Kv } from "../state/storage.ts";

/** The key of the stamped store (state/storage.ts stamps every value with DATA_VERSION and migrates it on read) that holds
 *  the user's legs, beside USER_KEYS (the free keys' slots). Here, not in storage.ts: the start chunk does not carry it. */
export const UNIT_PAD_CELLS = "unitPadCells";

export type CellLeg = "tap" | "up" | "down";
export const CELL_LEGS: readonly CellLeg[] = ["tap", "up", "down"];
/** A Settings layer is a leg: the tap, the Shift layer (a flick up), the Alpha layer (a flick down). */
export const LEG_OF: Readonly<Record<Layer, CellLeg>> = { primary: "tap", shift: "up", alpha: "down" };

/** What a leg holds: a Find unit id, its prefix id when it is a pair (`M` and `Pa`), and the text to draw where it is
 *  not the symbol of the ids. */
export interface CellUnit {
  readonly unit: string;
  readonly prefix?: string;
  readonly label?: string;
}
/** Per user key id and leg: the user's unit, or null for a leg the user emptied. A leg that is absent has its default. */
export type StoredCells = Record<string, Partial<Record<CellLeg, CellUnit | null>>>;

interface RawUser { key: string; tap?: string; up?: string; down?: string; label?: { tap?: string; up?: string; down?: string } }
const defaults = (raw as unknown as { user: RawUser[] }).user;

/** The user cells' key ids in the pad's order (the free keys U1–U6). */
export const CELL_KEYS: readonly string[] = defaults.map((c) => c.key);

/** Find's ids are ASCII (`oC`, `u`, `ohm`, `deg`): the symbols they are drawn as. */
export const SYMBOL: Readonly<Record<string, string>> = { oC: "°C", oF: "°F", deg: "°", u: "µ", ohm: "Ω" };
export const symbol = (id: string, label?: string): string => label ?? SYMBOL[id] ?? id;
/** The legend of a cell unit: its label, else the prefix and the unit as symbols. */
export const cellText = (c: CellUnit): string => c.label ?? symbol(c.prefix ?? "") + symbol(c.unit);

/** The default of a leg (spec/unit-pad.yaml `user:`), undefined for an empty one. */
export function defaultCell(key: string, leg: CellLeg): CellUnit | undefined {
  const d = defaults.find((c) => c.key === key);
  const unit = d?.[leg];
  if (unit === undefined) return undefined;
  const label = d?.label?.[leg];
  return { unit, ...(label !== undefined ? { label } : {}) };
}

/** A stored leg that still means something, null for an emptied leg; else undefined (the leg keeps its default). */
function valid(b: unknown): CellUnit | null | undefined {
  if (b === null) return null;
  if (typeof b !== "object" || b === null) return undefined;
  const { unit, prefix, label } = b as Partial<Record<keyof CellUnit, unknown>>;
  if (typeof unit !== "string" || unit === "") return undefined;
  if (prefix !== undefined && (typeof prefix !== "string" || prefix === "")) return undefined;
  if (label !== undefined && (typeof label !== "string" || label === "")) return undefined;
  return { unit, ...(prefix !== undefined ? { prefix } : {}), ...(label !== undefined ? { label } : {}) };
}

export class UnitCells {
  /** The user's legs (only the ones that differ from the defaults are stored); each is checked when it is used. */
  private stored = $state<StoredCells>({});
  private readonly kv: Kv;
  private restoring: Promise<void> | undefined;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  /** Read the stored legs (once); until then the cells show their defaults. */
  restore(): Promise<void> {
    this.restoring ??= this.kv.get<unknown>(UNIT_PAD_CELLS).then((v) => {
      if (typeof v === "object" && v !== null) this.stored = v as StoredCells;
    });
    return this.restoring;
  }

  /** What a leg holds: the user's unit, else the default; undefined for an empty leg. */
  get(key: string, leg: CellLeg): CellUnit | undefined {
    const s = this.legs(key)[leg];
    const b = valid(s);
    return b === undefined ? defaultCell(key, leg) : (b ?? undefined);
  }

  /** The legend a leg shows, undefined for an empty one (Settings › Your keys, Unit pad cells). */
  textOf(key: string, leg: CellLeg): string | undefined {
    const c = this.get(key, leg);
    return c && cellText(c);
  }

  /** Is this leg the user's (not its default)? */
  isSet(key: string, leg: CellLeg): boolean {
    return valid(this.legs(key)[leg]) !== undefined;
  }

  /** How many legs hold something. */
  count(): number {
    return CELL_KEYS.reduce((n, k) => n + CELL_LEGS.filter((l) => this.get(k, l) !== undefined).length, 0);
  }

  /** Put a unit on a leg (null: empty it). */
  set(key: string, leg: CellLeg, cell: CellUnit | null): void {
    if (!CELL_KEYS.includes(key)) throw new Error(`'${key}' is not a user cell`);
    if (cell !== null && valid(cell) === undefined) throw new Error(`${key} ${leg}: a cell needs a unit`);
    this.write({ ...this.stored, [key]: { ...this.legs(key), [leg]: cell } });
  }

  /** Give a leg back its default; without a leg, a whole key; without arguments, every cell. */
  reset(key?: string, leg?: CellLeg): void {
    if (key === undefined) return this.write({});
    const legs = { ...this.legs(key) };
    if (leg === undefined) for (const l of CELL_LEGS) delete legs[l];
    else delete legs[leg];
    const next = { ...this.stored };
    if (Object.keys(legs).length === 0) delete next[key];
    else next[key] = legs;
    this.write(next);
  }

  /** The cells as the pad draws them (units/pad.ts UnitPad): per key the ids of its legs, the prefixes and the labels. */
  userSet(): Record<string, { tap?: string; up?: string; down?: string; pfx?: { tap?: string; up?: string; down?: string }; label?: { tap?: string; up?: string; down?: string } }> {
    return Object.fromEntries(
      CELL_KEYS.map((key) => {
        const set: { tap?: string; up?: string; down?: string; pfx?: Record<string, string>; label?: Record<string, string> } = {};
        for (const leg of CELL_LEGS) {
          const c = this.get(key, leg);
          if (!c) continue;
          set[leg] = c.unit;
          if (c.prefix !== undefined) (set.pfx ??= {})[leg] = c.prefix;
          if (c.label !== undefined) (set.label ??= {})[leg] = c.label;
        }
        return [key, set];
      }),
    );
  }

  private legs(key: string): Partial<Record<CellLeg, CellUnit | null>> {
    const s = this.stored[key];
    return typeof s === "object" && s !== null ? s : {};
  }

  private write(next: StoredCells): void {
    this.stored = next;
    void this.kv.set(UNIT_PAD_CELLS, $state.snapshot(next));
  }
}

/** The session's cells, on the app's store. */
export const unitCells = new UnitCells(idbKv);
