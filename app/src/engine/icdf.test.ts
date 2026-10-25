// SPDX-License-Identifier: GPL-3.0-or-later
// G44: the polish of the inverse distribution functions (icdf.ts); G44f1: erf and erfc through our definitions.
import { engineGiac } from "./nodeGiac.ts";
import { fakeGiac } from "./fakeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { ICDF_DEFINITIONS, ICDF_FAILED, erfValueText, icdfCalls, icdfPolished } from "./icdf.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import type { Giac } from "./numeric.ts";

describe("icdf text", () => {
  it("finds and replaces the four names outside strings only", () => {
    const text = 'normald_icdf(1/40)+student_icdf (5,1/2)+"fisher_icdf(1,2,3)"+mynormald_icdf(2)';
    expect(icdfCalls(text)).toEqual(["normald_icdf", "student_icdf"]);
    const fake: Giac = fakeGiac(() => "defined");
    expect(icdfPolished(fake, text)).toBe('pasnormald_icdf(1/40)+passtudent_icdf (5,1/2)+"fisher_icdf(1,2,3)"+mynormald_icdf(2)');
  });
});

describe("erf value text (G44f1)", () => {
  const evals: string[] = [];
  const fake: Giac = fakeGiac((t) => (evals.push(t), "defined"));
  it("reads erf and erfc through ours, and Giac's 1-erf(u) as erfc(u) only where nothing binds tighter", () => {
    expect(erfValueText(fake, "1-erf(9/2)", "printed")).toBe("paserfcv(9/2)");
    expect(erfValueText(fake, "1-erf(3)+erf(1/2)", "printed")).toBe("paserfcv(3)+paserfv(1/2)");
    expect(erfValueText(fake, "[1-erf(3),2*(1-erf(10))]", "printed")).toBe("[paserfcv(3),2*(paserfcv(10))]");
    expect(erfValueText(fake, "-1-erf(2)", "printed")).toBe("-1-paserfv(2)");
    expect(erfValueText(fake, "1-erf(2)*3", "printed")).toBe("1-paserfv(2)*3");
    expect(erfValueText(fake, "21-erf(2)+x^1-erf(1)", "printed")).toBe("21-paserfv(2)+x^1-paserfv(1)");
    expect(erfValueText(fake, 'erfc (1)+"erf(1)"+myerf(2)', "printed")).toBe('paserfcv (1)+"erf(1)"+myerf(2)');
  });
  it("reads the text as the caller says: typed escapes a quote with a backslash, Giac's print doubles it", () => {
    // G105f1: on the typed reading, \" does not close the string, so erf(1) is outside it and goes through ours
    expect(erfValueText(fake, 'size("a\\"")*0+erf(1)', "typed")).toContain("paserfv(1)");
    expect(erfValueText(fake, 'size("a\\"")*0+1-erf(1)', "typed")).toContain("paserfcv(1)");
    // a 1-erf( inside a string stays as it is
    expect(erfValueText(fake, '"1-erf(2)"+erf(1)', "printed")).toBe('"1-erf(2)"+paserfv(1)');
  });
  it("leaves a text without erf alone, with no engine call", () => {
    evals.length = 0;
    expect(erfValueText(fake, "sqrt(2)+myerf(1)", "printed")).toBe("sqrt(2)+myerf(1)");
    expect(evals).toEqual([]);
  });
});

