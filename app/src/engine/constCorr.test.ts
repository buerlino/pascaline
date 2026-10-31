// SPDX-License-Identifier: GPL-3.0-or-later
// G81: a constant's σ through its basis (correlated constants), real Giac. The entries are the Find index's (G80:
// libqalculate 5.13.1's CODATA 2022 values, formulas and leaves). Expected values: source: oracle, from mpmath at 50
// digits with the same leaves, first order over them (tests/golden/oracle_constcorr.py).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { engineGiac, giacAvailable, loadNodeGiac, type EngineGiac } from "./nodeGiac.ts";
import { inexactConstsIn, sigmaExpr, type ConstEntry, type ConstTable } from "./constUnc.ts";

const H = "(662607015*10^(-42))";
const E = "(1602176634*10^(-28))";
const ALPHA = { fine_structure: { value: "7.29735256434E-3", unc: "1.13E-12" } };
const RYD = { rydberg: { value: "10973731.5681569", unc: "0.000012" } };
/** The index's entries (G80), with their basis. */
const WITH: Record<string, ConstEntry> = {
  c: { value: "299792458" },
  mu_0: { value: "1.25663706127E-6", unc: "2.0E-16", basis: `(2*${H}*pasl_fine_structure)/(299792458*${E}^2)`, basisLeaves: ALPHA },
  epsilon_0: { value: "8.8541878188E-12", unc: "1.4E-21", basis: `${E}^2/(2*${H}*pasl_fine_structure*299792458)`, basisLeaves: ALPHA },
  m_e: { value: "9.1093837139E-31", unc: "2.8E-40", basis: `(2*pasl_rydberg*${H})/(299792458*pasl_fine_structure^2)`, basisLeaves: { ...ALPHA, ...RYD } },
  m_p: {
    value: "1.67262192595E-27",
    unc: "5.2E-37",
    basis: `pasl_proton_u*((2*pasl_rydberg*${H})/(299792458*pasl_fine_structure^2*pasl_electron_u))`,
    basisLeaves: { ...ALPHA, ...RYD, electron_u: { value: "5.485799090441E-4", unc: "9.7E-15" }, proton_u: { value: "1.0072764665789", unc: "8.3E-12" } },
  },
};
/** The same constants as a chip stored before G81 carries them: value and uncertainty only. */
const WITHOUT: ConstTable = Object.fromEntries(Object.entries(WITH).map(([id, { value, unc }]) => [id, unc === undefined ? { value } : { value, unc }]));

describe.skipIf(!giacAvailable())("a constant's σ through its basis (G81, real Giac)", () => {
  let host: EngineHost;
  let giac: EngineGiac;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    giac = engineGiac(L);
    host = new EngineHost(giac, L.bridge);
  });
  const home = (i: string, t: ConstTable) => host.home(i, defaultHomeSettings, t).result;
  const sigma = (body: string, t: ConstTable): number => {
    const out = giac.eval(`evalf(${sigmaExpr(body, t, inexactConstsIn(body, t))},20)`);
    expect(out, body).not.toMatch(/GIAC_ERROR/);
    return Number(out);
  };

  it("μ₀·ε₀·c² is exactly 1 with σ = 0, and still not `=` (oracle: 1, σ 0)", () => {
    const body = "pasc_mu_0*pasc_epsilon_0*pasc_c^2";
    expect(sigma(body, WITH)).toBe(0);
    const r = home(body, WITH);
    expect(r.ok).toBe(true);
    expect(r.exact).toBe("1");
    expect(r.display).toBe("1");
    expect("uncDigits" in r.facts).toBe(false);
    // The mark is unchanged (decisions M4-4): the input holds inexact constants, so the item is never `=` (the session's
    // inexactInput, results.ts homeItem). Whether a σ of 0 may give `=` is under "Needs the user".
    expect(inexactConstsIn(body, WITH)).toEqual(["mu_0", "epsilon_0"]);
  });

  it("√(μ₀/ε₀) = Z₀: σ 5.8337E-8 (oracle), not the independent 4.2E-8", () => {
    const s = sigma("sqrt(pasc_mu_0/pasc_epsilon_0)", WITH);
    expect(Math.abs(s / 5.8336944858e-8 - 1)).toBeLessThan(0.02);
    expect(home("sqrt(pasc_mu_0/pasc_epsilon_0)", WITH).display).toBe("376.730313412");
  });

  it("m_p/m_e: σ 3.5819E-8 (oracle), not the independent 8.0E-7; 11 digits hold, not 10 (derived)", () => {
    const s = sigma("pasc_m_p/pasc_m_e", WITH);
    expect(Math.abs(s / 3.5819195431e-8 - 1)).toBeLessThan(0.02);
    const r = home("pasc_m_p/pasc_m_e", WITH);
    expect(r.display).toBe("1836.15267343");
    expect(r.facts.uncDigits).toBe(11);
  });

  it("a constant without a basis (a chip stored before G81) keeps its own value and σ: the uncDigits of phase-1", () => {
    // σ = sqrt((5.2E-37/m_e)² + (m_p·2.8E-40/m_e²)²) = 8.0E-7 under 1836.15: 10 digits (derived, as phase-1 gives)
    expect(Math.abs(sigma("pasc_m_p/pasc_m_e", WITHOUT) / 8.0e-7 - 1)).toBeLessThan(0.02);
    expect(home("pasc_m_p/pasc_m_e", WITHOUT).facts.uncDigits).toBe(10);
    // a basis whose leaf is missing is not used either
    const broken = { ...WITH, m_e: { ...WITH["m_e"]!, basisLeaves: ALPHA } };
    expect(home("pasc_m_e*2", broken).display).toBe(home("pasc_m_e*2", WITHOUT).display);
  });

  it("constants that share no leaf combine as before: G·m_e", () => {
    const G = { value: "6.67430E-11", unc: "1.5E-15", basis: "pasl_newtonian_constant", basisLeaves: { newtonian_constant: { value: "6.67430E-11", unc: "1.5E-15" } } };
    // σ/v = sqrt((1.5E-15/6.6743E-11)² + (2.8E-40/9.1093837139E-31)²) = 2.2474E-5: the basis changes neither value nor σ
    const [t, u] = [{ ...WITH, G }, { ...WITHOUT, G: { value: G.value, unc: G.unc } }];
    expect(sigma("pasc_G*pasc_m_e", t) / 6.6743e-11 / 9.1093837139e-31 / 2.2474e-5).toBeCloseTo(1, 3);
    expect(sigma("pasc_G*pasc_m_e", t) / sigma("pasc_G*pasc_m_e", u)).toBeCloseTo(1, 3);
    expect(home("pasc_G*pasc_m_e", t).facts.uncDigits).toBe(home("pasc_G*pasc_m_e", u).facts.uncDigits);
  });
});
