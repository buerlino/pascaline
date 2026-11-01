// SPDX-License-Identifier: GPL-3.0-or-later
// R62: the unit result as data (result.ts), the unit a chip reads as after a tap (factors.ts symbolOf: Wh is "Wh", never
// `W\cdot\,h`), and the alternatives row on the view (▼ ◀ ▶ Enter Esc, a pick, More…) with a host that records.
import { describe, expect, it } from "vitest";
import { decimalFromString, type FormatOptions } from "../engine/format.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import type { IndexItem } from "../find/types.ts";
import type { Alternative } from "./alternatives.ts";
import { slotText } from "./build.ts";
import { factorTable } from "./factors.ts";
import { shownOf, type UnitShown } from "./result.ts";
import { slotCatalogue } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest, UnitSlot } from "./types.ts";
import { UnitView, type ViewHost } from "./view.ts";

const STD: FormatOptions = { format: "STD", digits: 12 };
const num = (s: string, facts: Partial<HomeResult["facts"]> = {}): HomeResult => {
  const value = decimalFromString(s) as NonNullable<ReturnType<typeof decimalFromString>>;
  return {
    ok: true,
    display: s,
    value: { re: value, im: decimalFromString("0") as typeof value },
    path: "exact",
    approximate: false,
    tieRisk: false,
    exactMs: 0,
    totalMs: 0,
    facts: { exact: true, reliableDigits: null, ...facts },
    full: s,
  } as unknown as HomeResult;
};
const qty = (value: HomeResult, over: Partial<Quantity> = {}): Quantity =>
  ({ value, dimension: "m1s-1", unit: "m/s", dimensionText: "L·T⁻¹", siPrefixed: "m/s", ms: 0, ...over }) as Quantity;
const result = (s: ReturnType<typeof shownOf>): UnitShown => {
  expect(s.kind).toBe("result");
  return s as UnitShown;
};
const alt = (text: string, unit: string): Alternative => ({ text, kind: "pad", slot: { tokens: [{ unit }] } });

describe("shownOf (R62)", () => {
  it("an exact value is =, the unit and the dimension text are kept, the row follows", () => {
    const r = result(shownOf(qty(num("20")), STD, [alt("knot", "knot")]));
    expect(r).toMatchObject({ mark: "=", markText: "=", text: "20", display: "20", unit: "m/s", dim: "L·T⁻¹", warn: false, dimension: "m1s-1" });
    expect(r.alts.map((a) => a.text)).toEqual(["knot"]);
    expect(r.sigma).toBeUndefined();
  });

  it("a value that is not exact is ≈; a pure number has no dimension text and no row", () => {
    const r = result(shownOf(qty(num("1.5", { exact: false }), { dimension: "", unit: "", dimensionText: "1" }), STD, [alt("x", "m")]));
    expect(r.mark).toBe("≈");
    expect(r.dim).toBeUndefined();
    expect(r.alts).toEqual([]);
  });

  it("fewer confirmed digits than shown is ⚠ n with the confirmed digits only", () => {
    const r = result(shownOf(qty(num("1.23456789", { exact: false, reliableDigits: 3 })), STD));
    expect(r).toMatchObject({ mark: "⚠", markText: "⚠ 3", text: "1.23" });
  });

  it("σ: the value line is unc.shown, never =, the ⚠ sits before σ and the value and σ come under it", () => {
    const unc = { value: num("0.00707106781187", { exact: false }), text: "0.0071", shown: "1.0000 ± 0.0071", why: "order2" as const };
    const r = result(shownOf(qty(num("1"), { dimension: "", unit: "", dimensionText: "1", unc }), STD));
    expect(r).toMatchObject({ mark: "≈", text: "1.0000 ± 0.0071", warn: true, why: "first order does not hold here", sub: "1 · σ 0.00707106781187" });
    expect(r.sigma).toEqual({ head: "1.0000 ± ", tail: "0.0071" });
  });

  it("a note is one line and the value stays; a refusal is a message only", () => {
    const r = result(shownOf(qty(num("5"), { note: { note: "cycle", unit: "rpm" } }), STD));
    expect(r).toMatchObject({ text: "5", note: "rpm counts turns: the speed at radius r is 2π·r·n" });
    const e: UnitError = { error: "dimension", dims: ["m1", "s1"] };
    expect(shownOf(e, STD)).toEqual({ kind: "message", text: "Units don't match: L vs T" });
  });
});

