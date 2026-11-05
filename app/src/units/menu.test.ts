// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the units menu of Find in a slot (spec/units-menu.yaml) on the generated index: the empty query by category, a
// category's search, the second job of a unit row, the products, a pick as tokens, the marks of a row without an exact
// factor; R92: the Constants and Tools rows after the categories. Skipped like the query test when the index is missing
// or holds functions only.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { FindItem, IndexItem } from "../find/types.ts";
import { cellUnitOf, pickActions } from "./find.ts";
import { productActions, unitsMenu, type ConstPick } from "./menu.ts";
import { unitTools } from "./tools.ts";
import { SlotModel, slotCatalogue } from "./slot.ts";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "../find/_gen/find-index.json");
const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];
const full = raw.some((it) => it.kind === "unit");
const spec = parse(readFileSync(join(here, "../../../spec/units-menu.yaml"), "utf8")) as {
  categories: { name: string; first: string[] }[];
  constants: { lists: { name: string; items: string[] | "generated" }[] };
};

describe.skipIf(!full)("products as pad actions", () => {
  const cat = slotCatalogue(makeIndex(raw).items);
  it("cm^2 is c, m and ², kgf/cm^2 splits both factors, Btu/h and in*lbf stay whole units, lb/ft^3 puts the power on the denominator's unit", () => {
    expect(productActions("cm^2", cat)).toEqual([{ do: "pair", prefix: "c", id: "m" }, { do: "power", n: 2 }]);
    expect(productActions("kgf/cm^2", cat)).toEqual([{ do: "pair", prefix: "k", id: "gf" }, { do: "per" }, { do: "pair", prefix: "c", id: "m" }, { do: "power", n: 2 }]);
    expect(productActions("Btu/h", cat)).toEqual([{ do: "unit", id: "Btu" }, { do: "per" }, { do: "unit", id: "h" }]);
    expect(productActions("in*lbf", cat)).toEqual([{ do: "unit", id: "in" }, { do: "unit", id: "lbf" }]);
    expect(productActions("lb/ft^3", cat)).toEqual([{ do: "unit", id: "lb" }, { do: "per" }, { do: "unit", id: "ft" }, { do: "power", n: 3 }]);
    expect(productActions("a/b/c", cat)).toBeUndefined();
    expect(productActions("m^5", cat)).toBeUndefined();
  });
});

