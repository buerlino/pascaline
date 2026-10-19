// SPDX-License-Identifier: GPL-3.0-or-later
// Honest precision against the real Giac build (docs/04 sections 2.4–2.10, G2): the facts the engine reports, and the
// mark the formatter derives from them. Expected values are derived (exact arithmetic) or come from the oracle
// (tests/golden/.venv, mpmath at 60 digits), as each case says. Skipped when no engine build is found (nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, type HomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf, type MarkInfo } from "./format.ts";
import { MAX_EVAL_DIGITS } from "./numeric.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("honest precision (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const home = (input: string, digits = 12) => host.home(input, { ...defaultHomeSettings, digits } satisfies HomeSettings).result;
  const mark = (input: string, digits = 12): MarkInfo | null => markOf(home(input, digits), { format: "STD", digits });

  it("G23: sin(10^100) is confirmed at P+80, sin(10^2000) shows no digit and its escalation is bounded (oracle: mpmath at 150 digits)", async () => {
    // oracle: sin(10^100) = -0.37237612366127668826… (mpmath, 150 digits); Giac's 40- and 60-digit values are wrong.
    const r = home("sin(10^100)");
    expect(r.display).toBe("-0.372376123661");
    expect(r.reliableDigits).toBeGreaterThanOrEqual(12);
    // Deterministic cost bound: no evalf asks for more than MAX_EVAL_DIGITS digits (the 50 ms figure is the serial
    // probe tools/probes/digits-cost.ts; a wall-clock assertion fails under the parallel test run).
    const { giac } = await loadNodeGiac();
    const precs: number[] = [];
    const counted = new Proxy(giac, {
      get(target, key) {
        const v = Reflect.get(target, key) as unknown;
        if (key !== "eval" || typeof v !== "function") return v;
        return (code: string): string => {
          const m = /^evalf\(.*,(\d+)\)$/s.exec(code);
          if (m) precs.push(Number(m[1]));
          return (v as (c: string) => string).call(target, code);
        };
      },
    });
    const hard = new EngineHost(counted).home("sin(10^2000)", defaultHomeSettings).result;
    expect(hard.reliableDigits).toBe(0);
    expect(markOf(hard, { format: "STD", digits: 12 })).toMatchObject({ mark: "⚠", n: 0 });
    expect(precs.length).toBeGreaterThan(2);
    expect(Math.max(...precs)).toBeLessThanOrEqual(MAX_EVAL_DIGITS);
  });

  it("1/4 is = and 1/3 is ≈ (derived; docs/04 2.3 #9)", () => {
    expect(home("1/4")).toMatchObject({ display: "0.25", exactRational: true, reliableDigits: null, full: "1/4" });
    expect(mark("1/4")).toEqual({ mark: "=" });
    expect(home("1/3")).toMatchObject({ display: "0.333333333333", exactRational: true, full: "1/3" });
    expect(mark("1/3")).toEqual({ mark: "≈" });
  });

  it("an irrational value is confirmed by the agreement check to at least 30 digits (derived)", () => {
    const r = home("sqrt(2)", 30);
    expect(r.exactRational).toBe(false);
    expect(r.reliableDigits).toBeGreaterThanOrEqual(30);
    expect(r.full).toBe("sqrt(2)");
    expect(mark("sqrt(2)", 30)).toEqual({ mark: "≈" });
  });

  it("UTPN(10) at 30 digits: the cancellation is caught and one more precision step confirms all 30 (oracle)", () => {
    // oracle: erfc(10/sqrt(2))/2 = 7.61985302416052606597334325159930836…E-24 (mpmath, 60 digits)
    expect(home("UTPN(10)", 30).display).toBe("7.6198530241605260659733432516E-24");
    expect(mark("UTPN(10)", 30)).toEqual({ mark: "≈" });
  });

  it("a float from an un-audited routine is ⚠ and shows only the digits double and MPFR agree on (oracle)", () => {
    // oracle: sqrt(pi)/2*erf(1) = 0.746824132812427025399467436131… ; Giac's double romberg is off at the 13th digit
    const r = home("romberg(exp(-x^2),x,0,1)", 30);
    expect(r.warn).toBe("unaudited");
    expect(r.reliableDigits).toBe(11);
    expect(r.display).toBe("0.74682413281");
    expect(markOf(r, { format: "STD", digits: 30 })).toEqual({ mark: "⚠", n: 11, warn: "unaudited" });
  });

  it("SB4: in [romberg(…),1/3] each element carries its own mark; the list's is the weakest (derived; oracle)", () => {
    const r = home("[romberg(exp(-x^2),x,0,1),1/3]");
    const o = { format: "STD" as const, digits: 12 };
    expect(r.items).toHaveLength(2);
    expect(markOf(r.items![0]!, o)).toEqual({ mark: "⚠", n: 11, warn: "unaudited" }); // oracle sqrt(pi)/2*erf(1), as above
    expect(r.items![1]).toMatchObject({ exactRational: true, reliableDigits: null }); // derived: 1/3 is exact
    expect(r.items![1]!.warn).toBeUndefined();
    expect(markOf(r.items![1]!, o)).toEqual({ mark: "≈" }); // derived: 1/3 shown as 0.333333333333 is rounded
    expect(markOf(r, o)).toEqual({ mark: "⚠", n: 11, warn: "unaudited" });
    expect(r.display).toBe("[0.74682413281,0.333333333333]");
  });

  it("BesselJ at 30 digits falls back to a double instead of losing the answer (oracle; docs/04 2.3 #5)", () => {
    // oracle: besselj(1,2) = 0.576724807756873387202448242269…
    const r = home("BesselJ(1,2)", 30);
    expect(r.display).toBe("0.57672480775687");
    expect(markOf(r, { format: "STD", digits: 30 })).toMatchObject({ mark: "⚠", n: 14 });
  });

  it("an exact value Giac keeps unsimplified is proved rational: 8^(1/3) is = 2 (derived)", () => {
    expect(home("8^(1/3)")).toMatchObject({ display: "2", exactRational: true, full: "2" });
    expect(mark("8^(1/3)")).toEqual({ mark: "=" });
  });

  it("lists and matrices are formatted by our formatter, element by element (derived)", () => {
    const l = home("[1/3,2]");
    expect(l.display).toBe("[0.333333333333,2]");
    expect(l.items?.map((x) => x.display)).toEqual(["0.333333333333", "2"]);
    expect(l.shape).toBeUndefined();
    expect(l.full).toBe("[1/3,2]");
    const m = home("[[1,2],[3,4]]^-1");
    expect(m.display).toBe("[[-2,1],[1.5,-0.5]]");
    expect(m.shape).toEqual([2, 2]);
    expect(markOf(m, { format: "STD", digits: 12 })).toEqual({ mark: "=" });
    const s = home("solve(x^2=2,x)");
    expect(s.display).toBe("[-1.41421356237,1.41421356237]");
    expect(markOf(s, { format: "STD", digits: 12 })).toEqual({ mark: "≈" });
  });

  it("defined names what a stateful input defined (docs/04 3.4)", () => {
    expect(home("Gtest:=5").defined).toEqual({ name: "Gtest", kind: "var" });
    expect(home("gfn(x):=x^2").defined).toEqual({ name: "gfn", kind: "fn" });
    expect(home("gfn(3)").defined).toBeUndefined();
  });

  it("an assignment whose value is checked twice is stored once: A:=A*2 doubles A once (derived)", () => {
    home("Gd:=evalf(sqrt(2))");
    home("Gd:=Gd*2");
    expect(home("Gd").display).toBe("2.82842712475");
  });

  it("sigfig rounds the exact value, half away from zero, to an exact decimal (derived; docs/04 2.5)", () => {
    expect(home("sigfig(1/3,3)")).toMatchObject({ display: "0.333", exactRational: true });
    expect(mark("sigfig(1/3,3)")).toEqual({ mark: "=" });
    expect(home("sigfig(999.95,4)").display).toBe("1000");
    expect(home("sigfig(999.94,4)").display).toBe("999.9");
    expect(home("sigfig(0.0012345,3)").display).toBe("0.00123");
    expect(home("sigfig(-0.125,2)").display).toBe("-0.13");
    expect(home("sigfig(0.125,2)").display).toBe("0.13");
    expect(home("sigfig(1/3,0)").ok).toBe(false);
  });

  it("sigfig is defined on first use, not at engine start (start-up budget)", async () => {
    const { giac } = await loadNodeGiac();
    const fresh = new EngineHost(giac);
    expect(giac.eval("sigfig(1/3,3)")).toBe("sigfig(1/3,3)");
    expect(fresh.home("sigfig(1/3,3)", defaultHomeSettings).result.display).toBe("0.333");
  });

  it("CAS: typed decimals are exact (P9), and a float result is checked and formatted by us (oracle)", () => {
    const cas = (input: string) => host.cas(input, defaultCasSettings).result;
    expect(cas("1-0.9-0.1").text).toBe("0");
    expect(cas("1.5*x").text).toBe("3/2*x");
    // oracle: sin(10^22) = -0.852200849767188801772705893753…
    const r = cas("evalf(sin(10^22))");
    expect(r.text).toBe("-0.852200849767");
    expect(r.numeric && markOf(r.numeric, { format: "STD", digits: 12 })).toEqual({ mark: "≈" });
    expect(cas("1/3").numeric).toBeUndefined();
  });
});

