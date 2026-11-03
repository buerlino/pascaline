// SPDX-License-Identifier: GPL-3.0-or-later
// R121 (night review 2026-11-02, fh-1 (a)): a unit result that read a stored Home name as a pure number says so. The
// evaluator's Quantity carries the user names its formula read (real Giac; skipped without a build, see nodeGiac.ts),
// the view's result and the Home row the visit writes draw one note naming them. Expected values: derived
// (4700·2 = 9400; 5·9.80665 = 49.03325). The factor table is a hand-made slice of Find's (the index's ids and
// dimension keys, g₀ as CODATA's exact 9.80665 m/s²).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { unitNamesText } from "./messages.ts";
import { shownOf, type UnitShown } from "./result.ts";
import { unitRow } from "./row.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([
  item("unit", "A", { dim: "A1", si: "1" }),
  item("unit", "kg", { dim: "kg1", si: "1" }),
  item("unit", "m", { dim: "m1", si: "1" }),
  item("const", "g0", { value: "9.80665", dim: "m1s-2" }),
]);
const A = { tokens: [{ unit: "A" }] };
const KG = { tokens: [{ unit: "kg" }] };
const STD = { format: "STD", digits: 12 } as const;

describe("unitNamesText (R121)", () => {
  it("one name, several, and more than three then …", () => {
    expect(unitNamesText(["R"])).toBe("R has no unit: a Home value");
    expect(unitNamesText(["R", "C"])).toBe("R, C have no unit: Home values");
    expect(unitNamesText(["a", "b", "c", "d"])).toBe("a, b, c, … have no unit: Home values");
  });
});

describe.skipIf(!giacAvailable())("a stored name in the unit view (R121, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
    for (const d of ["R:=4700", "g0:=980665/100000"]) expect(host.home(d, defaultHomeSettings).defs).toMatchObject([{ set: { kind: "var" } }]);
  });
  const units = (req: UnitRequest): Quantity | UnitError => {
    const job = buildJob(req, TABLE);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };
  const shown = (q: Quantity | UnitError): UnitShown => shownOf(q, STD) as UnitShown;

  it("R·2 with A: 9400 A, and the note says R has no unit", () => {
    const q = units({ formula: "R*2*pasu1", slots: [A] }) as Quantity;
    expect(q.value.display).toBe("9400");
    expect(q.unit).toBe("A");
    expect(q.names).toEqual(["R"]);
    const s = shown(q);
    expect(s.names).toBe("R has no unit: a Home value");
    // the Home row the visit writes draws the same note
    const row = unitRow({ line: "R\\times2", chips: {}, q, slots: { u1: A }, input: "", digits: 12 });
    expect(row.units?.names).toBe("R has no unit: a Home value");
  });

  it("5 kg · g0 (stored): 49.03325 kg, not N, with the note naming g0", () => {
    const q = units({ formula: "5*pasu1*g0", slots: [KG] }) as Quantity;
    expect(q.value.display).toBe("49.03325");
    expect(q.unit).toBe("kg");
    expect(q.names).toEqual(["g0"]);
    expect(shown(q).names).toBe("g0 has no unit: a Home value");
  });

  it("controls: g₀ from Find, a result chip and a formula with no name get no note", () => {
    const c = units({ formula: "5*pasu1*pask1", slots: [KG], consts: ["g0"] }) as Quantity;
    expect(c.value.display).toBe("49.03325");
    expect(c.dimension).toBe("kg1m1s-2");
    const chip = units({ formula: "(50*pi)*pasu1*2", slots: [{ tokens: [{ unit: "m" }] }] }) as Quantity;
    const plain = units({ formula: "9400*pasu1", slots: [A] }) as Quantity;
    for (const q of [c, chip, plain]) {
      expect(q.names).toBeUndefined();
      expect(shown(q).names).toBeUndefined();
      expect(unitRow({ line: "", chips: {}, q, slots: {}, input: "", digits: 12 }).units?.names).toBeUndefined();
    }
  });

  it("a free name is still refused, with no note", () => {
    expect(units({ formula: "5*pasu1*zz", slots: [KG] })).toMatchObject({ error: "symbolic" });
  });
});
