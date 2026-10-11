// SPDX-License-Identifier: GPL-3.0-or-later
// Solve and Function analysis mechanics against the real Giac build. Expected values come from
// tests/golden/ (oracle/derived); the golden gate checks the maths, these tests check the plumbing.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("Solve and analysis plumbing (real Giac)", () => {
  let host: EngineHost;
  const s = defaultHomeSettings;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });

  it("info line shows search points without binary noise (regression: 1.6400000000000001)", () => {
    const r = host.solve({ kind: "equations", equations: ["x*exp(x)=5"], unknowns: ["x"], guesses: ["1"] }, s);
    expect(r.roots[0]!.result.display).toBe("1.32672466524"); // oracle lambertw(5): solve.yaml lambert-xexp
    expect(r.info).toBe("sign change in [1.32, 1.64]"); // derived: guess 1, steps 0.01·2^k on both sides
  });

  it("subscripted unknowns x_1, x_2 are found and solved (regression: IDENT rejected the underscore)", () => {
    const eqs = ["x_1+x_2=3", "x_1-x_2=1"];
    expect(host.unknowns(eqs)).toEqual(["x_1", "x_2"]);
    const r = host.solve({ kind: "equations", equations: eqs, unknowns: ["x_1", "x_2"], guesses: ["0", "0"] }, s);
    expect(r.roots.map((x) => x.result.display)).toEqual(["2", "1"]); // derived: add and subtract the equations
  });

  it("a user's values of the unknowns are put back, Home Ans is left alone", () => {
    host.home("Y:=0.25", s);
    const r = host.solve({ kind: "equations", equations: ["Y^2=2"], unknowns: ["Y"], guesses: ["1"] }, s);
    expect(r.roots[0]!.result.display).toBe("1.41421356237"); // oracle sqrt(2)
    expect(host.home("Y", s).result.display).toBe("0.25");
    host.home("1/3", s);
    host.table({ fns: ["x^2"], xs: ["3"] }, s);
    expect(host.home("pasans*3", s).result.display).toBe("1"); // derived: Ans is still 1/3
  });

  it("known variables are substituted from the request, not from Giac", () => {
    host.home("a:=100", s);
    const r = host.solve({ kind: "equations", equations: ["X^2=a"], unknowns: ["X"], guesses: ["1"], knowns: [{ name: "a", value: "2" }] }, s);
    expect(r.roots[0]!.result.display).toBe("1.41421356237"); // oracle sqrt(2)
    expect(host.home("a", s).result.display).toBe("100");
  });

  it("unknowns: in order of appearance, constants excluded", () => {
    expect(host.unknowns(["X^2+a*Y=sin(Z)+pi+e", "Y=exp(X)"])).toEqual(["X", "a", "Y", "Z"]);
  });

  it("rejects mismatched systems and bad names without touching Giac state", () => {
    expect(host.solve({ kind: "equations", equations: ["X+Y=1"], unknowns: ["X", "Y"], guesses: ["0", "0"] }, s).error).toBe("bad-input");
    expect(host.solve({ kind: "poly", equation: "X^2=1", unknown: "X)" }, s).error).toBe("bad-input");
  });

  it("every root comes with its value for re-formatting and the residual", () => {
    const r = host.solve({ kind: "poly", equation: "X^2+1=0", unknown: "X" }, s);
    expect(r.roots.map((x) => x.result.display)).toEqual(["-i", "i"]); // derived: ±i
    expect(r.roots[0]!.result.value?.im.neg).toBe(true);
    expect(r.residualRel).toBeLessThan(1e-25);
    expect(r.method).toBe("proot");
  });

  it("the pole of 1/X is not a root: no root found, with the reason in the info line", () => {
    const r = host.solve({ kind: "equations", equations: ["1/X=0"], unknowns: ["X"], guesses: ["1"] }, s);
    expect(r).toMatchObject({ ok: false, error: "no-root" });
    expect(r.info).toMatch(/sign change/);
  });
});
