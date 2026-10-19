// SPDX-License-Identifier: GPL-3.0-or-later
// G44: the polish of the inverse distribution functions (icdf.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { ICDF_FAILED, icdfCalls, icdfPolished } from "./icdf.ts";
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
});
