// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the units menu of Find in a unit slot (docs/archive/r9-unit-pad.md 2.9, spec/units-menu.yaml): an empty query
// shows the prefixes and the categories (Length, Area, …) in the G2's order, each listing its `first` units and then
// every other tier 0 unit of its dimensions; typed letters search units and prefixes (find/rank.ts). A pick is the
// caller's: units/find.ts turns it into tokens. A product the grids name that Find has no item for (cm^2, Btu/h) is a
// row too, picked as the factors it is made of. R92: after the categories, so no row moves, Constants (the spec's
// lists; a pick is the caller's, units/open.ts puts it on Home's line) and Tools (units/tools.ts, the unit view's places).
// Loaded on the first Math press in a slot (units/find.ts).
import raw from "../../../spec/units-menu.yaml";
import type { MenuItem } from "../apps/types.ts";
import { itemRow, type FindIndex } from "../find/finder.ts";
import { search } from "../find/rank.ts";
import type { FindItem } from "../find/types.ts";
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import { slotCatalogue, splitPair, type PadAction, type SlotCatalogue } from "./slot.ts";
import type { UnitTool } from "./tools.ts";

interface RawCategory { name: string; dims: string[]; first: string[]; hide?: string[] }
interface RawConstList { name: string; items: string[] | "generated" }
const spec = raw as unknown as { prefixes: { items: string[] }; categories: RawCategory[]; constants: { lists: RawConstList[] } };

/** R92: Math's constants are Home's own, inserted as Home's keys insert them (spec/keyboard.yaml: π, i; e as exp's base). */
const MATH: Readonly<Record<string, { id: string; latex: string }>> = {
  e: { id: "e", latex: "\\exponentialE" },
  "π": { id: "pi", latex: "\\pi" },
  i: { id: "i", latex: "\\imaginaryI" },
};

/** A constant picked from the Constants row: a Find constant, or one of Math's as the LaTeX Home inserts. */
export type ConstPick = { readonly item: FindItem } | { readonly latex: string };

export interface UnitsMenuOptions {
  /** A unit or prefix row was picked. */
  pick(it: FindItem): void;
  /** A unit row's second job (unit slots only): "Put on the unit pad". */
  put?(it: FindItem): void;
  /** A product row was picked, as pad actions (cm² is cm, then ²). Without it the product rows are left out (a cell
   *  holds one unit). */
  product?(actions: PadAction[]): void;
  /** R62's "More…": only the units of this dimension key (tier 0 first, then by tier), as one list. */
  dim?: string;
  /** R92: a constant was picked from the Constants row. Without it the row is left out (Settings, More…). */
  constant?(c: ConstPick): void;
  /** R92: the Tools row's tools, as the unit view stands. Without them the row is left out. */
  tools?: readonly UnitTool[];
}

/** A product of Find units as the pad presses it: "ft^3" → ft, ³; "Btu/h" → Btu, ÷, h; "in*lbf" → in, lbf; a factor
 *  that is a prefix and a unit goes in as a pair, as a pick from Find does ("cm^2" → c, m, ²; "kgf/cm^2" → k, gf, ÷, c,
 *  m, ²). A factor or power the pad cannot make gives undefined. */
export function productActions(text: string, cat: SlotCatalogue): PadAction[] | undefined {
  const out: PadAction[] = [];
  const parts = text.split("/");
  if (parts.length > 2) return undefined;
  for (const [i, part] of parts.entries()) {
    if (i === 1) out.push({ do: "per" });
    for (const f of part.split("*")) {
      const [name, pw, more] = f.split("^");
      const n = pw === undefined ? 1 : Number(pw);
      if (!name || more !== undefined || (n !== 1 && n !== 2 && n !== 3 && n !== 4)) return undefined;
      const p = splitPair(cat, name);
      out.push(p ? { do: "pair", prefix: p.prefix, id: p.unit } : { do: "unit", id: name });
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
  const slots = slotCatalogue(index.items);
  const rows = (hits: readonly FindItem[]): MenuItem[] => hits.map(row);
  const find = (q: string, within?: ReadonlySet<string>): MenuItem[] =>
    rows(search(index.prepared, q, { filter: ["unit", "pfx"], prefer: ["unit"], limit: index.items.length }).map((h) => h.item).filter((it) => !within || within.has(it.id)).slice(0, 50));

  if (o.dim !== undefined) {
    const of = index.items.filter((it) => it.kind === "unit" && it.dim === o.dim).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
    return { categories: rows(of), search: (q) => find(q, new Set(of.map((it) => it.id))) };
  }
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
      const acts = it ? undefined : productActions(f, slots);
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
  const constant = o.constant;
  if (constant) categories.push(constantsRow(index, constant));
  if (o.tools) categories.push(toolsRow(o.tools));
  return { categories, search: (q) => find(q) };
}

/** R92: Constants, the spec's lists in its order; an id Find lacks is left out; More is every other Find constant in
 *  the index's (qalc's) order. A list searches its own constants. */
function constantsRow(index: FindIndex, pick: (c: ConstPick) => void): MenuItem {
  const named = new Set(spec.constants.lists.flatMap((l) => (l.items === "generated" ? [] : l.items.map((id) => `const:${id}`))));
  const lists = spec.constants.lists.map((l): MenuItem => {
    const title = unitText(`units.const.${l.name}` as UnitMessageKey);
    if (l.name === "Math" && l.items !== "generated") {
      const items = l.items.flatMap((sym): MenuItem[] => {
        const m = MATH[sym];
        return m ? [{ id: `math:${m.id}`, label: unitText(`units.const.${m.id}` as UnitMessageKey), value: sym, count: "units-const", run: () => pick({ latex: m.latex }) }] : [];
      });
      return { id: `uconst:${l.name}`, label: title, submenu: { title, items } };
    }
    const its = l.items === "generated"
      ? index.items.filter((it) => it.kind === "const" && !named.has(it.id))
      : l.items.flatMap((id) => index.byId.get(`const:${id}`) ?? []);
    const ids = new Set(its.map((it) => it.id));
    const row = (it: FindItem): MenuItem => ({ ...itemRow(it, (x) => pick({ item: x })), count: "units-const" });
    const within = (q: string): MenuItem[] =>
      search(index.prepared, q, { filter: ["const"], limit: index.items.length }).map((h) => h.item).filter((it) => ids.has(it.id)).slice(0, 50).map(row);
    return { id: `uconst:${l.name}`, label: title, submenu: { title, items: its.map(row), search: within } };
  });
  const title = unitText("units.menu.constants");
  return { id: "ucat:const", label: title, submenu: { title, items: lists } };
}

/** R92: Tools, one row per unit tool (units/tools.ts); a tool that cannot run is disabled with its reason. */
function toolsRow(tools: readonly UnitTool[]): MenuItem {
  const title = unitText("units.menu.tools");
  const items = tools.map((t): MenuItem => {
    const label = unitText(`units.tool.${t.id}`);
    const run = t.run;
    return run ? { id: `utool:${t.id}`, label, count: "units-tools", run } : { id: `utool:${t.id}`, label, count: "units-tools", disabled: true, ...(t.reason ? { reason: t.reason } : {}) };
  });
  return { id: "ucat:tools", label: title, submenu: { title, items } };
}
