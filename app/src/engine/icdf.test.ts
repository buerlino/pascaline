// SPDX-License-Identifier: GPL-3.0-or-later
// G44: the polish of the inverse distribution functions (icdf.ts); G44f1: erf and erfc through our definitions.
import { beforeAll, describe, expect, it } from "vitest";
import { ICDF_FAILED, erfValueText, icdfCalls, icdfPolished } from "./icdf.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import type { Giac } from "./numeric.ts";

describe("icdf text", () => {
  it("finds and replaces the four names outside strings only", () => {
    const text = 'normald_icdf(1/40)+student_icdf (5,1/2)+"fisher_icdf(1,2,3)"+mynormald_icdf(2)';
    expect(icdfCalls(text)).toEqual(["normald_icdf", "student_icdf"]);
    const fake: Giac = { eval: () => "defined" };
    expect(icdfPolished(fake, text)).toBe('pasnormald_icdf(1/40)+passtudent_icdf (5,1/2)+"fisher_icdf(1,2,3)"+mynormald_icdf(2)');
  });
});

describe("erf value text (G44f1)", () => {
  const evals: string[] = [];
  const fake: Giac = { eval: (t) => (evals.push(t), "defined") };
  it("reads erf and erfc through ours, and Giac's 1-erf(u) as erfc(u) only where nothing binds tighter", () => {
    expect(erfValueText(fake, "1-erf(9/2)")).toBe("paserfcv(9/2)");
    expect(erfValueText(fake, "1-erf(3)+erf(1/2)")).toBe("paserfcv(3)+paserfv(1/2)");
    expect(erfValueText(fake, "[1-erf(3),2*(1-erf(10))]")).toBe("[paserfcv(3),2*(paserfcv(10))]");
    expect(erfValueText(fake, "-1-erf(2)")).toBe("-1-paserfv(2)");
    expect(erfValueText(fake, "1-erf(2)*3")).toBe("1-paserfv(2)*3");
    expect(erfValueText(fake, "21-erf(2)+x^1-erf(1)")).toBe("21-paserfv(2)+x^1-paserfv(1)");
    expect(erfValueText(fake, 'erfc (1)+"erf(1)"+myerf(2)')).toBe('paserfcv (1)+"erf(1)"+myerf(2)');
  });
  it("leaves a text without erf alone, with no engine call", () => {
    evals.length = 0;
    expect(erfValueText(fake, "sqrt(2)+myerf(1)")).toBe("sqrt(2)+myerf(1)");
    expect(evals).toEqual([]);
  });
});

describe.skipIf(!giacAvailable())("icdf polish (real Giac)", () => {
  let giac: Giac;
  beforeAll(async () => {
    giac = (await loadNodeGiac()).giac;
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
  it("G44f1: erf and erfc at Giac's Digits (oracle: mpmath, prec-g44f1 cases)", () => {
    // Giac's own erf(1e-12) at 40 digits is 1e-12; mpmath 1.12837916709551257389615852699515…E-12
    expect(at40(erfValueText(giac, "erf(1.0e-12)"))).toMatchObject({ value: expect.stringMatching(/^0\.1128379167095512573896158526995\d*e-11$/), failed: false });
    // Giac's own erfc(-1.0) at 40 digits is erfc(1) = 0.157…; mpmath 1.84270079294971486934122063508260…
    expect(at40(erfValueText(giac, "erfc(-1.0)"))).toMatchObject({ value: expect.stringMatching(/^1\.8427007929497148693412206350826/), failed: false });
    // mpmath -0.328626759459127427638914047866756…
    expect(at40(erfValueText(giac, "erf(-0.3)"))).toMatchObject({ value: expect.stringMatching(/^-0\.32862675945912742763891404786675/), failed: false });
    // Giac's 1-erf(10) as our continued fraction: mpmath 2.08848758376254475700078629495778…E-45
    expect(at40(erfValueText(giac, "1-erf(10)"))).toMatchObject({ value: expect.stringMatching(/^0\.20884875837625447570007862949577\d*e-44$/), failed: false });
    expect(at40(erfValueText(giac, "erf(0)"))).toEqual({ value: "0", failed: false });
  });
  it("G44f1: erf of a non-real argument is Giac's own, with the flag", () => {
    expect(at40(erfValueText(giac, "erf(i)")).failed).toBe(true);
  });
});
