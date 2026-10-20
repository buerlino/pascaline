// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51): no number through a division by zero, no Giac text for a lost answer. Expected refusals are
// derived (r16 F7, F8; decisions.md "F50, F51"); the kept values are home.yaml cases (g78-keep-*).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { rewriteAngles } from "../input/angles.ts";

describe.skipIf(!giacAvailable())("G78 on the real engine", () => {
  let host: EngineHost;
  let giac: GiacApi;
  beforeAll(async () => {
    giac = (await loadNodeGiac()).giac;
    host = new EngineHost(giac);
  });
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(rewriteAngles(input), { ...defaultHomeSettings, angle, budgetMs: 5000 }).result;

  it("refuses a value through a division by zero, in RAD and DEG", () => {
    for (const angle of ["rad", "deg"] as const)
      for (const input of ["1/(1/0)", "exp(ln(0))", "exp(ln(0*2))", "sqrt(5)/asinh(10)/(sin(factorial(5))*(3/0))", "[1/(1/0),2]", "1/0-1/0"])
        expect(home(input, angle), `${input} ${angle}`).toMatchObject({ ok: false, error: "divisionByZero", display: "Division by zero" });
  });
  it("refuses Giac's text, an overflow or undef where a number was asked for", () => {
    expect(home("sinh((6.02e3)^3)")).toMatchObject({ ok: false, error: "overflow" });
    for (const input of ["asin(acos(pi*pi))", "exp(cosh(asin(pi)))", "(asin(pi)^exp(10))*2.5"])
      expect(home(input), input).toMatchObject({ ok: false, error: "noValue", display: "No value found" });
    // At Home's own budget the exact path times out and the float path gives undef (with 5 s the exact path finds it).
    const r = host.home("sqrt(asinh(asin(3.7)))", defaultHomeSettings).result;
    expect(r).toMatchObject({ ok: false, error: "noValue", path: "float-timeout" });
  });
  it("refuses an infinite definite integral in Home; the CAS view keeps Giac's +infinity", () => {
    expect(home("int(1/x^2,x,-1,1)")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(host.cas("int(1/x^2,x,-1,1)", defaultCasSettings).result).toMatchObject({ ok: true, text: "+infinity" });
  });
  it("keeps an infinity typed as such, a branch not taken, a free name and 0/0", () => {
    expect(home("limit(1/x^2,x,0)")).toMatchObject({ ok: true, display: "+infinity" });
    expect(home("1/0")).toMatchObject({ ok: true, display: "infinity" });
    expect(home("int(exp(-x),x,0,inf)")).toMatchObject({ ok: true, display: "1" });
    expect(home("atan(inf)")).toMatchObject({ ok: true, display: "1.57079632679" });
    expect(home("piecewise(0>0,1/0,5)")).toMatchObject({ ok: true, display: "5" });
    expect(home("x+1/x")).toMatchObject({ ok: true });
    expect(home("0/0")).toMatchObject({ ok: true, display: "undef" });
    expect(home("sin(x)/x")).toMatchObject({ ok: true });
  });
});
