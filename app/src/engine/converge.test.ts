// SPDX-License-Identifier: GPL-3.0-or-later
// G39: a number for something that does not exist is refused; Giac's [exact, numeric] pair is never a list.
// Expected refusals are derived (a pole inside the interval, a term that does not tend to 0); values are oracle cases
// of home.yaml (g39-keep-*).
import { engineGiac, type EngineGiac } from "./nodeGiac.ts";
import { fakeGiac } from "./fakeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { callsIn, floatBounds, giacPair, hasDefiniteIntegral, integratedNumerically, refusalOf } from "./converge.ts";
import { EngineHost, type GiacApi } from "./host.ts";
import type { GiacBridge } from "./bridge.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { rewriteAngles } from "../input/angles.ts";

describe("converge helpers", () => {
  it("finds the calls, nested ones too, and not a name that ends in the word", () => {
    expect(callsIn("2*int(1/x,x,-1,1)+sum(1/k^2,k,1,inf)").map((c) => [c.kind, c.args.length])).toEqual([["int", 4], ["sum", 4]]);
    expect(callsIn("myint(x)+\"int(\"")).toEqual([]);
    expect(callsIn("limit(sin(x),x,inf)")[0]!.args).toEqual(["sin(x)", "x", "inf"]);
  });
  it("reads Giac's pair: an exact element, then a float", () => {
    expect(giacPair("[8100/pi,0.785398163397]")).toEqual({ exact: "8100/pi", numeric: "0.785398163397" });
    expect(giacPair("[0.5,0.785398163397]")).toBeNull();
    expect(giacPair("[1,2]")).toBeNull();
    expect(giacPair("[1/2,x]")).toBeNull();
    expect(hasDefiniteIntegral("int(1/(1+x^2),x,0,1)")).toBe(true);
    expect(hasDefiniteIntegral("int(1/(1+x^2),x)")).toBe(false);
    expect(hasDefiniteIntegral("[int(x,x,0,1),evalf(pi)]")).toBe(false);
  });
  it("G90: makes every definite integral's bounds floats, nested ones too, and leaves the rest alone", () => {
    expect(floatBounds("int(asin(x)*12^x,x,0,1)")).toBe("int(asin(x)*12^x,x,evalf(0),evalf(1))");
    expect(floatBounds("2*integrate(int(x*y,y,0,x),x,-1,(1/2))+int(x,x)")).toBe("2*integrate(int(x*y,y,evalf(0),evalf(x)),x,evalf(-1),evalf((1/2)))+int(x,x)");
    expect(floatBounds('myint(x,x,0,1)+"int(x,x,0,1)"')).toBe('myint(x,x,0,1)+"int(x,x,0,1)"');
  });
  it("G90: Giac's exact answer with an integrate(…) left in it is its numeric integration; no Giac call for it", () => {
    const none = fakeGiac((): string => { throw new Error("no call expected"); });
    expect(integratedNumerically(none, "int(x^x,x,0,1)", "integrate(exp(ln(x)*x+ln(x))/x,x,0,1)")).toBe(true);
    expect(integratedNumerically(none, "int(exp(-x^2),x,0,1)", "1/2*sqrt(pi)*erf(1)")).toBe(false);
    expect(integratedNumerically(none, "int(f(x),x)", "integrate(f(x),x)")).toBe(false);
    // evalf(int(…)): each integral is run exactly once more.
    const giac = fakeGiac((t: string): string => (t === "int(x^x,x,0,1)" ? "integrate(exp(ln(x)*x+ln(x))/x,x,0,1)" : "1/3"));
    expect(integratedNumerically(giac, "evalf(int(x^x,x,0,1))", "0.783430510712")).toBe(true);
    expect(integratedNumerically(giac, "evalf(int(x^2,x,0,1))", "0.333333333333")).toBe(false);
  });
  it("a check that cannot finish keeps the result, unchecked (Giac's timeout on the second integral)", () => {
    const answers: [RegExp, string][] = [
      [/^lname\(1\/x\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[0]"],
      [/^evalf\(-1,30\)$/, "-1.0"],
      [/^evalf\(1,30\)$/, "1.0"],
      [/^evalf\(0,30\)$/, "0.0"],
      [/^(limit|int)\(/, "GIAC_ERROR: Stopped by user interruption."],
    ];
    const giac = fakeGiac((t: string) => answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected");
    expect(refusalOf(giac, "int(1/x,x,-1,1)", "0")).toBe("unchecked");
  });
  it("more singular points in [a, b] than are checked leave the result unchecked, never ok", () => {
    // Nine poles, each one integrable as far as the checks go: before the fix only eight were looked at and the verdict
    // was null (the number shown with = or ≈); a dropped ninth pole could be the non-integrable one.
    const answers: [RegExp, string][] = [
      [/^lname\(g\(x\)\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[1,2,3,4,5,6,7,8,9]"],
      [/^evalf\((\d+),30\)$/, ""],
      [/^limit\(/, "0"],
      [/^int\(abs/, "1"],
    ];
    const giac = fakeGiac((t: string) => {
      const n = /^evalf\((\d+),30\)$/.exec(t);
      if (n) return `${n[1]}.0`;
      return answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected";
    });
    expect(refusalOf(giac, "int(g(x),x,0,10)", "3")).toBe("unchecked");
  });
});

describe.skipIf(!giacAvailable())("G39 on the real engine", () => {
  let host: EngineHost;
  let giac: EngineGiac;
  let bridge: GiacBridge;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    ({ bridge } = L);
    giac = engineGiac(L);
    host = new EngineHost(giac, bridge);
  });
  // A generous budget: these tests are about the checks, and a loaded test machine must not send ∫₋₁¹ 1/x to the float
  // path (the golden gate runs the same cases at the default budget, one at a time).
  // G46: typed text gets the parser's angle rule (sin(pasdeg*x)), as the keys' LaTeX would.
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(rewriteAngles(input), { ...defaultHomeSettings, angle, budgetMs: 5000 }).result;
  const cas = (input: string, angle: "rad" | "deg" = "rad") => host.cas(rewriteAngles(input), { ...defaultCasSettings, angle }).result;

  it.each([
    ["int(1/x,x,-1,1)", "integralDiverges"],
    ["int(1/(x-1),x,0,2)", "integralDiverges"],
    ["int(tan(x),x,0,pi)", "integralDiverges"],
    ["int(tan(2*x),x,0,pi)", "integralDiverges"],
    ["int(1/x^3,x,-1,1)", "integralDiverges"],
    ["int(1/(x-2)^3,x,0,3)", "integralDiverges"],
    ["3*int(1/x,x,-1,1)+1", "integralDiverges"],
    ["sum(cos(k),k,1,inf)", "seriesDiverges"],
    ["sum(sin(k),k,1,inf)", "seriesDiverges"],
    ["sum(exp(i*k),k,0,inf)", "seriesDiverges"],
    ["sum((-1)^k,k,0,inf)", "seriesDiverges"],
    ["limit(sin(x),x,inf)", "noLimit"],
  ])("Home and CAS refuse %s", (input, code) => {
    expect(home(input)).toMatchObject({ ok: false, error: code });
    expect(cas(input)).toMatchObject({ ok: false, error: code });
  });

  it("refuses in DEG too: the poles of tan at 90°, 1/x", () => {
    expect(home("int(tan(x),x,0,180)", "deg")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(home("int(1/x,x,-1,1)", "deg")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(home("int(tan(x),x,0,45)", "deg")).toMatchObject({ ok: true });
  });

  it("an assignment of a refused value stores nothing", () => {
    expect(home("g39a:=sum(cos(k),k,1,inf)")).toMatchObject({ ok: false, error: "seriesDiverges" });
    expect(home("g39a").display).toBe("g39a");
    expect(cas("g39b:=sum(cos(k),k,1,inf)")).toMatchObject({ ok: false, error: "seriesDiverges" });
    expect(cas("g39b").text).toBe("g39b");
    expect(cas("g39c:=int(1/x,x,-1,1)")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(cas("g39c").text).toBe("g39c");
    expect(cas("g39d:=sum(1/k^2,k,1,inf)")).toMatchObject({ ok: true });
    expect(cas("g39d").text).toBe("1/6*pi^2");
  });

  it("a trig integrand that is not periodic: every pole of the trig part in [a, b] is checked", () => {
    expect(home("int(tan(x)+x,x,2,5)")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(cas("int(tan(x)+x,x,2,5)")).toMatchObject({ ok: false, error: "integralDiverges" });
    // Giac answers undef here itself; had it given a number (7, say), singular() lists only ±π/2, outside [2, 5], and
    // before the fix the pole at 3π/2 was never looked at.
    expect(refusalOf(giac, "int(tan(x)+x,x,2,5)", "7")).toBe("integralDiverges");
    expect(refusalOf(giac, "int(x*tan(x),x,2,5)", "7")).toBe("integralDiverges");
    // A trig subterm without poles adds no shifts: sin(x)/x keeps its one point (and the sinc case its value).
    expect(refusalOf(giac, "int(sin(x)/x,x,-1,20)", "7")).toBeNull();
  });

  it.each([
    ["sum(1/k^2,k,1,inf)", "1.64493406685"],
    ["sum(cos(k)/k,k,1,inf)", "0.0420195058254"],
    ["sum((-1)^k/k,k,1,inf)", "-0.69314718056"],
    ["int(1/(2+cos(x)),x,0,2*pi)", "3.62759872847"],
    ["int(exp(-x^2),x,-inf,inf)", "1.77245385091"],
    ["int(1/sqrt(x),x,0,1)", "2"],
    ["int(sin(x)/x,x,0,inf)", "1.57079632679"],
    ["sum(1/k!,k,0,inf)", "2.71828182846"],
  ])("keeps %s = %s", (input, shown) => {
    expect(home(input)).toMatchObject({ ok: true, display: shown });
  });

  it("Home: Giac's pair is one value with no digit confirmed and the why-line, never a list", () => {
    const r = home("int(abs(x-sin(10^50)),x,-1,1)");
    expect(r.ok).toBe(true);
    expect(r.items).toBeUndefined();
    expect(r.facts.why).toEqual({ differ: true });
    expect(markOf(precisionFacts(r), { format: "STD", digits: 12 })).toMatchObject({ mark: "⚠", n: 0 });
    // G46: Giac runs in radians in DEG too, so its exact and numeric answers agree: pi/4 (source: oracle)
    const d = home("int(1/(1+x^2),x,0,1)", "deg");
    expect(d.items).toBeUndefined();
    expect(d.display).toBe("0.785398163397");
    expect(markOf(precisionFacts(d), { format: "STD", digits: 12 })).toMatchObject({ mark: "≈" });
  });

  it("CAS: Giac's pair is shown as Giac's text, both answers, with ⚠", () => {
    const r = cas("int(abs(x-sin(10^50)),x,-1,1)");
    expect(r).toMatchObject({ ok: true, approximate: true, facts: { warn: "unchecked", why: { differ: true } } });
    expect(r.numeric).toBeUndefined();
    expect(r.text).toMatch(/^\[.*,1\.35506364264\]$/);
  });
});
