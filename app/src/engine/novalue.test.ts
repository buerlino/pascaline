// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51): no number through a division by zero, no Giac text for a lost answer. Expected refusals are
// derived (r16 F7, F8; decisions.md "F50, F51"); the kept values are home.yaml cases (g78-keep-*).
import { engineGiac, type EngineGiac } from "./nodeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import type { GiacBridge } from "./bridge.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { rewriteAngles } from "./angles.ts";
import type { Giac } from "./numeric.ts";
import { approxRange, lostNumber, overflowAt, throughInfinity, underflow, zeroElements } from "./novalue.ts";

describe.skipIf(!giacAvailable())("G78 on the real engine", () => {
  let host: EngineHost;
  let giac: EngineGiac;
  let bridge: GiacBridge;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    ({ bridge } = L);
    giac = engineGiac(L);
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(rewriteAngles(input, "typed"), { ...defaultHomeSettings, angle, budgetSteps: 20 * defaultHomeSettings.budgetSteps }).result;

  it("refuses a value through a division by zero, in RAD and DEG", () => {
    for (const angle of ["rad", "deg"] as const)
      for (const input of ["1/(1/0)", "exp(ln(0))", "exp(ln(0*2))", "sqrt(5)/asinh(10)/(sin(factorial(5))*(3/0))", "[1/(1/0),2]", "1/0-1/0"])
        expect(home(input, angle), `${input} ${angle}`).toMatchObject({ ok: false, error: "divisionByZero", display: "Division by zero" });
  });
  it("refuses Giac's text, an overflow or undef where a number was asked for", () => {
    expect(home("sinh((6.02e3)^3)")).toMatchObject({ ok: false, error: "overflow" });
    // max and min of a non-real value: Giac keeps the text (asin(acos(pi*pi)) and the like were here until patch 0005,
    // G60, gave asin and acos of an MPFR real outside [-1,1] their values).
    for (const input of ["max(asin(pi),1)", "min(2*i,1)", "max(sqrt(-2),1)"])
      expect(home(input), input).toMatchObject({ ok: false, error: "noValue", display: "No value found" });
    // At Home's own budget the exact path times out; the float path has the value since patch 0005 (mpmath
    // 1.312341649951242985…-0.328386275332011804…*i; it gave undef before).
    const r = host.home("sqrt(asinh(asin(3.7)))", defaultHomeSettings).result;
    expect(r).toMatchObject({ ok: true, display: "1.31234164995-0.328386275332*i", path: "float-timeout" });
  });
  it("refuses Giac's text with no free name even when its evalf is finite; a float result is never refused (F50, Opus pass 45)", () => {
    const never = () => false;
    try {
      // Giac keeps asin(acos(pi*pi)) as text of type expression: refused "noValue" (decisions.md "F50, F51").
      const text = giac.eval("pasT:=asin(acos(pi*pi))");
      expect(text.replace(/\s/g, "")).toBe("asin(acos(pi*pi))");
      expect(lostNumber(giac, "pasT", "asin(acos(pi*pi))", text, never, 1, never)).toBe("noValue");
      // Its evalf is finite since patch 0005 (G60), and the stand-in below keeps it so: as text it is refused all the
      // same; only an infinite evalf changes the reason, to "overflow".
      const finite = { ...giac, eval: (t: string): string => (t.startsWith("evalf(") ? "1.5-0.5*i" : giac.eval(t)) };
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
      const r = host.home(rewriteAngles("exp(cosh(asin(pi)))", "typed"), { ...defaultHomeSettings, angle: "deg", digits, workDigits: Math.max(30, digits + 10) }).result;
      expect(r, `deg ${digits}`).toMatchObject({ ok: false, error: "underflow" });
    }
    // Guards: MPFR holds exp(-1000); an exact 0; a 0 Giac cannot prove reads as noise, not as MPFR's 0, and stays ⚠ 0.
    expect(home("exp(-1000)")).toMatchObject({ ok: true, display: "5.07595889755E-435" });
    for (const input of ["sin(pi)", "0*exp(-10^30)"]) expect(home(input), input).toMatchObject({ ok: true, display: "0", facts: { exact: true } });
    expect(home("exp(-10^30)*exp(10^30)")).toMatchObject({ ok: true, display: "1" });
    expect(home("cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2")).toMatchObject({ ok: true, display: "0", facts: { warn: "unchecked" } });
    // G154 (F139): asin(i*y) and asinh(i*y), |y| <= 1, are purely imaginary, so these real parts are exactly 0; since patch
    // 0023 Giac gives MPFR's 0 for them at every precision and normal does not prove it. Giac states no size for them, so
    // they are an exact 0 Giac cannot prove (⚠ 0), not an underflow.
    for (const input of ["re(asin(i/10))", "re(asinh(i/5))", "re(asin(i))"])
      for (const digits of [12, 30])
        expect(host.home(input, { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) }).result, `${input} ${digits}`).toMatchObject({ ok: true, display: "0", facts: { warn: "unchecked" } });
    // G126: exp(10^-70)-1 is 0 at P and P+20, its value 1.0000…E-70 (derived: x+x^2/2+…) from P+40 on, so the steps go on.
    expect(home("exp(10^-70)-1")).toMatchObject({ ok: true, display: "1E-70", facts: { exact: false, reliableDigits: 40 } });
    expect(home("exp(10^-70)-1").facts).not.toHaveProperty("warn");
  });
  it("decides an underflow on Giac's exact answer: an element Giac's simplify proves 0 is no underflow (G84)", () => {
    try {
      // ln(2)+ln(3)-ln(6) is 0 and evaluates to MPFR's exact 0 at 40 digits, but has noise at 1000; exp(10^-70)-1 is
      // 1E-70 (a cancellation, 0 at 40 digits); exp(-10^30) is 0 at any precision.
      giac.eval("pasU:=[ln(2)+ln(3)-ln(6),exp(-10^30),exp(10^-70)-1,0,re(asin(i/10)),exp(-10^30)*sin(1)]");
      const zero = { re: { neg: false, digits: "", exp: 0, sticky: false }, im: { neg: false, digits: "", exp: 0, sticky: false } };
      const facts = [0, 1].map(() => ({ value: zero, exact: false, reliableDigits: 40, big: false }));
      expect(zeroElements("pasU", facts, { kind: "list", n: 2 })).toEqual(["pasU[0]", "pasU[1]"]);
      expect(underflow(giac, ["pasU[0]"], 40)).toBe(false);
      expect(underflow(giac, ["pasU[1]"], 40)).toBe(true);
      expect(underflow(giac, ["pasU[2]"], 40)).toBe(false);
      // G154: MPFR's 0 at every precision with no size Giac can state is an exact 0 it cannot prove; exp(-10^30)*sin(1)
      // has one (-10^30+ln(sin(1)), through lnexpand).
      expect(underflow(giac, ["pasU[4]"], 40)).toBe(false);
      expect(underflow(giac, ["pasU[5]"], 40)).toBe(true);
      // A double's 0: Giac's exact 0 is no underflow, exp(-10^30) is.
      expect(underflow(giac, ["pasU[3]"], null)).toBe(false);
      expect(underflow(giac, ["pasU[1]"], null)).toBe(true);
      // An exact rational element is never looked at.
      expect(zeroElements("pasU", [{ ...facts[0]!, exact: true }], { kind: "scalar" })).toEqual([]);
    } finally {
      giac.eval("purge(pasU)");
    }
  });
  it("refuses an overflow MPFR finds where a double finds a finite number (G123, F123)", () => {
    // About 10^(4.34294481903E34) (mpmath); the double's ln(a/b) cancels to 0, so it showed ⚠ 1.
    for (const digits of [12, 30])
      expect(host.home("1.000000000000001^(10^50)", { ...defaultHomeSettings, digits }).result, `${digits}`).toMatchObject({ ok: false, error: "overflow" });
    giac.eval("pasov:=exp(10^50*ln(1000000000000001/1000000000000000))");
    expect(overflowAt(giac, "pasov", giac.eval("pasov"), 40)).toBe(true);
    // G123f2: a complex overflow (Giac's +infinity*i) is one too, at 12 and 30 digits through Home (2+i*… was refused
    // on phase-1 already, by another path: a guard); overflowAt takes an infinite part.
    for (const input of ["i*1.000000000000001^(10^50)", "2+i*1.000000000000001^(10^50)"])
      for (const digits of [12, 30])
        expect(host.home(input, { ...defaultHomeSettings, digits }).result, `${input} ${digits}`).toMatchObject({ ok: false, error: "overflow" });
    giac.eval("pasov:=2+i*exp(10^50*ln(1000000000000001/1000000000000000))");
    expect(overflowAt(giac, "pasov", giac.eval("pasov"), 40)).toBe(true);
    giac.eval("pasov:=exp(10^15*ln(1000000000000001/1000000000000000))");
    expect(overflowAt(giac, "pasov", giac.eval("pasov"), 40)).toBe(false);
    // An infinity the answer is (a limit) is no overflow.
    expect(overflowAt(giac, "infinity", "+infinity", 40)).toBe(false);
    // A geometry object is no number: asked without drawing it (an evalf of it alone threw "window is not defined").
    for (const g of ["point(1,0.5)", "segment(i,1+i)", "LineHorz(-1)"]) {
      expect(host.home(g, defaultHomeSettings).result.error, g).not.toBe("engine");
      giac.eval(`pasov:=${g};1`);
      expect(() => overflowAt(giac, "pasov", "pnt", 40), g).not.toThrow();
    }
    giac.eval("purge(pasov);1");
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
    const counting = { ...giac, eval: (t: string): string => (seen.push(t), giac.eval(t)) };
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
  }, 30_000); // factorial(10^6) is one GMP call of about 1 s that ignores the interrupt; with 87 test files in parallel it took 6 s (run 150), so the overhead check above decides, not vitest's 5 s
});

