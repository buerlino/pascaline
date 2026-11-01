// SPDX-License-Identifier: GPL-3.0-or-later
// R63: a unit-view result as a Home history row (units/row.ts), saved and read back by the session: its chip is R61's
// quantityChip, its number Home's, its slots come back checked. The Quantity is the evaluator's own (real Giac; skipped
// without a build, see nodeGiac.ts) on a hand-made slice of Find's factor table, as units/chip.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { buildJob } from "./build.ts";
import { quantityChip } from "./chip.ts";
import { factorTable } from "./factors.ts";
import { putRow, rowFor, rowSlots, unitLatex, unitRow } from "./row.ts";
import { isUnitError, type Quantity, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([item("unit", "m", { dim: "m1", si: "1" }), item("pfx", "m", { si: "1/1000" })]);
const MM = { tokens: [{ prefix: "m", unit: "m" }] };
const M = { tokens: [{ unit: "m" }] };

/** An in-memory store, as IndexedDB keeps it (structured clones). */
function memKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(structuredClone(data.get(k)) as T | undefined),
    set: (k, v) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

const session = async (kv: Kv): Promise<Session> => {
  const s = new Session(new FakeCalc(), kv);
  await s.restoreHistory();
  return s;
};

describe("unitLatex (R63)", () => {
  it("sets the unit apart (smaller, muted, upright) and escapes what text mode would read", () => {
    expect(unitLatex("m")).toBe("\\htmlStyle{color:var(--muted);font-size:smaller}{\\,\\text{m}}");
    expect(unitLatex("%")).toContain("\\text{\\%}");
    expect(unitLatex("a{b}\\c")).toContain("\\text{a\\{b\\}c}");
  });
});

describe.skipIf(!giacAvailable())("the unit row (R63, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const units = (req: UnitRequest): Quantity => {
    const job = buildJob(req, TABLE);
    if (isUnitError(job)) throw new Error(JSON.stringify(job));
    const q = host.units(job, defaultHomeSettings);
    if (isUnitError(q)) throw new Error(JSON.stringify(q));
    return q;
  };
  /** t04 with the view: 2π·25 mm shown in m (the m alternative is the end slot). */
  const t04 = (): Quantity => units({ formula: "2*pi*25*pasu1", slots: [MM], end: M });
  const t04row = (q: Quantity) =>
    unitRow({ line: "2\\times\\pi\\times25", chips: {}, q, slots: { u2: MM, end: M }, input: "2\\times\\pi\\times25\\,\\mathrm{mm}\\to\\,\\mathrm{m}" });

  it("t04: Home's number and facts, the request, the summary and R61's chip", () => {
    const q = t04();
    const row = t04row(q);
    expect(row).toMatchObject({ view: "home", status: "done", latex: "2\\times\\pi\\times25", text: "0.157079632679" });
    expect(row.units).toEqual({
      slots: { u2: MM, end: M },
      unit: "m",
      dim: "m1",
      dimText: "L",
      latex: unitLatex("m"),
      input: "2\\times\\pi\\times25\\,\\mathrm{mm}\\to\\,\\mathrm{m}",
      chip: quantityChip(q),
    });
    expect(row.units?.chip).toMatchObject({ exact: true, unit: { text: "m", dim: "m1", slot: M } });
    expect(row.inexactInput).toBeUndefined();
  });

  it("is saved with the history and read back: the same chip, the number with its unit, the slots checked", async () => {
    const kv = memKv();
    const s = await session(kv);
    const q = t04();
    const id = putRow(s, t04row(q));
    expect(putRow(s, t04row(q), id)).toBe(id); // a later result of the same visit takes the row's place
    expect(s.home).toHaveLength(1);
    s.flushHistory();
    const r = await session(kv);
    const back = r.home[0] as HistoryItem;
    expect(r.chipFor(back)).toEqual(quantityChip(q));
    expect(r.lastChip("home")).toEqual(quantityChip(q)); // Ans after a unit result is the same chip
    expect(r.display(back)).toEqual({ text: "0.157079632679", latex: `0.157079632679${unitLatex("m")}` });
    expect(r.mark(back)?.mark).toBe("≈");
    expect(rowSlots(back)).toEqual({ u2: MM, end: M });
    expect(rowFor(r, "2\\times\\pi\\times25")).toBe(back);
    expect(rowFor(r, "2")).toBeUndefined();
  });

  it("t10: never =, σ drawn after the number, the chip keeps σ", async () => {
    const q = units({ formula: "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2", slots: [M, M] });
    const row = unitRow({ line: "12.34\\pm0.05\\times3.2\\pm0.1", chips: {}, q, slots: { u1: M, u2: M }, input: "" });
    expect(row.inexactInput).toBe(true);
    expect(row.units?.unc).toEqual({ text: "1.2", shown: "39.5 ± 1.2" });
    expect(row.units?.latex).toBe(`\\pm1.2${unitLatex("m²")}`);
    const s = await session(memKv());
    putRow(s, row);
    const it = s.home[0] as HistoryItem;
    expect(s.mark(it)?.mark).not.toBe("=");
    expect(s.chipFor(it)).toMatchObject({ value: "4936/125", exact: false, unc: "sqrt(1548381)/1000" });
    s.setDecimalMark("comma");
    expect(s.display(it).latex).toContain("\\pm1{,}2");
  });

  it("a stored row that lost its shape gives no chip and no slots, never a wrong one", async () => {
    const kv = memKv();
    const s = await session(kv);
    putRow(s, t04row(t04()));
    s.flushHistory();
    const hist = kv.data.get("history") as { home: Record<string, unknown>[] };
    const units = hist.home[0]?.["units"] as Record<string, unknown>;
    units["chip"] = { value: "pi/20", exact: true, unc: "1" }; // exact with a σ: not ours (R61)
    units["slots"] = { u2: { tokens: [{ unit: "m m" }] }, end: "m", x9: M };
    const r = await session(kv);
    const back = r.home[0] as HistoryItem;
    expect(r.chipFor(back)).toBeUndefined();
    expect(rowSlots(back)).toBeUndefined();
  });
});