describe.skipIf(!full)("the units menu on the generated index", () => {
  const index = makeIndex(raw);
  const cat = slotCatalogue(index.items);
  const picked: FindItem[] = [];
  const products: unknown[] = [];
  const put: FindItem[] = [];
  const menu = unitsMenu(index, { pick: (it) => void picked.push(it), put: (it) => void put.push(it), product: (a) => void products.push(a) });
  const level = (id: string): MenuItem[] => [...(menu.categories.find((c) => c.id === id)?.submenu?.items ?? [])];

  it("the empty query is Prefixes and then the categories in the file's order", () => {
    expect(menu.categories.map((c) => c.id)).toEqual(["ucat:prefixes", ...spec.categories.map((c) => `ucat:${c.name}`)]);
    expect(menu.categories.slice(0, 4).map((c) => c.label)).toEqual(["Prefixes", "Length", "Area", "Volume"]);
    expect(level("ucat:prefixes")).toHaveLength(24);
    expect(level("ucat:prefixes").map((r) => r.id).slice(0, 3)).toEqual(["pfx:Y", "pfx:Z", "pfx:E"]);
    expect(level("ucat:prefixes").some((r) => r.id === "pfx:u")).toBe(true); // µ
  });

  it("a category lists its first units in the file's order, then the other units of its dimensions", () => {
    const length = level("ucat:Length").map((r) => r.id);
    expect(length.slice(0, 6)).toEqual(["unit:m", "unit:km", "unit:cm", "unit:mm", "unit:um", "unit:nm"]);
    expect(length.indexOf("unit:ft")).toBeGreaterThan(length.indexOf("unit:in"));
    expect(new Set(length).size).toBe(length.length);
    expect(length).not.toContain("unit:pt"); // typography: hidden
    expect(level("ucat:Pressure").map((r) => r.id).slice(0, 4)).toEqual(["unit:Pa", "unit:kPa", "unit:MPa", "unit:GPa"]);
  });

  it("every unit a grid names is a row, as an item or as a product", () => {
    for (const c of spec.categories) {
      const rows = new Set(level(`ucat:${c.name}`).map((r) => r.id.replace(/^(unit|uprod):/, "")));
      for (const f of c.first) expect(rows.has(f), `${c.name}: ${f}`).toBe(true);
    }
  });

  it("a product row picks the factors; without a product handler the product rows are left out", () => {
    const row = level("ucat:Area").find((r) => r.id === "uprod:cm^2");
    expect(row?.label).toBe("cm²");
    row?.run?.();
    expect(products).toEqual([[{ do: "pair", prefix: "c", id: "m" }, { do: "power", n: 2 }]]);
    const bare = unitsMenu(index, { pick: () => {} });
    expect(bare.categories.find((c) => c.id === "ucat:Area")?.submenu?.items.some((r) => r.id.startsWith("uprod:"))).toBe(false);
  });

  it("a unit row has the second job 'Put on the unit pad'; a prefix and a product row have none", () => {
    const kpa = level("ucat:Pressure").find((r) => r.id === "unit:kPa");
    expect(kpa?.put?.label).toBe("Put on the unit pad");
    kpa?.put?.run();
    expect(put.map((p) => p.id)).toEqual(["unit:kPa"]);
    expect(level("ucat:prefixes")[0]?.put).toBeUndefined();
    expect(level("ucat:Area").find((r) => r.id === "uprod:cm^2")?.put).toBeUndefined();
    expect(unitsMenu(index, { pick: () => {} }).search("kpa")[0]?.put).toBeUndefined(); // (Settings: a leg is picked, not put)
  });

  it("typed letters search units and prefixes only; in a category, within it", () => {
    expect(menu.search("kpa")[0]?.id).toBe("unit:kPa");
    for (const r of menu.search("m")) expect(/^(unit|pfx):/.test(r.id), r.id).toBe(true);
    const hits = menu.categories.find((c) => c.id === "ucat:Pressure")?.submenu?.search?.("p") ?? [];
    const ids = new Set(level("ucat:Pressure").map((r) => r.id));
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(ids.has(h.id), h.id).toBe(true);
  });

  it("a pick lands as tokens: a prefixed unit as a prefix and a unit, a prefix arms, a plain unit stays one", () => {
    const slot = (id: string): unknown => {
      const m = new SlotModel(cat);
      for (const a of pickActions(cat, index.byId.get(id) as FindItem)) m.apply(a);
      return m.slot;
    };
    expect(slot("unit:MPa")).toEqual({ tokens: [{ prefix: "M", unit: "Pa" }] });
    expect(slot("unit:kWh")).toEqual({ tokens: [{ prefix: "k", unit: "Wh" }] });
    expect(slot("unit:um")).toEqual({ tokens: [{ prefix: "u", unit: "m" }] });
    expect(slot("unit:psi")).toEqual({ tokens: [{ unit: "psi" }] });
    expect(slot("unit:min")).toEqual({ tokens: [{ unit: "min" }] }); // min is no milli-inch
    expect(pickActions(cat, index.byId.get("pfx:k") as FindItem)).toEqual([{ do: "prefix", id: "k" }]);
  });

  it("a unit as a cell holds its prefix: MPa is M and Pa; a unit alone is itself, with its first name where that is not the id", () => {
    expect(cellUnitOf(cat, index.byId.get("unit:MPa") as FindItem)).toEqual({ unit: "Pa", prefix: "M" });
    expect(cellUnitOf(cat, index.byId.get("unit:psi") as FindItem)).toEqual({ unit: "psi" });
    const oC = cellUnitOf(cat, index.byId.get("unit:oC") as FindItem);
    expect(oC.unit).toBe("oC");
  });

  it("a unit without an exact factor is marked in its row, in a category too", () => {
    const rows = menu.search("dB");
    expect(rows.find((r) => r.id === "unit:dB")?.note).toBe("converts only");
    const noFactor = index.items.find((it) => it.kind === "unit" && it.si === undefined && it.id !== "unit:dB" && !/^unit:(dB|Np|bel)/.test(it.id) && it.tier === 0);
    if (noFactor) expect(menu.search(noFactor.names[0] as string).find((r) => r.id === noFactor.id)?.note).toBe("no exact factor");
  });
});

