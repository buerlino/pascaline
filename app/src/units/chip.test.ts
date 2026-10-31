// SPDX-License-Identifier: GPL-3.0-or-later
// R61 (r17 section 2): the chip a unit result gives, from the evaluator's own Quantity (real Giac; skipped without a
// build, see nodeGiac.ts). The factor table is a hand-made slice of Find's (the index's ids, dimension keys and
// CODATA 2018's G), so the test needs no index.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "./build.ts";
import { quantityChip } from "./chip.ts";
import { factorTable } from "./factors.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([
  item("unit", "m", { dim: "m1", si: "1" }),
  item("unit", "s", { dim: "s1", si: "1" }),
  item("unit", "h", { dim: "s1", si: "3600" }),
  item("unit", "kg", { dim: "kg1", si: "1" }),
  item("pfx", "k", { si: "1000" }),
  item("pfx", "m", { si: "1/1000" }),
  item("const", "G", { value: "6.67430E-11", unc: "0.00015E-11", dim: "kg-1m3s-2" }),
]);
const KMH = { tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 };

describe.skipIf(!giacAvailable())("quantityChip (R61, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const units = (req: UnitRequest): Quantity | UnitError => {
    const job = buildJob(req, TABLE);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };

  it("72 km/h: the number in the unit shown, exact, with the unit as label and slot (t02)", () => {
    const q = units({ formula: "72*pasu1", slots: [KMH] });
    expect(quantityChip(q)).toEqual({ value: "72", exact: true, unit: { text: "km/h", dim: "m1s-1", slot: KMH } });
  });

  it("≈ 157.079632679 mm carries its exact text 50*pi and is exact, as Home's ≈ 157.079632679 (t04)", () => {
    const q = units({ formula: "2*pi*25*pasu1", slots: [{ tokens: [{ prefix: "m", unit: "m" }] }] }) as Quantity;
    expect(q.value.display).toBe("157.079632679");
    expect(quantityChip(q)).toEqual({ value: "50*pi", exact: true, unit: { text: "mm", dim: "m1", slot: { tokens: [{ prefix: "m", unit: "m" }] } } });
  });

  it("t10: not exact, the value 4936/125 and σ in m² (derived)", () => {
    const q = units({ formula: "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
    const c = quantityChip(q)!;
    expect(c).toMatchObject({ value: "4936/125", exact: false, unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } } });
    // σ as the evaluator gives it (G18, G41: first and second order), in the same unit: σ² = (3.2·0.05)² + (12.34·0.1)²
    // + (0.05·0.1)² = 1.548381 (derived by hand), σ = 1.24433958388… The first order alone (tasks.yaml t10) is
    // 1.244329538345…; both give "39.5 ± 1.2" (report: Needs a decision).
    expect(c.unc).toBe(q.unc!.value.full);
    expect(c.unc).toBe("sqrt(1548381)/1000");
  });

  it("a constant with σ ({=G}) gives a chip that is not exact, with G's σ", () => {
    const q = units({ formula: "pask1*1*pasu1", slots: [{ tokens: [{ unit: "kg" }] }], consts: ["G"] }) as Quantity;
    // G·1 kg = 6.6743E-11 m³/s² ± 1.5E-15 (CODATA 2018, derived)
    expect(quantityChip(q)).toMatchObject({ value: "66743/1000000000000000", exact: false, unc: "3/2000000000000000" });
  });

  it("a refusal gives no chip", () => {
    const q = units({ formula: "1*pasu1+1*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "s" }] }] });
    expect(isUnitError(q)).toBe(true);
    expect(quantityChip(q)).toBeUndefined();
  });

  it("a pure number carries no unit", () => {
    const q = units({ formula: "pasu1/pasu2*3", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
    expect(q.unit).toBe("");
    expect(quantityChip(q)).toEqual({ value: "3", exact: true });
  });
});