describe("the unit a chip reads as after a tap (R62)", () => {
  const unit = (id: string, insert: string, names: string[]): IndexItem => ({ id: `unit:${id}`, kind: "unit", names, title: id, tier: 0, insert, si: "3600", dim: "kg1m2s-2" }) as IndexItem;
  const table = factorTable([unit("Wh", "\\unit{Wh}{\\mathrm{W\\cdot\\,h}}", ["Wh", "W·h"]), unit("s_ton", "\\unit{s_ton}{\\mathrm{s_ton}}", ["s_ton"]), unit("oC", "\\unit{oC}{\\mathrm{°C}}", ["oC"])]);
  it("Wh is Wh, °C is °C", () => {
    expect(slotText({ tokens: [{ unit: "Wh" }] }, table)).toBe("Wh");
    expect(slotText({ tokens: [{ unit: "oC" }] }, table)).toBe("°C");
  });
});

describe("the alternatives row on the view (R62)", () => {
  const CAT = slotCatalogue([
    { id: "unit:s_ton", kind: "unit", names: ["s_ton"], title: "Short ton", tier: 0, insert: "\\unit{s_ton}{\\mathrm{s_ton}}", si: "907", dim: "kg1" },
    { id: "unit:cal_th", kind: "unit", names: ["cal_th"], title: "Calorie", tier: 0, insert: "\\unit{cal_th}{\\mathrm{cal_th}}", si: "4184/1000", dim: "kg1m2s-2" },
    { id: "unit:m", kind: "unit", names: ["m"], title: "Meter", tier: 0, insert: "\\unit{m}{\\mathrm{m}}", si: "1", dim: "m1" },
    { id: "unit:s", kind: "unit", names: ["s"], title: "Second", tier: 0, insert: "\\unit{s}{\\mathrm{s}}", si: "1", dim: "s1" },
    { id: "unit:ft", kind: "unit", names: ["ft"], title: "Foot", tier: 0, insert: "\\unit{ft}{\\mathrm{ft}}", si: "381/1250", dim: "m1" },
  ] as IndexItem[]);
  function make(over: Partial<ViewHost> = {}): { view: UnitView; writes: [string, string][]; remembered: [string, UnitSlot][]; found: (string | undefined)[]; dead: number[]; requests: UnitRequest[] } {
    const writes: [string, string][] = [];
    const remembered: [string, UnitSlot][] = [];
    const found: (string | undefined)[] = [];
    const dead: number[] = [];
    const requests: UnitRequest[] = [];
    const host: ViewHost = {
      write: (id, latex) => void writes.push([id, latex]),
      evaluate: (req) => {
        requests.push(req);
        return Promise.resolve(qty(num("1"), { dimension: "m1", unit: req.end ? "ft" : "m" }));
      },
      find: (_into, dim) => void found.push(dim),
      format: () => STD,
      alternatives: () => Promise.resolve([alt("ft", "ft"), alt("m", "m")]),
      remember: (d, s) => {
        remembered.push([d, s]);
        return Promise.resolve();
      },
      dead: () => void dead.push(1),
      changed: () => {},
      ...over,
    };
    const view = new UnitView(CAT, "1", {}, host);
    view.start();
    return { view, writes, remembered, found, dead, requests };
  }

  it("▼ enters the row, ◀ ▶ move and stop at More…, Esc leaves the row, a second Esc is not taken", async () => {
    const t = make();
    t.view.down();
    expect(t.dead).toHaveLength(1); // no result yet: dead
    t.view.apply({ do: "unit", id: "m" });
    await t.view.evaluate();
    expect(t.view.row).toBe(-1);
    t.view.down();
    expect(t.view.row).toBe(0);
    t.view.move(1);
    t.view.move(1);
    expect(t.view.row).toBe(2); // More…
    t.view.move(1);
    expect(t.dead).toHaveLength(2);
    t.view.move(-1);
    expect(t.view.row).toBe(1);
    expect(t.view.escape()).toBe(true);
    expect(t.view.row).toBe(-1);
    expect(t.view.escape()).toBe(false);
  });

  it("Enter on a chip writes the unit into the end slot, remembers it and evaluates again; the view does not reorder", async () => {
    const t = make();
    t.view.apply({ do: "unit", id: "m" });
    await t.view.evaluate();
    const row = (t.view.shown as UnitShown).alts.map((a) => a.text);
    t.view.down();
    await t.view.next(); // Enter picks the first chip
    expect(t.view.activeId).toBe("end");
    expect(t.view.model("end")?.slot).toEqual({ tokens: [{ unit: "ft" }] });
    expect(t.writes.some(([id, latex]) => id === "end" && latex.includes("\\mathrm{ft}"))).toBe(true);
    expect(t.remembered).toEqual([["m1", { tokens: [{ unit: "ft" }] }]]);
    expect(t.requests.at(-1)?.end).toEqual({ tokens: [{ unit: "ft" }] });
    expect(t.view.shown).toMatchObject({ kind: "result", unit: "ft" });
    expect(row).toEqual(["ft", "m"]);
  });

  it("More… clears the end slot and opens Find on the dimension; a fit of 1 puts More… at index 1", async () => {
    const t = make();
    t.view.apply({ do: "unit", id: "m" });
    await t.view.evaluate();
    t.view.fit = 1;
    expect(t.view.chips).toBe(1);
    t.view.down();
    t.view.move(1);
    expect(t.view.row).toBe(1);
    await t.view.next();
    expect(t.found).toEqual(["m1"]);
    expect(t.view.model("end")?.empty).toBe(true);
    expect(t.view.shown).toEqual({ kind: "none" });
    t.view.apply({ do: "unit", id: "ft" }); // the pick from Find lands in the end slot and evaluates
    await Promise.resolve();
    expect(t.requests.at(-1)?.end).toEqual({ tokens: [{ unit: "ft" }] });
  });
  it("a tap on the ton or cal chip reads \"ton\" or \"cal\", not the index's s_ton or cal_th", async () => {
    for (const [unit, text] of [["s_ton", "ton"], ["cal_th", "cal"]] as const) {
      const slot: UnitSlot = { tokens: [{ unit }] };
      const t = make({
        alternatives: () => Promise.resolve([{ text, kind: "pad", slot }]),
        evaluate: (req) => Promise.resolve(qty(num("1"), { dimension: "kg1", unit: req.end ? unit : "kg", ...(req.end ? { shownSlot: req.end } : {}) })),
      });
      t.view.apply({ do: "unit", id: "m" });
      await t.view.evaluate();
      t.view.down();
      await t.view.next();
      expect(t.view.shown).toMatchObject({ kind: "result", unit: text });
    }
  });

  it("after More… and a pick, a later edit of the end slot does not evaluate until Enter", async () => {
    const t = make();
    t.view.apply({ do: "unit", id: "m" });
    await t.view.evaluate();
    t.view.down();
    t.view.move(1);
    t.view.move(1);
    await t.view.next(); // More…
    t.view.apply({ do: "unit", id: "ft" }); // the Find pick evaluates
    await Promise.resolve();
    await Promise.resolve();
    const n = t.requests.length;
    t.view.apply({ do: "power", n: 2 });
    await Promise.resolve();
    expect(t.requests).toHaveLength(n);
  });

  it("a lower fit moves a focus on a hidden chip to More…, so Enter does not clear the end slot", async () => {
    const t = make();
    t.view.apply({ do: "unit", id: "m" });
    await t.view.evaluate();
    t.view.down();
    t.view.move(1); // chip 1 of 2
    t.view.fit = 1;
    expect(t.view.row).toBe(1); // (More… is now index 1: the same number, the focus follows)
    t.view.fit = 0;
    expect(t.view.row).toBe(0);
    expect(t.view.chips).toBe(0);
  });
});
