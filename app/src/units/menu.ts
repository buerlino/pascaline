// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the units menu of Find in a unit slot (docs/archive/r9-unit-pad.md 2.9, spec/units-menu.yaml): an empty query
// shows the prefixes and the categories (Length, Area, …) in the G2's order, each listing its `first` units and then
// every other tier 0 unit of its dimensions; typed letters search units and prefixes (find/rank.ts). A pick is the
// caller's: units/find.ts turns it into tokens. A product the grids name that Find has no item for (cm^2, Btu/h) is a
// row too, picked as the factors it is made of. Loaded on the first Math press in a slot (units/find.ts).
import raw from "../../../spec/units-menu.yaml";
import type { MenuItem } from "../apps/types.ts";
import { itemRow, type FindIndex } from "../find/finder.ts";
import { search } from "../find/rank.ts";
import type { FindItem } from "../find/types.ts";
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import type { PadAction } from "./slot.ts";

interface RawCategory { name: string; dims: string[]; first: string[]; hide?: string[] }
const spec = raw as unknown as { prefixes: { items: string[] }; categories: RawCategory[] };

export interface UnitsMenuOptions {
  /** A unit or prefix row was picked. */
  pick(it: FindItem): void;
  /** A unit row's second job (unit slots only): "Put on the unit pad". */
  put?(it: FindItem): void;
  /** A product row was picked, as pad actions (cm² is cm, then ²). Without it the product rows are left out (a cell
   *  holds one unit). */
  product?(actions: PadAction[]): void;
}

/** A product of Find units as the pad presses it: "ft^3" → ft, ³; "Btu/h" → Btu, ÷, h; "in*lbf" → in, lbf. A factor
 *  or power the pad cannot make gives undefined. */
export function productActions(text: string): PadAction[] | undefined {
  const out: PadAction[] = [];
  const parts = text.split("/");
  if (parts.length > 2) return undefined;
  for (const [i, part] of parts.entries()) {
    if (i === 1) out.push({ do: "per" });
    for (const f of part.split("*")) {
      const [name, pw, more] = f.split("^");
      const n = pw === undefined ? 1 : Number(pw);
      if (!name || more !== undefined || (n !== 1 && n !== 2 && n !== 3 && n !== 4)) return undefined;
      out.push({ do: "unit", id: name });
      if (n !== 1) out.push({ do: "power", n });
    }
  }
  return out;
}

const SUP: Readonly<Record<string, string>> = { "2": "²", "3": "³", "4": "⁴" };
const pretty = (s: string): string => s.split("^").map((p, i) => (i === 0 ? p : (SUP[p.slice(0, 1)] ?? `^${p.slice(0, 1)}`) + p.slice(1))).join("");

export function unitsMenu(index: FindIndex, o: UnitsMenuOptions): { categories: MenuItem[]; search: (q: string) => MenuItem[] } {
  const row = (it: FindItem): MenuItem => {
    const r = itemRow(it, o.pick);
    const put = o.put;
    return it.kind === "unit" && put ? { ...r, put: { label: unitText("units.find.put"), run: () => put(it) } } : r;
  };
  const rows = (hits: readonly FindItem[]): MenuItem[] => hits.map(row);
  const find = (q: string, within?: ReadonlySet<string>): MenuItem[] =>
    rows(search(index.prepared, q, { filter: ["unit", "pfx"], prefer: ["unit"], limit: index.items.length }).map((h) => h.item).filter((it) => !within || within.has(it.id)).slice(0, 50));

  const prefixes = spec.prefixes.items.flatMap((p) => {
    const it = index.items.find((x) => x.kind === "pfx" && (x.id === `pfx:${p}` || x.names.includes(p)));
    return it ? [it] : [];
  });
  const sub = (id: string, title: string, items: MenuItem[], ids: ReadonlySet<string>): MenuItem => ({ id, label: title, submenu: { title, items, search: (q) => find(q, ids) } });
  const categories: MenuItem[] = [sub("ucat:prefixes", unitText("units.menu.prefixes"), rows(prefixes), new Set(prefixes.map((p) => p.id)))];

  for (const cat of spec.categories) {
    const first = new Set(cat.first);
    const hide = new Set(cat.hide ?? []);
    const dims = new Set(cat.dims);
    const items: MenuItem[] = [];
    const ids = new Set<string>();
    for (const f of cat.first) {
      const it = index.byId.get(`unit:${f}`);
      const acts = it ? undefined : productActions(f);
      const product = o.product;
      if (it) { items.push(row(it)); ids.add(it.id); }
      else if (acts && product) items.push({ id: `uprod:${f}`, label: pretty(f), value: f, run: () => product(acts) });
    }
    for (const it of index.items) {
      if (it.kind !== "unit" || it.tier !== 0 || it.dim === undefined || !dims.has(it.dim)) continue;
      const id = it.id.slice(5);
      if (first.has(id) || hide.has(id)) continue;
      items.push(row(it));
      ids.add(it.id);
    }
    const title = unitText(`units.cat.${cat.name}` as UnitMessageKey);
    categories.push(sub(`ucat:${cat.name}`, title, items, ids));
  }
  return { categories, search: (q) => find(q) };
}
