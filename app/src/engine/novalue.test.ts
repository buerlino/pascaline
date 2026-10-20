// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51): no number through a division by zero, no Giac text for a lost answer. Expected refusals are
// derived (r16 F7, F8; decisions.md "F50, F51"); the kept values are home.yaml cases (g78-keep-*).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { rewriteAngles } from "../input/angles.ts";
import { lostNumber, throughInfinity, underflow, zeroElements } from "./novalue.ts";

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
  it("refuses Giac's text with no free name even when its evalf is finite; a float result is never refused (F50, Opus pass 45)", () => {
    const never = () => false;
    try {
      // Giac keeps asin(acos(pi*pi)) as text of type expression: refused "noValue" (decisions.md "F50, F51").
      const text = giac.eval("pasT:=asin(acos(pi*pi))");
      expect(text.replace(/\s/g, "")).toBe("asin(acos(pi*pi))");
      expect(lostNumber(giac, "pasT", "asin(acos(pi*pi))", text, never, 1, never)).toBe("noValue");
      // Its evalf is undef in this Giac; with a finite evalf (a patched acos, our own MPFR route) it is refused all the
      // same: only an infinite evalf changes the reason, to "overflow".
      const finite = { eval: (t: string): string => (t.startsWith("evalf(") ? "1.5-0.5*i" : giac.eval(t)) };
      expect(lostNumber(finite, "pasT", "asin(acos(pi*pi))", text, never, 1, never)).toBe("noValue");
      // Guard: a float result whose check failed (Giac's float, of type real or complex, not expression) is not refused.
      for (const f of ["evalf(asin(3.7))", "evalf(sin(10^50))"]) {
        const out = giac.eval(`pasF:=${f}`);
        expect(giac.eval("type(pasF)").trim(), f).not.toBe("expression");
        expect(lostNumber(finite, "pasF", f, out, never, 1, never), f).toBeNull();
      }
    } finally {
      giac.eval("purge(pasT)");
      giac.eval("purge(pasF)");
    }
  });
  it("refuses an underflow with its reason, in RAD and DEG, a list and a matrix too (G84, F60)", () => {
    // mpmath: exp(-10^30) = 10^(-4.34E29); exp(cosh(asin(π)·180/π)) has |exp| = 10^(-2.63E38) (home.yaml g84-*).
    for (const input of ["exp(-10^30)", "exp(-10^400)", "[exp(-10^30),1]", "[[1,exp(-10^30)],[2,3]]"])
      expect(home(input), input).toMatchObject({ ok: false, error: "underflow", display: "Underflow: the number is too small" });
    for (const digits of [12, 30]) {
      const r = host.home(rewriteAngles("exp(cosh(asin(pi)))"), { ...defaultHomeSettings, angle: "deg", digits, workDigits: Math.max(30, digits + 10) }).result;
      expect(r, `deg ${digits}`).toMatchObject({ ok: false, error: "underflow" });
    }
    // Guards: MPFR holds exp(-1000); an exact 0; a 0 Giac cannot prove reads as noise, not as MPFR's 0, and stays ⚠ 0.
    expect(home("exp(-1000)")).toMatchObject({ ok: true, display: "5.07595889755E-435" });
    for (const input of ["sin(pi)", "0*exp(-10^30)"]) expect(home(input), input).toMatchObject({ ok: true, display: "0", exactRational: true });
    expect(home("exp(-10^30)*exp(10^30)")).toMatchObject({ ok: true, display: "1" });
    expect(home("cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2")).toMatchObject({ ok: true, display: "0", warn: "unchecked" });
  });
  it("decides an underflow on Giac's exact answer: an element Giac's simplify proves 0 is no underflow (G84)", () => {
    try {
      // ln(2)+ln(3)-ln(6) evaluates to MPFR's exact 0 at 40 digits, and is 0: simplify proves it.
      giac.eval("pasU:=[ln(2)+ln(3)-ln(6),exp(-10^30)]");
      const zero = { re: { neg: false, digits: "", exp: 0, sticky: false }, im: { neg: false, digits: "", exp: 0, sticky: false } };
      const facts = [0, 1].map(() => ({ value: zero, exactRational: false, reliableDigits: 40, big: false }));
      expect(zeroElements("pasU", facts, { kind: "list", n: 2 })).toEqual(["pasU[0]", "pasU[1]"]);
      expect(underflow(giac, ["pasU[0]"], 40)).toBe(false);
      expect(underflow(giac, ["pasU[1]"], 40)).toBe(true);
      expect(underflow(giac, ["pasU[0]"], null)).toBe(false);
      // An exact rational element is never looked at.
      expect(zeroElements("pasU", [{ ...facts[0]!, exactRational: true }], { kind: "scalar" })).toEqual([]);
    } finally {
      giac.eval("purge(pasU)");
    }
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
  it("never runs a part again that changes state: an assignment, =<, a program, rand (audit, fix round 2)", () => {
    const none = (): boolean => false;
    giac.eval("purge(n);n:=1");
    expect(throughInfinity(giac, "1/(n:=n+1)", "1/2", none, 0, none)).toBe(false);
    expect(giac.eval("n")).toBe("1");
    giac.eval("purge(cnt);cnt:=0;bump():={cnt:=cnt+1;return 1;}");
    expect(throughInfinity(giac, "1/(bump()+1)", "1/2", none, 0, (f) => f === "bump")).toBe(false);
    expect(giac.eval("cnt")).toBe("0");
    giac.eval("srand(7)");
    const first = giac.eval("rand()");
    giac.eval("srand(7)");
    throughInfinity(giac, "1/(rand()+2)", "0.4", none, 0, none);
    expect(giac.eval("rand()")).toBe(first);
    // Through Home: the input runs once, so the name holds what one run stored.
    for (const [set, run, name] of [["n:=1", "1/(n:=n+1)", "n"], ["m:=1", "1/(m=<m+1)", "m"]] as const) {
      home(set);
      home(run);
      expect(giac.eval(name), run).toBe("2");
    }
    giac.eval("purge(n,m,cnt,bump)");
  });
  it("evaluates only the parts that can make an infinity, and none when they would take too long (timing case)", () => {
    const seen: string[] = [];
    const counting = { eval: (t: string): string => (seen.push(t), giac.eval(t)) };
    // At Home's exact time for factorial(10^6) (about 1 s, it ignores the interrupt) nothing is evaluated again.
    expect(throughInfinity(counting, "ln(ln(factorial(10^6)))", "ln(ln(x))", () => false, 1000, () => false)).toBe(false);
    expect(seen.filter((t) => t.includes("eval("))).toEqual([]);
    // A cheap input: the source parts only (the inner ln, the factorial), each once; the whole input is not evaluated.
    seen.length = 0;
    expect(throughInfinity(counting, "exp(ln(ln(factorial(3))))+sin(2)", "1", () => false, 1, () => false)).toBe(false);
    expect(seen.filter((t) => t.includes("eval(")).length).toBe(3);
    const t0 = performance.now();
    const r = host.home("ln(ln(factorial(10^6)))", defaultHomeSettings).result;
    // Shown, or refused for time under a loaded machine (G58), never refused as a division by zero.
    expect(r.ok || r.error === "timeout", r.display).toBe(true);
    // Before the fix the walk evaluated factorial(10^6) twice more after Home's own run (about 2 s more).
    expect(performance.now() - t0 - r.exactMs).toBeLessThan(700);
  });
});
