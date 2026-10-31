// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: Find in a unit slot (Math, docs/archive/r9-unit-pad.md 2.9) and in Settings › Your keys › Unit pad cells.
// The units menu (units/menu.ts) is the sheet; a pick lands in the slot as tokens (a prefixed unit as a prefix and a
// unit: MPa is M and Pa) or sets a user cell; "Put on the unit pad" on a unit row asks which cell and which tap, up or
// down. Loaded on the first Math press in a slot, and by Find when Settings sets a cell; never in the start chunk.
import type { MenuItem } from "../apps/types.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { FindIndex } from "../find/finder.ts";
import type { FindItem } from "../find/types.ts";
import { unitText } from "../i18n/enUnits.ts";
import { unitsMenu } from "./menu.ts";
import { slotCatalogue, splitPair, type PadAction, type SlotCatalogue } from "./slot.ts";
import { CELL_KEYS, CELL_LEGS, unitCells, type CellLeg, type CellUnit } from "./userCells.svelte.ts";

/** What a unit slot is given by a Find pick: a prefix arms, a unit that is a prefix and a unit of Find's list goes in as
 *  both, any other unit as itself. */
export function pickActions(cat: SlotCatalogue, it: FindItem): PadAction[] {
  const id = it.id.slice(it.id.indexOf(":") + 1);
  if (it.kind === "pfx") return [{ do: "prefix", id }];
  const p = splitPair(cat, id);
  return [p ? { do: "pair", prefix: p.prefix, id: p.unit } : { do: "unit", id }];
}

/** A Find unit as a cell holds it: with its prefix when it is a pair; else the first name where that is not the id. */
export function cellUnitOf(cat: SlotCatalogue, it: FindItem): CellUnit {
  const id = it.id.slice(it.id.indexOf(":") + 1);
  const p = splitPair(cat, id);
  if (p) return { unit: p.unit, prefix: p.prefix };
  const name = it.names[0];
  return name !== undefined && name !== id ? { unit: id, label: name } : { unit: id };
}

const legName = (leg: CellLeg): string => unitText(`units.cell.${leg}`);
export const cellName = (key: string): string => `U${CELL_KEYS.indexOf(key) + 1}`;

/** The cell and tap a unit goes to: a row per user cell (its three legs as the value), each opening its legs. */
function cellRows(onSet: (key: string, leg: CellLeg) => void): MenuItem[] {
  return CELL_KEYS.map((key): MenuItem => ({
    id: key,
    label: cellName(key),
    get value() {
      return CELL_LEGS.map((l) => unitCells.textOf(key, l) ?? "–").join(" · ");
    },
    submenu: {
      title: cellName(key),
      items: CELL_LEGS.map((leg): MenuItem => ({
        id: leg,
        label: legName(leg),
        get value() {
          return unitCells.textOf(key, leg) ?? unitText("units.cell.empty");
        },
        run: () => onSet(key, leg),
      })),
    },
  }));
}

export interface UnitFindEnv {
  readonly shell: Pick<AppShell, "showFind" | "showMenu">;
  readonly index: FindIndex;
  readonly cat: SlotCatalogue;
  /** A pad action into the active slot (the view's). */
  apply(a: PadAction): void;
  /** The cells changed: draw the pad again. */
  refresh(): void;
}

/** Math in a slot: Find on units. `into`: an empty user cell was pressed, so the pick also sets that cell. */
export function showUnitFind(env: UnitFindEnv, into?: { key: string; leg: CellLeg }): void {
  const { shell, cat } = env;
  const set = (key: string, leg: CellLeg, it: FindItem): void => {
    unitCells.set(key, leg, cellUnitOf(cat, it));
    env.refresh();
  };
  const { categories, search } = unitsMenu(env.index, {
    pick: (it) => {
      if (into && it.kind === "unit") set(into.key, into.leg, it);
      for (const a of pickActions(cat, it)) env.apply(a);
    },
    put: (it) => shell.showMenu(unitText("units.find.cell"), cellRows((key, leg) => set(key, leg, it))),
    product: (acts) => acts.forEach(env.apply),
  });
  shell.showFind(unitText("units.pad.find"), categories, search);
}

/** Settings › Your keys › Unit pad cells › a leg › Find: the pick sets that leg. */
export function showCellFind(shell: Pick<AppShell, "showFind">, index: FindIndex, key: string, leg: CellLeg): void {
  const cat = slotCatalogue(index.items);
  const { categories, search } = unitsMenu(index, {
    pick: (it) => {
      if (it.kind === "unit") unitCells.set(key, leg, cellUnitOf(cat, it));
    },
  });
  shell.showFind(`${cellName(key)} · ${legName(leg)}`, categories, search);
}
