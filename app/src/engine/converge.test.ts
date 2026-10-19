// SPDX-License-Identifier: GPL-3.0-or-later
// G39: a number for something that does not exist is refused; Giac's [exact, numeric] pair is never a list.
// Expected refusals are derived (a pole inside the interval, a term that does not tend to 0); values are oracle cases
// of home.yaml (g39-keep-*).
import { beforeAll, describe, expect, it } from "vitest";
import { callsIn, giacPair, hasDefiniteIntegral, inRadians, refusalOf } from "./converge.ts";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

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
    const giac = { eval: (t: string) => answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected" };
    expect(refusalOf(giac, "int(1/x,x,-1,1)", "0", "rad")).toBe("unchecked");
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
    const giac = {
      eval: (t: string) => {
        const n = /^evalf\((\d+),30\)$/.exec(t);
        if (n) return `${n[1]}.0`;
        return answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected";
      },
    };
    expect(refusalOf(giac, "int(g(x),x,0,10)", "3", "rad")).toBe("unchecked");
  });
  it("rewrites a DEG text for radians", () => {
    expect(inRadians("tan(2*x)")).toBe("tan(pi/180*(2*x))");
    expect(inRadians("asin(sin(x))")).toBe("(180/pi*asin(sin(pi/180*(x))))");
    expect(inRadians("x*(pi/180)^angle_radian()")).toBe("x*1");
    expect(inRadians("1/x")).toBe("1/x");
  });
});

describe.skipIf(!giacAvailable())("G39 on the real engine", () => {
  let host: EngineHost;
  let giac: GiacApi;
  beforeAll(async () => {
    giac = (await loadNodeGiac()).giac;
    host = new EngineHost(giac);
  });
  // A generous budget: these tests are about the checks, and a loaded test machine must not send ∫₋₁¹ 1/x to the float
  // path (the golden gate runs the same cases at the default budget, one at a time).
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(input, { ...defaultHomeSettings, angle, budgetMs: 5000 }).result;
  const cas = (input: string, angle: "rad" | "deg" = "rad") => host.cas(input, { ...defaultCasSettings, angle }).result;

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
    expect(refusalOf(giac, "int(tan(x)+x,x,2,5)", "7", "rad")).toBe("integralDiverges");
    expect(refusalOf(giac, "int(x*tan(x),x,2,5)", "7", "rad")).toBe("integralDiverges");
    // A trig subterm without poles adds no shifts: sin(x)/x keeps its one point (and the sinc case its value).
    expect(refusalOf(giac, "int(sin(x)/x,x,-1,20)", "7", "rad")).toBeNull();
  });

  it.each([
    ["int(1/x^2,x,-1,1)", "+infinity"],
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
    expect(r.why).toEqual({ differ: true });
    expect(markOf(r, { format: "STD", digits: 12 })).toMatchObject({ mark: "⚠", n: 0 });
    const d = home("int(1/(1+x^2),x,0,1)", "deg");
    expect(d.items).toBeUndefined();
    expect(markOf(d, { format: "STD", digits: 12 })).toMatchObject({ mark: "⚠", n: 0 });
  });

  it("CAS: Giac's pair is shown as Giac's text, both answers, with ⚠", () => {
    const r = cas("int(abs(x-sin(10^50)),x,-1,1)");
    expect(r).toMatchObject({ ok: true, approximate: true, warn: "unchecked", why: { differ: true } });
    expect(r.numeric).toBeUndefined();
    expect(r.text).toMatch(/^\[.*,1\.35506364264\]$/);
  });
});