describe("G38: which inputs get a second decision (pure)", () => {
  it("decision functions, comparisons and abs( in the result; rationals only decide exactly", async () => {
    const { restsOnDecision, rationalOnly } = await import("./numeric.ts");
    expect(restsOnDecision("floor(sin(10^50)*10^12)", "609741545567")).toBe(true);
    expect(restsOnDecision("sin(10^50)>0", "true")).toBe(true);
    expect(restsOnDecision("sqrt(x^2)", "abs(x)")).toBe(true);
    expect(restsOnDecision("sin(1)", "sin(1)")).toBe(false);
    expect(restsOnDecision("f:=x->x+1", "")).toBe(false); // the arrow is no comparison
    expect(restsOnDecision("f(sin(10^60))", "933879932404", (n) => n === "f")).toBe(true); // a stored function
    expect(restsOnDecision("sin(1)", "sin(1)", (n) => n === "f")).toBe(false);
    expect(rationalOnly("sum(1/k,k,1,1000)")).toBe(true);
    expect(rationalOnly("sum(1/k^2,k,1,inf)")).toBe(false);
    expect(rationalOnly("floor(2^(1/2))")).toBe(false);
    expect(rationalOnly("floor(x)")).toBe(false);
  });

  it("the cuts: floor and sign calls with their span, one comparison per segment", async () => {
    const { decisionCuts } = await import("./numeric.ts");
    expect(decisionCuts("floor(a+1)*2")).toEqual([{ q: "a+1", kind: "int", call: { name: "floor", at: [0, 10] } }]);
    expect(decisionCuts("piecewise(s>0,1,2)")).toEqual([{ q: "(s)-(0)", kind: "zero" }]);
    expect(decisionCuts("a<b and c<d")).toEqual([]); // two comparisons: left to the text check
  });
});

