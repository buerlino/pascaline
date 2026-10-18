// SPDX-License-Identifier: GPL-3.0-or-later
// G26: the pure parts of constUnc.ts (no engine).
import { describe, expect, it } from "vitest";
import { inexactConstsIn, sigmaExpr, uncDigitsOf, withConstValues } from "./constUnc.ts";
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
