// SPDX-License-Identifier: GPL-3.0-or-later
// Calc.units (G16): the factor table is read from the Find index once, on the first call; a request the builder
// refuses never reaches the engine; a Cancel reaches the view as CalcCancelled, as for Home.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "./engine.ts";
import { CalcCancelled } from "./port.ts";
import { EngineCancelled, type MathEngine } from "../engine/types.ts";
import type { IndexItem } from "../find/types.ts";
import type { UnitJob } from "../units/types.ts";

const items: IndexItem[] = [
  { id: "unit:m", kind: "unit", names: ["m"], title: "Meter", si: "1", dim: "m1", tier: 0, insert: "\\unit{m}{\\mathrm{m}}" },
  { id: "unit:hp", kind: "unit", names: ["hp"], title: "Horse Power", dim: "kg1m2s-3", tier: 0, insert: "\\unit{hp}{\\mathrm{hp}}" },
];
const settings = { digits: 12, angle: "rad", format: "std" } as const;

function stub(answer: (job: UnitJob) => Promise<unknown>): { engine: MathEngine; jobs: UnitJob[] } {
  const jobs: UnitJob[] = [];
  const engine = { units: (job: UnitJob) => (jobs.push(job), answer(job)) } as unknown as MathEngine;
  return { engine, jobs };
}

describe("Calc.units (G16)", () => {
  it("reads the index once and sends the built job", async () => {
    let reads = 0;
    const { engine, jobs } = stub(async () => ({ value: { display: "2" }, dimension: "m1", ms: 0 }));
    const calc = new EngineCalc(engine, { findIndex: async () => (reads++, items) });
    const req = { formula: "2*pasu1", slots: [{ tokens: [{ unit: "m" }] }] };
    expect(await calc.units(req, settings)).toMatchObject({ dimension: "m1" });
    await calc.units(req, settings);
    expect(reads).toBe(1);
    expect(jobs[0]).toEqual({ expr: "2*(((1)*pasdimL^(1)))", inexact: false });
  });

  it("a refused request does not reach the engine", async () => {
    const { engine, jobs } = stub(async () => {
      throw new Error("not called");
    });
    const calc = new EngineCalc(engine, { findIndex: async () => items });
    expect(await calc.units({ formula: "pasu1", slots: [{ tokens: [{ unit: "hp" }] }] }, settings)).toEqual({ error: "nofactor", unit: "hp" });
    expect(jobs).toHaveLength(0);
  });

  it("no index, or one that fails to load, is an engine error, and the next call tries again", async () => {
    const { engine } = stub(async () => ({}));
    expect(await new EngineCalc(engine).units({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, settings)).toMatchObject({ error: "engine" });
    let fail = true;
    const calc = new EngineCalc(engine, { findIndex: async () => (fail ? Promise.reject(new Error("offline")) : items) });
    const req = { formula: "pasu1", slots: [{ tokens: [{ unit: "m" }] }] };
    expect(await calc.units(req, settings)).toMatchObject({ error: "engine" });
    fail = false;
    expect(await calc.units(req, settings)).not.toHaveProperty("error");
  });

  it("Cancel reaches the view as CalcCancelled", async () => {
    const { engine } = stub(async () => {
      throw new EngineCancelled();
    });
    const calc = new EngineCalc(engine, { findIndex: async () => items });
    await expect(calc.units({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, settings)).rejects.toBeInstanceOf(CalcCancelled);
  });
});
