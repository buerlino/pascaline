// SPDX-License-Identifier: GPL-3.0-or-later
// G26: the pure parts of constUnc.ts (no engine).
import { describe, expect, it } from "vitest";
import { basisOf, correlated } from "./constBasis.ts";
import { constFacts, constTable, inexactConstsIn, sigmaExpr, uncDigitsOf, withConstValues } from "./constUnc.ts";
import { decimalFromString } from "./format.ts";

const G = { value: "6.67430E-11", unc: "0.00015E-11" };
const d = (s: string) => decimalFromString(s)!;

describe("constUnc (G26)", () => {
  it("puts the values in, keeping the asked names and the unknown ones", () => {
    expect(withConstValues("pasc_G*pasc_c+pasc_x+mypasc_G", { G, c: { value: "299792458" } })).toBe("(6.67430E-11)*(299792458)+pasc_x+mypasc_G");
    expect(withConstValues("pasc_G*pasc_c", { G, c: { value: "299792458" } }, new Set(["G"]))).toBe("pasc_G*(299792458)");
  });
  it("lists the inexact constants once, in order", () => {
    expect(inexactConstsIn("pasc_m_e+pasc_G*pasc_c*pasc_m_e", { G, c: { value: "1" }, m_e: { value: "9.1093837139E-31", unc: "0.0000000028E-31" }, z: { value: "2", unc: "0E5" } })).toEqual(["m_e", "G"]);
    expect(inexactConstsIn("pasc_z", { z: { value: "2", unc: "0.000" } })).toEqual([]);
  });
  it("builds σ from exact derivatives at the values", () => {
    expect(sigmaExpr("pasc_G*2", { G }, ["G"])).toBe("sqrt((subst(diff(pasc_G*2,pasc_G),[pasc_G=((667430/10^16))])*((15/10^16)))^2)");
  });
  it("counts the digits before σ's first digit, on the value as shown (derived)", () => {
    expect(uncDigitsOf(d("3.98589196e14"), d("8.958e9"), 12)).toBe(5);
    // σ = 0.003 sits at 1E-3: 9.9996 shown with 4 digits is 10.00, all 4 before it; shown with 5, 9.999|6 keeps 3
    expect(uncDigitsOf(d("9.9996"), d("0.003"), 4)).toBe(4);
    expect(uncDigitsOf(d("9.9996"), d("0.003"), 5)).toBe(3);
    expect(uncDigitsOf(d("1"), d("20"), 12)).toBe(0);
    expect(uncDigitsOf(d("0"), d("0.1"), 12)).toBe(0);
    expect(uncDigitsOf(d("5"), d("0"), 12)).toBeNull();
  });
});

describe("constFacts (G86)", () => {
  it("a constant with an uncertainty is not exact and never `=`; one without (or with zero) is exact", () => {
    expect(constFacts({ value: "6.67430E-11", unc: "0.00015E-11" })).toEqual({ exact: false, reliableDigits: null, inexact: true });
    expect(constFacts({ value: "299792458" })).toEqual({ exact: true, reliableDigits: null });
    expect(constFacts({ value: "299792458", unc: "0" })).toEqual({ exact: true, reliableDigits: null });
  });
});

describe("ConstEntry carries its facts (G86)", () => {
  it("constTable sets each entry's facts to constFacts of that entry", () => {
    const raw = {
      G: { value: "6.67430E-11", unc: "0.00015E-11" },
      c: { value: "299792458" },
      z: { value: "1", unc: "0E-3" },
      // facts carried in that disagree with unc are replaced
      w: { value: "2", unc: "0.1", facts: { exact: true, reliableDigits: null } },
    };
    const t = constTable(raw);
    for (const [id, e] of Object.entries(raw)) expect(t[id]!.facts).toEqual(constFacts(e));
    expect(inexactConstsIn("pasc_G*pasc_c*pasc_z*pasc_w", t)).toEqual(["G", "w"]);
  });
  it("unc alone decides which constants are inexact: facts that disagree change nothing", () => {
    const c = { c: { value: "299792458", facts: { exact: false, reliableDigits: null, inexact: true as const } } };
    expect(inexactConstsIn("pasc_c", c)).toEqual([]);
    const G = { G: { value: "6.67430E-11", unc: "0.00015E-11", facts: { exact: true, reliableDigits: null } } };
    expect(inexactConstsIn("pasc_G", G)).toEqual(["G"]);
  });
});

describe("a constant enters through its basis (G81)", () => {
  const a = { fine_structure: { value: "7.3E-3", unc: "1E-12" } };
  const mu = { value: "1.2E-6", unc: "2E-16", basis: "2*pasl_fine_structure/3", basisLeaves: a };
  const eps = { value: "8.8E-12", unc: "1E-21", basis: "5/pasl_fine_structure", basisLeaves: a };
  it("the basis is used only when every leaf is carried and the constant is inexact", () => {
    expect(basisOf(mu)).toBe("2*pasl_fine_structure/3");
    expect(basisOf({ ...mu, basisLeaves: {} })).toBeUndefined();
    expect(basisOf({ unc: "2E-16" })).toBeUndefined();
    expect(basisOf({ ...mu, unc: "0" })).toBeUndefined();
  });
  it("constants sharing a leaf go in through their bases; any other keeps its own value", () => {
    expect(withConstValues("pasc_mu*pasc_eps*pasc_G", { mu, eps, G })).toBe("(2*(7.3E-3)/3)*(5/(7.3E-3))*(6.67430E-11)");
    expect(withConstValues("pasc_mu*pasc_eps", { mu, eps }, undefined, "names")).toBe("(2*pasl_fine_structure/3)*(5/pasl_fine_structure)");
    // alone, or beside a constant without a basis, the index's curated value (G13), not the leaves' (G81)
    expect(withConstValues("pasc_mu*pasc_G", { mu, G })).toBe("(1.2E-6)*(6.67430E-11)");
    expect(withConstValues("pasc_mu*pasc_eps", { mu, eps: { value: eps.value, unc: eps.unc } })).toBe("(1.2E-6)*(8.8E-12)");
  });
  it("correlated: only the constants whose bases share a leaf", () => {
    const g = { unc: "1", basis: "pasl_newtonian", basisLeaves: { newtonian: { value: "6", unc: "1" } } };
    expect([...correlated([["mu", mu], ["eps", eps], ["g", g]])]).toEqual(["mu", "eps"]);
    expect([...correlated([["mu", mu], ["g", g]])]).toEqual([]);
  });
  it("σ is taken over the shared leaf once, and over a constant without a basis as before", () => {
    expect(sigmaExpr("pasc_mu*pasc_eps*pasc_G", { mu, eps, G }, ["mu", "eps", "G"])).toBe(
      "sqrt((subst(diff((2*pasl_fine_structure/3)*(5/pasl_fine_structure)*pasc_G,pasl_fine_structure),[pasl_fine_structure=((73/10^4)),pasc_G=((667430/10^16))])*((1/10^12)))^2" +
        "+(subst(diff((2*pasl_fine_structure/3)*(5/pasl_fine_structure)*pasc_G,pasc_G),[pasl_fine_structure=((73/10^4)),pasc_G=((667430/10^16))])*((15/10^16)))^2)",
    );
  });
});
