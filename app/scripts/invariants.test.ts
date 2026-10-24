// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { EngineHost } from "../src/engine/host.ts";
import { defaultHomeSettings, pasdegCommand } from "../src/engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { checkAngle, checkStoreBoth, INV_NAME, invariantsOf, invariantsStage, storesNames, type InvariantFailure } from "./invariants.ts";

const fail = (id: string, check = "a"): InvariantFailure => ({ id, check, detail: "RAD 1, DEG 2" });

describe("invariants stage verdict", () => {
  it("passes with no failure and no known entry", () => {
    expect(invariantsStage([], []).ok).toBe(true);
  });
  it("fails on a wrong DEG answer that is not known", () => {
    const r = invariantsStage([fail("home:x")], []);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("NEW home:x");
  });
  it("passes when the failures are exactly the known ones", () => {
    const r = invariantsStage([fail("home:x")], [{ id: "home:x", check: "a", package: "G46" }]);
    expect(r.ok).toBe(true);
    expect(r.summary).toBe("1 known failures, 0 new, 0 now passing");
  });
  it("fails on a known failure that now passes, so the list is pruned", () => {
    const r = invariantsStage([], [{ id: "home:x", check: "a", package: "G46" }]);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("NOW PASSING");
  });
  it("tells a known id with another check apart", () => {
    expect(invariantsStage([fail("home:x", "d")], [{ id: "home:x", check: "a", package: "G46" }]).ok).toBe(false);
  });
});

describe("invariantsOf: angle-free inputs", () => {
  it("takes exp, hyperbolic functions and powers of negatives", () => {
    for (const t of ["exp(i*90)", "cosh(90*i)", "(-8)^0.2", "1/3", "sqrt(2)"]) expect(invariantsOf(t).angleFree, t).toBe(true);
  });
  it("leaves out trig, inverse trig, arg, atan2, polar and the degree sign", () => {
    for (const t of ["sin(1)", "acos(0.3)", "arg(1+i)", "atan2(1,2)", "polar_coordinates(1+i)", "30°", "tan(45)"]) expect(invariantsOf(t).angleFree, t).toBe(false);
  });
  it("counts a before entry", () => {
    expect(invariantsOf("X", ["X:=sin(1)"]).angleFree).toBe(false);
  });
});

describe.skipIf(!giacAvailable())("check (a) compares RAD with DEG (real Giac)", () => {
  const run = async (input: string, angle: "rad" | "deg") => {
    const { giac: g, bridge } = await loadNodeGiac();
    g.eval(pasdegCommand("rad"));
    return new EngineHost(g, bridge).home(input, { ...defaultHomeSettings, angle }).result;
  };
  it("a wrong DEG answer for (-8)^0.2 is a NEW failure and fails the stage", async () => {
    const rad = await run("(-8)^0.2", "rad");
    const wrongDeg = await run("1.5156254288+0.0166213589593*i", "deg"); // what DEG gave before G46 (D12)
    expect(rad.display).toBe("1.22624046096+0.89091584445*i");
    const f = checkAngle("home:x", rad, wrongDeg);
    expect(f).not.toBeNull();
    expect(f!.detail).toContain("1.5156254288+0.0166213589593*i");
    const r = invariantsStage(f ? [f] : [], []);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("NEW home:x");
  });
  it("the same answer in both modes is no failure", async () => {
    expect(checkAngle("home:x", await run("(-8)^0.2", "rad"), await run("(-8)^0.2", "deg"))).toBeNull();
  });
});

describe.skipIf(!giacAvailable())("check (d) on one shared engine (real Giac)", () => {
  it("a name stored by one input does not reach the next one", async () => {
    const { giac: g, bridge } = await loadNodeGiac();
    g.eval(pasdegCommand("rad"));
    const host = new EngineHost(g, bridge);
    expect((await checkStoreBoth(async () => host, "t:1", "7+1")).checked).toBe(2);
    const after = host.home(INV_NAME, defaultHomeSettings).result;
    expect(after.display).not.toBe("8");
    expect((await checkStoreBoth(async () => host, "t:2", "2*3")).failures).toEqual([]);
  });
  it("flags inputs that store a name, so they never run on the shared engine", () => {
    for (const t of ["evalf(1/3)*x=>g", "g:=5", "sto(3,g)"]) expect(storesNames(t), t).toBe(true);
    for (const t of ["7+1", "solve(x^2=4,x)", "a<=b"]) expect(storesNames(t), t).toBe(false);
  });
  it("a name stored on one engine does not reach an input on another", async () => {
    const mk = async (): Promise<EngineHost> => {
      const { giac: g, bridge } = await loadNodeGiac();
      g.eval(pasdegCommand("rad"));
      return new EngineHost(g, bridge);
    };
    const a = await mk();
    a.home("evalf(1/3)*x=>pasleak", defaultHomeSettings);
    expect(a.home("pasleak", defaultHomeSettings).result.display).not.toBe("pasleak");
    const b = await mk();
    expect(b.home("pasleak", defaultHomeSettings).result.display).toBe("pasleak");
  });
});
