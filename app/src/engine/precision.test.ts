// SPDX-License-Identifier: GPL-3.0-or-later
// Honest precision against the real Giac build (docs/04 sections 2.4–2.10, G2): the facts the engine reports, and the
// mark the formatter derives from them. Expected values are derived (exact arithmetic) or come from the oracle
// (tests/golden/.venv, mpmath at 60 digits), as each case says. Skipped when no engine build is found (nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, type HomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf, type MarkInfo } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("honest precision (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const home = (input: string, digits = 12) => host.home(input, { ...defaultHomeSettings, digits } satisfies HomeSettings).result;
  const mark = (input: string, digits = 12): MarkInfo | null => markOf(home(input, digits), { format: "STD", digits });

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