describe.skipIf(!full)("R92: the units menu's Constants and Tools", () => {
  const index = makeIndex(raw);
  const consts: ConstPick[] = [];
  const ran: string[] = [];
  const tools = unitTools({ kind: "none" }, { end: () => void ran.push("end"), alt: () => void ran.push("si"), alts: () => void ran.push("alts"), home: () => void ran.push("home") });
  const menu = unitsMenu(index, { pick: () => {}, put: () => {}, product: () => {}, constant: (c) => void consts.push(c), tools });
  const level = (items: readonly MenuItem[], id: string): MenuItem[] => [...(items.find((c) => c.id === id)?.submenu?.items ?? [])];

  it("the empty query ends with Constants and Tools, after every existing row: no row moves, every digit stays", () => {
    expect(menu.categories.map((c) => c.id)).toEqual(["ucat:prefixes", ...spec.categories.map((c) => `ucat:${c.name}`), "ucat:const", "ucat:tools"]);
    expect(menu.categories.slice(-2).map((c) => c.label)).toEqual(["Constants", "Tools"]);
  });

  it("Constants holds the spec's five lists in its order; More is every other Find constant in qalc's order", () => {
    const lists = level(menu.categories, "ucat:const");
    expect(lists.map((l) => l.label)).toEqual(spec.constants.lists.map((l) => l.name));
    expect(lists.map((l) => l.label)).toEqual(["Math", "Chemistry", "Physics", "Quantum", "More"]);
    expect(level(lists, "uconst:Math").map((r) => r.id)).toEqual(["math:e", "math:pi", "math:i"]);
    const named = new Set<string>();
    for (const l of spec.constants.lists) {
      if (l.name === "Math" || l.items === "generated") continue;
      const lacking = l.items.filter((id) => !index.byId.has(`const:${id}`));
      expect(lacking, `${l.name}: ids the index lacks (left out of the menu)`).toEqual([]);
      expect(level(lists, `uconst:${l.name}`).map((r) => r.id)).toEqual(l.items.filter((id) => index.byId.has(`const:${id}`)).map((id) => `const:${id}`));
      for (const id of l.items) named.add(`const:${id}`);
    }
    const more = index.items.filter((it) => it.kind === "const" && !named.has(it.id)).map((it) => it.id);
    expect(more.length).toBeGreaterThan(20);
    expect(level(lists, "uconst:More").map((r) => r.id)).toEqual(more);
  });

  it("a constant pick goes to the caller with its Find item; Math's e, π and i as Home inserts them", () => {
    const lists = level(menu.categories, "ucat:const");
    level(lists, "uconst:Physics").find((r) => r.id === "const:g_0")?.run?.();
    level(lists, "uconst:Math").forEach((r) => r.run?.());
    expect(consts.map((c) => ("item" in c ? c.item.id : c.latex))).toEqual(["const:g_0", "\\exponentialE", "\\pi", "\\imaginaryI"]);
    expect(level(lists, "uconst:Math").map((r) => r.value)).toEqual(["e", "π", "i"]);
  });

  it("the pick rows carry the press count kinds the removal tests read (R127): units-const for constants, units-tools for tools", () => {
    const lists = level(menu.categories, "ucat:const");
    for (const l of lists) {
      const rows = level(lists, l.id);
      expect(rows.length, l.id).toBeGreaterThan(0);
      expect(rows.map((r) => r.count), l.id).toEqual(rows.map(() => "units-const"));
      expect((l.submenu?.search?.("a") ?? []).every((r) => r.count === "units-const"), l.id).toBe(true);
    }
    const toolRows = level(menu.categories, "ucat:tools");
    expect(toolRows.length).toBeGreaterThan(0);
    expect(toolRows.map((r) => r.count)).toEqual(toolRows.map(() => "units-tools"));
  });

  it("a list searches its own constants by name", () => {
    const physics = level(menu.categories, "ucat:const").find((l) => l.id === "uconst:Physics");
    expect(physics?.submenu?.search?.("grav").map((r) => r.id)).toContain("const:g_0");
    expect(physics?.submenu?.search?.("planck").map((r) => r.id)).toEqual([]);
  });

  it("Tools has one row per unit tool of the spec; without a result only the end slot runs, the rest says why", () => {
    const rows = level(menu.categories, "ucat:tools");
    expect(rows.map((r) => r.id)).toEqual(["utool:end", "utool:si", "utool:alts", "utool:unit", "utool:number"]);
    expect(rows.map((r) => r.label)).toEqual(["The end slot", "The SI form", "The alternatives", "The unit alone", "The number into Home"]);
    expect(rows.map((r) => r.disabled ?? false)).toEqual([false, true, true, true, true]);
    expect(rows[1]?.reason).toBe("needs a result first");
    rows[0]?.run?.();
    expect(ran).toEqual(["end"]);
  });

  it("Settings' cell Find and More… have neither row (no constant handler, no tools)", () => {
    expect(unitsMenu(index, { pick: () => {} }).categories.map((c) => c.id)).not.toContain("ucat:const");
    expect(unitsMenu(index, { pick: () => {} }).categories.map((c) => c.id)).not.toContain("ucat:tools");
  });
});
