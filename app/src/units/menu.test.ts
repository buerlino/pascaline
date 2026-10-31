// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the units menu of Find in a slot (spec/units-menu.yaml) on the generated index: the empty query by category, a
// category's search, the second job of a unit row, the products, a pick as tokens, the marks of a row without an exact
// factor. Skipped like the query test when the index is missing or holds functions only.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { makeIndex } from "../find/finder.ts";
import type { FindItem, IndexItem } from "../find/types.ts";
import { cellUnitOf, pickActions } from "./find.ts";
import { productActions, unitsMenu } from "./menu.ts";
import { SlotModel, slotCatalogue } from "./slot.ts";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "../find/_gen/find-index.json");
const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];
const full = raw.some((it) => it.kind === "unit");
const spec = parse(readFileSync(join(here, "../../../spec/units-menu.yaml"), "utf8")) as { categories: { name: string; first: string[] }[] };

describe("products as pad actions", () => {
  it("cm^2 is cm and ², Btu/h is Btu ÷ h, in*lbf is both units, lb/ft^3 puts the power on the denominator's unit", () => {
    expect(productActions("cm^2")).toEqual([{ do: "unit", id: "cm" }, { do: "power", n: 2 }]);
    expect(productActions("Btu/h")).toEqual([{ do: "unit", id: "Btu" }, { do: "per" }, { do: "unit", id: "h" }]);
    expect(productActions("in*lbf")).toEqual([{ do: "unit", id: "in" }, { do: "unit", id: "lbf" }]);
    expect(productActions("lb/ft^3")).toEqual([{ do: "unit", id: "lb" }, { do: "per" }, { do: "unit", id: "ft" }, { do: "power", n: 3 }]);
    expect(productActions("a/b/c")).toBeUndefined();
    expect(productActions("m^5")).toBeUndefined();
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
    expect(products).toEqual([[{ do: "unit", id: "cm" }, { do: "power", n: 2 }]]);
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