describe.skipIf(!giacAvailable())("G38: the exact path decides at P and at P + 20 (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });

  it("floor(sin(10^60)*10^12): wrong at 40 digits, P + 20 and P + 40 agree on 830389765219 (source: oracle, mpmath at 200 digits)", () => {
    const r = host.home("floor(sin(10^60)*10^12)", defaultHomeSettings).result;
    expect(r).toMatchObject({ display: "830389765219", exactRational: true });
    expect(r.why).toBeUndefined();
    expect(host.home("pasans", defaultHomeSettings).result.display).toBe("830389765219"); // Ans holds the agreed value
  });

  it("an unproven tie is undecided, never replaced: floor(…+1/2-10^-100) is 0, not = 1 (source: derived; Giac gives 0 at 40 and 60, 1 at 80)", () => {
    for (const input of ["floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2-10^-100)", "floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)"]) {
      const r = host.home(input, defaultHomeSettings).result;
      expect(r.display).not.toBe("1");
      expect(r).toMatchObject({ exactRational: false, reliableDigits: null, why: { decided: true } });
      expect(markOf(r, { format: "STD", digits: 12 })?.mark).toBe("⚠");
      const c = host.cas(input, defaultCasSettings).result;
      expect(c.text).not.toBe("1");
      expect(c.approximate).toBe(true);
      expect(c.warn).toBe("unchecked");
    }
  });

  it("P + 20 and P + 40 disagree: floor(sin(10^100)*10^12) is ⚠ without a count (source: oracle, mpmath at 300 digits: -372376123662)", () => {
    const r = host.home("floor(sin(10^100)*10^12)", defaultHomeSettings).result;
    expect(r).toMatchObject({ exactRational: false, reliableDigits: null, approximate: true, why: { decided: true } });
    expect(markOf(r, { format: "STD", digits: 12 })).toEqual({ mark: "⚠", warn: "unchecked" }); // no count n
    const c = host.cas("floor(sin(10^100)*10^12)", defaultCasSettings).result;
    expect(c).toMatchObject({ approximate: true, warn: "unchecked", why: { decided: true } });
  });

  it("an exact == test is decided again too: floor(sin(10^60)*10^12)==830389765219 is true (source: oracle via g38-floor-sin1e60)", () => {
    const input = "((a_,b_)->((d_)->{if(string(exact(d_))!=string(d_)){sto(1,pasinexact);sto(d_,pasdiff)};when(string(exact(d_))!=string(d_),when(pasverdict==0,true,when(pasverdict==1,false,'a_==b_')),when(simplify(d_)==0*d_,true,when(lname(d_)==[] and (type(d_)==integer or type(d_)==rational or max(abs(evalf(d_,30)))>10^-20*max(max(abs(evalf(a_,30))),max(abs(evalf(b_,30))))),false,'a_==b_')))})(a_-b_))(floor(sin(10^60)*10^12),830389765219)";
    expect(host.home(input, defaultHomeSettings).result.display).toBe("true");
    expect(host.cas(input, defaultCasSettings).result.text).toBe("true");
  });

  it("a stored function's body decides too: f(x):=floor(x*10^12) then f(sin(10^60)) is 830389765219 (source: oracle, mpmath at 200 digits)", () => {
    for (const run of [(i: string) => host.home(i, defaultHomeSettings).result.display, (i: string) => host.cas(i, defaultCasSettings).result.text]) {
      run("f(x):=floor(x*10^12)");
      expect(run("f(sin(10^60))")).toBe("830389765219"); // was 933879932404 at P = 40
      host.home("purge(f)", defaultHomeSettings);
    }
  });

  it("a float in a non-number keeps the P decision: piecewise(sin(10^50)>0,x,evalf(1/2)*x) is 0.5*x (source: oracle, sin(10^50) = -0.789672493429)", () => {
    const r = host.home("piecewise(sin(10^50)>0,x,evalf(1/2)*x)", defaultHomeSettings).result;
    expect(r.display).toBe("0.5*x");
    expect(host.cas("piecewise(sin(10^50)>0,x,evalf(1/2)*x)", defaultCasSettings).result.text).toBe("0.5*x");
  });

  it("floatsAtDigits rounds each float of a P text to the display digits, as Giac prints them (source: derived)", async () => {
    const { floatsAtDigits, notBuiltin } = await import("./numeric.ts");
    const { giac } = await loadNodeGiac();
    const third = "0.3333333333333333333333333333333333333333";
    expect(floatsAtDigits(giac, `${third}*x+${third}e20*y-0.9999999999999999999999999999999999999999*z+2`, 12)).toBe(
      "0.333333333333*x+3.33333333333e+19*y-1.0*z+2",
    );
    expect(notBuiltin(giac)("sin")).toBe(false);
  });

  it("the Digits setting is back at the display digits after an input: a float in a non-number prints with them", () => {
    host.home("floor(sin(10^50))", defaultHomeSettings);
    expect(host.home("evalf([1/3,x])", defaultHomeSettings).result.display).toBe("[0.333333333333,x]");
    expect(host.cas("evalf([1/3,x])", defaultCasSettings).result.text).toBe("[0.333333333333,x]");
  });
});
