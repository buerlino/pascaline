// SPDX-License-Identifier: GPL-3.0-or-later
// G99 (F54, G69's cases): the names an input reads and binds come from Giac's tree (bridge-2), so a quoting command's
// variable that holds a stored ⚠ value lends it nothing. Expected values: Giac quotes the variable (after x:=3,
// product(x,x,1,4) = 24, seq(x^2,x,1,3) = [1,4,9], sum(x^2,x=1..3) = 14; tools/probes/bridge-forms.ts), so the value
// is the one typed fresh (source: derived).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf } from "./format.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

const mark = (r: HomeResult) => markOf(precisionFacts(r), { format: "STD", digits: 12 })?.mark;

describe.skipIf(!giacAvailable())("G99: a bound variable is no read of the stored name", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
    host.home("x:=BesselJ(1,2)", defaultHomeSettings);
  });

  it("product(x,x,1,4) and seq(x^2,x,1,3) are exact with an unaudited x stored", () => {
    const p = home("product(x,x,1,4)");
    expect([p.display, mark(p), p.facts.warn, p.facts.why]).toEqual(["24", "=", undefined, undefined]);
    const s = home("seq(x^2,x,1,3)");
    expect([s.display, mark(s), s.facts.warn, s.facts.why]).toEqual(["[1,4,9]", "=", undefined, undefined]);
  });

  it("sum(x^2,x=1..3) binds x too: 14, no ⚠", () => {
    const r = home("sum(x^2,x=1..3)");
    expect([r.display, r.facts.warn, r.facts.why]).toEqual(["14", undefined, undefined]);
    expect(mark(r)).not.toBe("⚠");
  });

  it("guards (pass on phase-1): sum(x^2,x,1,10) = 385, int(x^2,x,0,1) ≈ 0.333333333333", () => {
    const s = home("sum(x^2,x,1,10)");
    expect([s.display, mark(s)]).toEqual(["385", "="]);
    const i = home("int(x^2,x,0,1)");
    expect([i.display, mark(i)]).toEqual(["0.333333333333", "≈"]);
  });

  it("guard: diff(x^3,x) keeps ⚠ inherited: x (its result 3*x^2 names x, and Home shows it evaluated)", () => {
    const r = home("diff(x^3,x)");
    expect([mark(r), r.facts.why]).toEqual(["⚠", { inherited: ["x"] }]);
  });

  it("guard: CAS evalf(int(x^2,x,0,1)) names int only in its why", () => {
    const r = host.cas("evalf(int(x^2,x,0,1))", defaultCasSettings).result;
    expect(r.numeric?.facts.why).toEqual({ unaudited: ["int"] });
  });

  it("CAS lists a stored variable a bound name hides only where it is read", () => {
    expect(host.cas("product(x,x,1,4)", defaultCasSettings).result.uses).toBeUndefined();
    expect(host.cas("product(x,x,1,4)+x", defaultCasSettings).result.uses?.map((u) => u.name)).toEqual(["x"]);
  });
});