// G148 (step 4), G148f1: the rule asks the engine nothing for an output with no infinity that does not read as 0, inside
// a larger input too, nor for an input with no approx or evalf or with a typed infinity.
describe("G148 approxRange's cost", () => {
  const counting = (): { giac: Giac; calls: () => number } => {
    let n = 0;
    const giac: Giac = {
      eval: () => (n++, "0"),
      value: () => (n++, { kind: "error", text: "GIAC_ERROR: not run" }),
    };
    return { giac, calls: () => n };
  };
  const ask = (input: string, output: string): number => {
    const { giac, calls } = counting();
    expect(approxRange(giac, input, output, 40, () => false, () => false), `${input} -> ${output}`).toBeNull();
    return calls();
  };
  it("asks nothing for an ordinary output, a limit or a typed inf", () => {
    expect(ask("approx(1/3)", "0.3333333333333333333333333333333333333333")).toBe(0);
    expect(ask("approx(exp(1000))", "0.1970071114017046993888879352243323125316e435")).toBe(0);
    expect(ask("limit(1/x^2,x,0)", "+infinity")).toBe(0);
    expect(ask("approx(inf)", "+infinity")).toBe(0);
    // G148f1: an approx or evalf inside a larger input whose output is neither infinite nor 0.
    expect(ask("1/approx(exp(1))", "0.3678794411714423215955237701614608674458")).toBe(0);
    expect(ask("2*approx(1/4)", "0.5")).toBe(0);
    expect(ask("evalf(10^20)+1", "0.1000000000000000000010000000000000000000e21")).toBe(0);
    expect(ask("sin(pi)", "0")).toBe(0);
    // G148f2: an output that is neither infinite, undef nor 0 asks nothing, a text that only holds undef included.
    expect(ask("approx(exp(-10^20))*x", "0.0*x")).toBe(0);
    expect(ask("approx(1/3)+x", "x+0.3333333333333333333333333333333333333333")).toBe(0);
    expect(ask("[approx(1/3),undef]", "[0.3333333333333333333333333333333333333333,undef]")).toBe(0);
    expect(ask("approx(inf)-approx(inf)", "undef")).toBe(0);
  });
});

// G148f2: an infinite output whose bare input is finite asks each call's argument underflow too (ln(approx(exp(-10^20)))),
// and an undef output is asked as an infinite one; a bare input that is undef or infinite keeps its answer.
describe.skipIf(!giacAvailable())("G148f2 approxRange on the real engine", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  const range = (input: string): string | null => {
    const out = giac.eval(input).trim();
    return approxRange(giac, input, out, 40, () => false, () => false);
  };
  it("refuses an infinity or undef that approx made from a finite value", () => {
    expect(range("ln(approx(exp(-10^20)))")).toBe("underflow");
    expect(range("ln(approx(exp(-10^20)))/ln(10)")).toBe("underflow");
    expect(range("approx(exp(-10^20))*exp(10^20)")).toBe("underflow");
    expect(range("approx(exp(10^20))/exp(10^20)")).toBe("overflow");
  });
  it("keeps the answer of a bare input that is undef or infinite, or exactly 0", () => {
    for (const input of ["1/approx(0)", "approx(1/0)", "approx(0)/0", "ln(approx(0))", "2*approx(0)", "approx(sin(pi))", "approx(limit(1/x^2,x,0))"])
      expect(range(input), input).toBeNull();
  });
});
