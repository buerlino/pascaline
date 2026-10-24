// SPDX-License-Identifier: GPL-3.0-or-later
// G68 (backlog F53, hunt N3): an unknown solved for carries every confirmed digit into the next solve, with its facts.
// G68f1: a known's confirmed digits come from its result's facts, a solve waits for them, and a cancellation is caught
// by a second solve with the knowns moved. Expected values: mpmath at 40 digits (tests/golden/.venv):
// sqrt(2) = 1.41421356237309504880..., sqrt(2)^2 = 2, (sqrt(2) - 1.41421)*10^6 = 3.56237309504880...
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../../engine/host.ts";
import { defaultHomeSettings } from "../../engine/homeEval.ts";
import { giacAvailable, nodeHost } from "../../engine/nodeGiac.ts";
import type { Calc } from "../../calc/port.ts";
import type { AppHost } from "../types.ts";
import { SolveApp } from "./app.svelte.ts";

describe.skipIf(!giacAvailable())("G68: Solve's knowns carry every confirmed digit", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = (await nodeHost());
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
    // no wait for the full value: the next solve must wait for it itself (F53)
    expect(app.value("x")).toMatch(/^1\.4142135623[67]/);

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
      expect(app.warned["y"], eq).toBe(false);
    }
    expect(app.known("x").facts?.reliableDigits).toBeGreaterThan(20);
  });
  it("a ⚠ root used as a known passes its ⚠ on", async () => {
    const app = make();
    app.unknowns = ["y", "x"];
    app.values = { x: "2", y: "0" };
    app.copies = { x: "2" }; // 5 confirmed digits only
    app.confirmed = { x: 5 };
    app.warned = { x: true };
    app.slots.fromJSON({ latex: ["y=x^2"], on: [true], selected: 0 } as never);
    app.giac = ["y=x^2"];
    app.selected = "y";
    await app.solve();
    expect(app.warned["y"]).toBe(true);
    expect(app.report?.warn).toBe(true);
  });
  it("an exact root (x^2=4 from 1) is a known with every digit: y=sqrt(x) shows ≈ 1.41421356237, no ⚠", async () => {
    const app = make();
    app.unknowns = ["x"];
    app.values = { x: "1" };
    app.slots.fromJSON({ latex: ["x^2=4"], on: [true], selected: 0 } as never);
    app.giac = ["x^2=4"];
    app.selected = "x";
    await app.solve();
    expect(app.value("x")).toBe("2");
    expect(await app.fullOf("x")).toBe("2"); // the copy is there (the race is the first test's), and has no trailing zeros
    app.slots.fromJSON({ latex: ["y=\\sqrt{x}"], on: [true], selected: 0 } as never);
    app.giac = ["y=sqrt(x)"];
    app.unknowns = ["y", "x"];
    app.values = { ...app.values, y: "1" };
    app.selected = "y";
    await app.solve();
    expect(app.value("y")).toBe("1.41421356237");
    expect(app.warned["y"]).toBe(false);
  });
  it("a ⚠ 14 known near sqrt(2): (x-1.41421)*10^6 cancels, so ⚠ with at most 8 digits, each right", async () => {
    const app = make();
    app.unknowns = ["y", "x"];
    app.values = { x: "1.41421356237", y: "0" };
    app.copies = { x: "1.4142135623731" }; // sqrt(2) to its 14 confirmed digits
    app.confirmed = { x: 14 };
    app.warned = { x: true };
    app.slots.fromJSON({ latex: ["y=(x-1.41421)*10^6"], on: [true], selected: 0 } as never);
    app.giac = ["y=(x-1.41421)*10^6"];
    app.selected = "y";
    await app.solve();
    expect(app.warned["y"]).toBe(true);
    const shown = app.value("y");
    const n = shown.replace(/\D/g, "").length;
    expect(n).toBeLessThanOrEqual(8);
    // every shown digit is a digit of the true value 3.5623730950488... (rounded there)
    expect(Number(shown)).toBe(Number((3.5623730950488).toPrecision(n)));
  });
  it("two ⚠ 14 knowns that cancel: y=(x-z)*10^6 is checked with each moved alone, so at most 8 digits", async () => {
    const app = make();
    app.unknowns = ["y", "x", "z"];
    app.values = { x: "1.41422356237", z: "1.41421356237", y: "0" };
    app.copies = { x: "1.4142235623731", z: "1.414213562373" }; // 14 confirmed digits each (z's last is a 0)
    app.confirmed = { x: 14, z: 14 };
    app.warned = { x: true, z: true };
    app.slots.fromJSON({ latex: ["y=(x-z)*10^6"], on: [true], selected: 0 } as never);
    app.giac = ["y=(x-z)*10^6"];
    app.selected = "y";
    await app.solve();
    await app.fullOf("y");
    // by hand: (1.4142235623731 - 1.4142135623730) * 10^6 = 10.0000000001; one unit of x moves y by 10^-7
    expect(app.warned["y"]).toBe(true);
    expect(app.confirmed["y"]).toBeLessThanOrEqual(8);
    expect(app.value("y")).toBe("10");
  });
  it("a copy saved before G68f1 (no confirmed entry) is not an exact known after a reload", async () => {
    const app = make();
    const stored = { slots: { latex: ["y=x"], on: [true], selected: 0 }, values: { x: "1.41421356237", y: "0" }, selected: "y", warned: {}, copies: { x: "1.4142135623730950488" } };
    (app as unknown as { host: AppHost }).host.kv.get = (async () => stored) as never;
    await app.restore();
    expect(app.copies["x"]).toBe("1.41421356237"); // the old full copy is dropped; the shown value stands in
    expect(app.known("x").facts?.reliableDigits).toBe(12); // the shown digits, each confirmed
    stored.copies = { x: "2" };
    (stored as Record<string, unknown>)["confirmed"] = { x: "exact" };
    stored.values.x = "2";
    await app.restore();
    expect(app.known("x")).toEqual({ name: "x", value: "2" });
  });
});