describe.skipIf(!giacAvailable())("icdf polish (real Giac)", () => {
  let giac: Giac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  const at40 = (input: string): { value: string; failed: boolean } => {
    const text = icdfPolished(giac, input);
    giac.eval(`${ICDF_FAILED}:=0`);
    giac.eval("Digits:=40");
    const value = giac.eval(text);
    giac.eval("Digits:=12");
    const failed = giac.eval(ICDF_FAILED).trim() !== "0";
    giac.eval(`purge(${ICDF_FAILED})`);
    return { value, failed };
  };
  it("polishes at Giac's Digits (oracle: mpmath, prec-g44 cases)", () => {
    // -6.36134090240405620469537582827 (30 digits, oracle); Giac's double is -6.3613403515334
    expect(at40("normald_icdf(10^-10)")).toMatchObject({ value: expect.stringMatching(/^-6\.36134090240405620469537582826/), failed: false });
    // mean and σ: x = 2 + 3·z(1/40), z = -1.95996398454005423552459443052 (oracle)
    expect(at40("normald_icdf(2,3,1/40)")).toMatchObject({ value: expect.stringMatching(/^-3\.87989195362016270657378329/), failed: false });
  });
  it("the median of the symmetric ones is exact", () => {
    expect(at40("normald_icdf(1/2)")).toEqual({ value: "0", failed: false });
    expect(at40("normald_icdf(2,3,1/2)")).toEqual({ value: "2", failed: false });
    expect(at40("student_icdf(4,1/2)")).toEqual({ value: "0", failed: false });
  });
  it("refuses what is no distribution, with Giac's value and the flag", () => {
    // Giac's own double for σ = -1 (2 - z(3/10), as if σ were 1)
    expect(at40("normald_icdf(2,-1,3/10)")).toMatchObject({ value: expect.stringMatching(/^2\.5244005127/), failed: true });
    expect(at40("student_icdf(-3,3/10)").failed).toBe(true);
  });
  it("G44f2: a start that is not a real number is replaced by the centre (oracle: mpmath, g44f2 cases)", () => {
    icdfPolished(giac, "");
    // mpmath -11.46402468844361572698226422123603724396; Giac's own normald_icdf gives undef from about the third call
    expect(at40("pasicdf(0,0,1,10^-30,undef)")).toMatchObject({ value: expect.stringMatching(/^-0\.114640246884436157269822642212360372\d*e2$/), failed: false });
    expect(at40("pasicdf(0,0,1,10^-30,1+2*i)")).toMatchObject({ value: expect.stringMatching(/^-0\.114640246884436157269822642212360372\d*e2$/), failed: false });
  });
  it("G44f2: the χ² upper tail from a bracket in ln x (oracle: mpmath, prec-g44f2 cases)", () => {
    // mpmath 142.6779862234609448675934327407017641553; Giac gives +infinity, Newton from the centre took over 20 steps
    expect(at40("chisquare_icdf(3,1-10^-30)")).toMatchObject({ value: expect.stringMatching(/^0\.14267798622346094486759343274070176\d*e3$/), failed: false });
  });
  it("G44f2f1: the χ² and Fisher upper tails run Newton from Giac's good start, the bracket only when it is unusable", () => {
    icdfPolished(giac, "");
    // pasicdft (the tails and the density) evaluated through a counting wrapper: the work of one polish, independent of
    // the machine. Before G44f2f1 the bracket ran first every time: 15 evaluations for chisquare_icdf(3,9/10) at 40
    // digits, 4 with it; 253 ms against 68 ms on the parent (desktop), and Home's 300 ms budget cut the agreement run (⚠ unaudited).
    giac.eval(ICDF_DEFINITIONS.pasicdft!.replace(/^pasicdft\(/, "pasicdft0("));
    giac.eval("pasicdft(k,a,b,x):={ pasicdftn:=pasicdftn+1; return pasicdft0(k,a,b,x); }");
    const counted = (input: string): { value: string; failed: boolean; n: number } => {
      giac.eval("pasicdftn:=0");
      const r = at40(input);
      return { ...r, n: Number(giac.eval("pasicdftn")) };
    };
    try {
      // mpmath 6.25138863117032319640131636064312651769517…
      const chi = counted("chisquare_icdf(3,9/10)");
      expect(chi).toMatchObject({ value: expect.stringMatching(/^6\.2513886311703231964013163606431265176\d*$/), failed: false });
      expect(chi.n).toBeLessThanOrEqual(10);
      // mpmath 3.84145882069412595836137543736259684621…
      const chi1 = counted("chisquare_icdf(1,95/100)");
      expect(chi1).toMatchObject({ value: expect.stringMatching(/^3\.8414588206941259583613754373625968462\d*$/), failed: false });
      expect(chi1.n).toBeLessThanOrEqual(10);
      // mpmath 4.19086043887224444653292856672273218227…
      const f = counted("fisher_icdf(3,4,9/10)");
      expect(f).toMatchObject({ value: expect.stringMatching(/^4\.1908604388722444465329285667227321822\d*$/), failed: false });
      expect(f.n).toBeLessThanOrEqual(10);
      // Giac's +infinity is no start: the bracket, as in G44f2 (mpmath 142.67798622346094486759343274070176415…)
      expect(counted("chisquare_icdf(3,1-10^-30)")).toMatchObject({ value: expect.stringMatching(/^0\.14267798622346094486759343274070176\d*e3$/), failed: false });
      // A real start Newton cannot use falls back to the bracket from the centre: at 10^30 the density of χ²(3) is 0 at
      // 40 digits (refused before G44f2f1, the bracket started there and 60 halvings did not reach the root).
      expect(at40("pasicdf(2,3,1,9/10,10^30)")).toMatchObject({ value: expect.stringMatching(/^6\.2513886311703231964013163606431265176\d*$/), failed: false });
    } finally {
      giac.eval(ICDF_DEFINITIONS.pasicdft!);
      giac.eval("purge(pasicdft0,pasicdftn)");
    }
  });
  it("G44f1: erf and erfc at Giac's Digits (oracle: mpmath, prec-g44f1 cases)", () => {
    // Giac's own erf(1e-12) at 40 digits is 1e-12; mpmath 1.12837916709551257389615852699515…E-12
    expect(at40(erfValueText(giac, "erf(1.0e-12)", "printed"))).toMatchObject({ value: expect.stringMatching(/^0\.1128379167095512573896158526995\d*e-11$/), failed: false });
    // Giac's own erfc(-1.0) at 40 digits is erfc(1) = 0.157…; mpmath 1.84270079294971486934122063508260…
    expect(at40(erfValueText(giac, "erfc(-1.0)", "printed"))).toMatchObject({ value: expect.stringMatching(/^1\.8427007929497148693412206350826/), failed: false });
    // mpmath -0.328626759459127427638914047866756…
    expect(at40(erfValueText(giac, "erf(-0.3)", "printed"))).toMatchObject({ value: expect.stringMatching(/^-0\.32862675945912742763891404786675/), failed: false });
    // Giac's 1-erf(10) as our continued fraction: mpmath 2.08848758376254475700078629495778…E-45
    expect(at40(erfValueText(giac, "1-erf(10)", "printed"))).toMatchObject({ value: expect.stringMatching(/^0\.20884875837625447570007862949577\d*e-44$/), failed: false });
    expect(at40(erfValueText(giac, "erf(0)", "printed"))).toEqual({ value: "0", failed: false });
  });
  it("G44f1: erf of a non-real argument is Giac's own, with the flag", () => {
    expect(at40(erfValueText(giac, "erf(i)", "printed")).failed).toBe(true);
  });
});
