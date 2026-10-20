// SPDX-License-Identifier: GPL-3.0-or-later
// G68 (backlog F53, hunt N3): an unknown solved for carries every confirmed digit into the next solve, with its facts.
// Expected values are derived: sqrt(2)^2 = 2 and (sqrt(2) - 1.41421)*10^6 = 3.56237309504880...
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../../engine/host.ts";
import { defaultHomeSettings } from "../../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../../engine/nodeGiac.ts";
import type { Calc } from "../../calc/port.ts";
import type { AppHost } from "../types.ts";
import { SolveApp } from "./app.svelte.ts";

describe.skipIf(!giacAvailable())("G68: Solve's knowns carry every confirmed digit", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const make = (): SolveApp => {
    const settings = { ...defaultHomeSettings, digits: 12 };
    const calc = {
      ready: async () => undefined,
      solve: async (req: Parameters<EngineHost["solve"]>[0]) => host.solve(req, settings),
      unknowns: async (eqs: string[]) => host.unknowns(eqs),
    } as unknown as Calc;
    const h = { calc, settings, kv: { get: async () => undefined, set: async () => undefined }, userNames: [], setEntry: () => undefined, copy: () => undefined } as unknown as AppHost;
    return new SolveApp(h);
  };
  it("y = x^2 with x = sqrt(2) known gives 2, and the shifted difference its digits", async () => {
    const app = make();
    app.unknowns = ["x"];
    app.values = { x: "1" };
    app.slots.fromJSON({ latex: ["x^2=2"], on: [true], selected: 0 } as never);
    app.giac = ["x^2=2"];
    app.selected = "x";
    await app.solve();
    await app.fullOf("x");
    expect(app.value("x")).toMatch(/^1\.4142135623[67]/);
    expect(app.known("x").digits).toBeGreaterThan(20);

    for (const [eq, want] of [
      ["y=x^2", "2"],
      ["y=(x-1.41421)*10^6", "3.56237309505"],
    ] as const) {
      app.slots.fromJSON({ latex: [eq], on: [true], selected: 0 } as never);
      app.giac = [eq];
      app.unknowns = ["y", "x"];
      app.values = { ...app.values, y: "0" };
      app.selected = "y";
      await app.solve();
      expect(Number(app.value("y")), eq).toBeCloseTo(Number(want), 10);
      expect(app.value("y"), eq).toMatch(new RegExp(`^${want.slice(0, 11).replace(".", "\\.")}`));
    }
  });
  it("a ⚠ root used as a known passes its ⚠ on", async () => {
    const app = make();
    app.unknowns = ["y", "x"];
    app.values = { x: "2", y: "0" };
    app.copies = { x: "2.0000" }; // 5 confirmed digits only
    app.warned = { x: true };
    app.slots.fromJSON({ latex: ["y=x^2"], on: [true], selected: 0 } as never);
    app.giac = ["y=x^2"];
    app.selected = "y";
    await app.solve();
    expect(app.warned["y"]).toBe(true);
    expect(app.report?.warn).toBe(true);
  });
});
