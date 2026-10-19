// SPDX-License-Identifier: GPL-3.0-or-later
// G39: a number for something that does not exist is refused; Giac's [exact, numeric] pair is never a list.
// Expected refusals are derived (a pole inside the interval, a term that does not tend to 0); values are oracle cases
// of home.yaml (g39-keep-*).
import { beforeAll, describe, expect, it } from "vitest";
import { callsIn, giacPair, hasDefiniteIntegral, inRadians } from "./converge.ts";
import { EngineHost } from "./host.ts";
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
  it("rewrites a DEG text for radians", () => {
    expect(inRadians("tan(2*x)")).toBe("tan(pi/180*(2*x))");
    expect(inRadians("asin(sin(x))")).toBe("(180/pi*asin(sin(pi/180*(x))))");
    expect(inRadians("x*(pi/180)^angle_radian()")).toBe("x*1");
    expect(inRadians("1/x")).toBe("1/x");
  });
});

describe.skipIf(!giacAvailable())("G39 on the real engine", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(input, { ...defaultHomeSettings, angle }).result;
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
