// SPDX-License-Identifier: GPL-3.0-or-later
// G146 (ca-7): the decision code unit by unit, against the real Giac build: decideTwice (G38, G57) and decidedAtDouble
// (G71) on the cut and tie cases of tests/golden/precision.yaml and home.yaml, each row with its golden id and the
// verdict the golden case implies (decided with its text, refused, or ⚠), plus one row per decision function family.
// The rows pin today's behaviour: a change that breaks a cut or a tie fails here, by name, before the golden gate.
// Expected texts are the golden rows' (oracle: mpmath, or derived as each row says); `known` rows pin a wrong answer
// of today with the oracle's value beside it (the report of G146 lists them).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, toExactLiterals } from "./homeEval.ts";
import { decidedAtDouble, decideTwice, restsOnDecision, type Decision } from "./decisions.ts";
import { notBuiltin, valuePrecision, withDigits } from "./numeric.ts";
import { formatComplex } from "./format.ts";
import { engineGiac, giacAvailable, loadNodeGiac, type EngineGiac } from "./nodeGiac.ts";

/** sin(10^n) as Giac prints it (the power written out). */
const sinOf = (n: number): string => `sin(1${"0".repeat(n)})`;

interface Row {
  /** The golden case (`precision.yaml` or `home.yaml` id), or `family:<name>` for a family row. */
  id: string;
  input: string;
  digits: number;
  /** restsOnDecision on the exact input and its text at P: whether Home decides it again at all. */
  rests: boolean;
  /** The verdict: the decided text, "refused" (G57: `error.undecided`), or "⚠" (undecided, not refused). */
  verdict: string;
  /** Where the verdict comes from (oracle or derivation), for the rows that are no golden case. */
  why?: string;
}

const ROWS: readonly Row[] = [
  // --- precision.yaml, G38 at 30 digits, and the CAS rows' inputs (Home decides them the same way) ---
  { id: "prec-g38-30-sign-sin1e50", input: "sign(sin(10^50))", digits: 30, rests: true, verdict: "-1" },
  { id: "prec-g38-30-floor-sin1e50", input: "floor(sin(10^50)*10^12)", digits: 30, rests: true, verdict: "-789672493430" },
  { id: "prec-g38-30-abs-sin1e50", input: "abs(sin(10^50))", digits: 30, rests: true, verdict: `-${sinOf(50)}`, why: "sin(10^50) < 0 (oracle), so |sin(10^50)| = -sin(10^50)" },
  { id: "prec-g38-30-gt-sin1e50", input: "sin(10^50)>0", digits: 30, rests: true, verdict: "false" },
  // Giac's P text holds no abs( (sqrt of the square came back as -sin(10^50), decided at P inside): not decided again
  { id: "prec-g38-30-sqrt-sq-sin1e50", input: "sqrt(sin(10^50)^2)", digits: 30, rests: false, verdict: `-${sinOf(50)}`, why: "as abs" },
  { id: "prec-g38-30-max-sin1e50", input: "max(sin(10^50),0)", digits: 30, rests: true, verdict: "0" },
  { id: "prec-g38-30-piecewise-sin1e50", input: "piecewise(sin(10^50)>0,1,2)", digits: 30, rests: true, verdict: "2" },
  { id: "prec-g38-30-floor-ramanujan", input: "floor(exp(pi*sqrt(163))*10^20)", digits: 30, rests: true, verdict: "26253741264076874399999999999925007259" },
  { id: "prec-g38-cas-floor-sin1e60", input: "floor(sin(10^60)*10^12)", digits: 12, rests: true, verdict: "830389765219" },
  // --- G57: refused ---
  { id: "prec-g38-cas-floor-cos-pi/7", input: "floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)", digits: 12, rests: true, verdict: "refused" },
  { id: "prec-g38-cas-floor-sin1e100", input: "floor(sin(10^100)*10^12)", digits: 12, rests: true, verdict: "refused" },
  { id: "prec-g38-30-floor-sin1e100", input: "floor(sin(10^100)*10^12)", digits: 30, rests: true, verdict: "refused" },
  { id: "g38-floor-cos-pi/7-1e-100", input: "floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2-10^-100)", digits: 12, rests: true, verdict: "refused" },
  // --- home.yaml G38 at 12 digits ---
  { id: "g38-round-sin1e50", input: "round(sin(10^50)*10^12)", digits: 12, rests: true, verdict: "-789672493429" },
  { id: "g38-floor-log10-1000", input: "floor(log10(1000))", digits: 12, rests: true, verdict: "3" },
  { id: "g38-sign-sqrt2-near", input: "sign(sqrt(2)-1.4142135623730951)", digits: 12, rests: true, verdict: "-1" },
  // --- sigfig and eseries (G139): a tie on rationals is no decision (rationalOnly); near and far ties ---
  { id: "sigfig-tie-0.125-2", input: "sigfig(0.125,2)", digits: 12, rests: false, verdict: "13/100" },
  { id: "sigfig-tie-neg-0.125-2", input: "sigfig(-0.125,2)", digits: 12, rests: false, verdict: "-13/100" },
  { id: "sigfig-tie-25-1", input: "sigfig(25,1)", digits: 12, rests: false, verdict: "30" },
  { id: "sigfig-sqrt2-3", input: "sigfig(sqrt(2),3)", digits: 12, rests: true, verdict: "141/100" },
  { id: "g139-sigfig-near-tie", input: "sigfig(1.25-sin(10^-50),2)", digits: 12, rests: true, verdict: "6/5" },
  { id: "g139-sigfig-far-tie", input: "sigfig(1.25-sin(10^-120),2)", digits: 12, rests: true, verdict: "refused" },
  { id: "g139-eseries-tie-3.3", input: "eseries(6,sqrt(33/10))", digits: 12, rests: true, verdict: "11/5" },
  { id: "g139-eseries-near-tie", input: "eseries(6,sqrt(33/10)+sin(10^-50))", digits: 12, rests: true, verdict: "11/5" },
  // --- G71 census and the tier-1 decisions at 12 digits ---
  { id: "g71-trunc-sin1e70", input: "trunc(sin(10^70)*10^12)", digits: 12, rests: true, verdict: "-148099131371" },
  { id: "g71-heaviside-sin1e70", input: "Heaviside(sin(10^70))", digits: 12, rests: true, verdict: "0" },
  { id: "g71-census-normalize-sin1e70", input: "normalize(sin(10^70))", digits: 12, rests: true, verdict: "-1" },
  // --- one row per family the golden files leave out (G146) ---
  { id: "family:ceil", input: "ceil(sin(10^50)*10^12)", digits: 12, rests: true, verdict: "-789672493429", why: "floor + 1 of a non-integer (g38-floor-sin1e50, oracle -789672493430)" },
  { id: "family:when", input: "when(sin(10^50)>0,1,2)", digits: 12, rests: true, verdict: "2", why: "sin(10^50) < 0 (oracle, g38-gt-sin1e50)" },
  { id: "family:int", input: "int(abs(x),x,-1,1)", digits: 12, rests: true, verdict: "1", why: "∫₋₁¹ |x| dx = 1" },
  // a tie Giac proves (sin²+cos² = 1, simplify gives 0): a floor, sign or frac takes its value on the cut ...
  { id: "family:floor-proven-tie", input: "floor(sin(pi/7)^2+cos(pi/7)^2)", digits: 12, rests: true, verdict: "1", why: "floor(1) = 1" },
  { id: "family:sign-proven-tie", input: "sign(sin(pi/7)^2+cos(pi/7)^2-1)", digits: 12, rests: true, verdict: "0", why: "sign(0) = 0" },
  // G157 (patch 0028): trunc stays unevaluated where Giac cannot prove the sign; the cut is still read on its argument
  { id: "family:trunc-proven-tie", input: "trunc(-(sin(pi/7)^2+cos(pi/7)^2))", digits: 12, rests: true, verdict: "-1", why: "trunc(-1) = -1" },
  { id: "family:trunc-unproved-tie", input: "trunc(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2-10^-100)", digits: 12, rests: true, verdict: "refused", why: "the argument is -10^-100 (the sum is 1/2), on a cut Giac cannot prove" },
  { id: "family:frac-proven-tie", input: "frac(sin(pi/7)^2+cos(pi/7)^2)", digits: 12, rests: true, verdict: "0", why: "frac(1) = 0" },
  // ... and one with no value to put in its place (Heaviside(0), round at a half, a comparison at 0) stays ⚠ (G57)
  { id: "family:heaviside-proven-tie", input: "Heaviside(sin(pi/7)^2+cos(pi/7)^2-1)", digits: 12, rests: true, verdict: "⚠", why: "Heaviside(0): conventions differ" },
  { id: "family:round-proven-tie", input: "round(sin(pi/7)^2+cos(pi/7)^2-1/2)", digits: 12, rests: true, verdict: "⚠", why: "round(1/2): a tie no value is put in for" },
  { id: "family:gt-proven-tie", input: "sin(pi/7)^2+cos(pi/7)^2-1>0", digits: 12, rests: true, verdict: "⚠", why: "0 > 0 on a cut" },
];

/** Known wrong today (found by G146): Home shows these with ≈ and the wrong sign. sin(10^100) = -0.372376123661…
 *  (prec-G23-sin-1e100) and sin(10^70) = -0.148099131372… (g71-heaviside-sin1e70's note), so each value is -sin(…);
 *  Giac at P = 40 takes both sines as positive and prints sin(…) (`text`). abs has no cut (decisionCuts: "continuous"),
 *  and P + 20 takes sin(10^100) as positive too, so the texts agree; sqrt of a square prints no abs( and calls no
 *  decision function, so restsOnDecision is false and decideTwice never runs (its verdict on sin(10^70) would be right). */
const KNOWN: readonly (Row & { text: string; oracle: string })[] = [
  { id: "known:abs-sin1e100", input: "abs(sin(10^100))", digits: 12, text: sinOf(100), rests: true, verdict: sinOf(100), oracle: `-${sinOf(100)}` },
  { id: "known:sqrt-sq-sin1e100", input: "sqrt(sin(10^100)^2)", digits: 12, text: sinOf(100), rests: false, verdict: sinOf(100), oracle: `-${sinOf(100)}` },
  { id: "known:sqrt-sq-sin1e70", input: "sqrt(sin(10^70)^2)", digits: 12, text: sinOf(70), rests: false, verdict: `-${sinOf(70)}`, oracle: `-${sinOf(70)}` },
];

/** The verdict of a decision, as the rows write it. */
function verdictOf(d: Decision): string {
  return "undecided" in d ? (d.refused ? "refused" : "⚠") : d.text;
}

describe.skipIf(!giacAvailable())("decideTwice (G38, G57; real Giac)", () => {
  let giac: EngineGiac;
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    giac = engineGiac(L);
    host = new EngineHost(giac, L.bridge);
    host.home("1", defaultHomeSettings); // Home's setup (radians, the step budget)
    host.need("sigfig(1,1)+eseries(6,1)"); // our definitions
  });

  /** As homeEval runs it: the exact input, its text at P, restsOnDecision, then decideTwice (P + 20, P + 40). */
  const decide = (r: Row): { rests: boolean; verdict: string; text: string } => {
    const exact = toExactLiterals(r.input);
    const text = withDigits(giac, valuePrecision(r.digits), r.digits, () => giac.eval(`(${exact})`));
    const rests = restsOnDecision(exact, "typed", text, notBuiltin(giac));
    const d = decideTwice(giac, exact, text, r.digits, r.digits);
    giac.eval("purge(pasdec2)");
    return { rests, verdict: verdictOf(d), text };
  };

  for (const r of ROWS) {
    it(`${r.id}: ${r.input} at ${r.digits} → ${r.verdict}${r.why ? ` (${r.why})` : ""}`, () => {
      const got = decide(r);
      expect({ rests: got.rests, verdict: got.verdict }).toEqual({ rests: r.rests, verdict: r.verdict });
    });
  }

  for (const r of KNOWN) {
    it(`${r.id} (known wrong in Home; the value is ${r.oracle.slice(0, 5)}…): ${r.input} prints ${r.text.slice(0, 5)}… at P`, () => {
      const got = decide(r);
      expect(got).toEqual({ text: r.text, rests: r.rests, verdict: r.verdict });
      // Home keeps the P text when rests is false, the verdict otherwise: either way not the oracle's sign
      expect(r.rests ? got.verdict : got.text).not.toBe(r.oracle);
    });
  }

  it("a decided text from the P + 40 run is kept in pasdec2 for the caller (from), and the agreeing one is not", () => {
    const exact = toExactLiterals("floor(sin(10^60)*10^12)");
    const text = withDigits(giac, valuePrecision(12), 12, () => giac.eval(`(${exact})`));
    const d = decideTwice(giac, exact, text, 12, 12);
    expect(d).toMatchObject({ text: "830389765219", from: "pasdec2" });
    expect(giac.eval("pasdec2")).toBe("830389765219");
    giac.eval("purge(pasdec2)");
    const same = decideTwice(giac, "max(sin(10^50),0)", "0", 12, 12);
    expect(same).toEqual({ text: "0" });
    expect(giac.eval("pasdec2")).toBe("pasdec2");
  });

  it("iPart (known): Giac's iPart prints a float, so Home does not decide it again; it shows ⚠ with no digit (oracle -148099131371)", () => {
    const r = host.home("iPart(sin(10^70)*10^12)", defaultHomeSettings).result;
    expect({ display: r.display, reliableDigits: r.facts.reliableDigits, warn: r.facts.warn }).toEqual({ display: "4E11", reliableDigits: 0, warn: "unaudited" });
  });
});

describe.skipIf(!giacAvailable())("decidedAtDouble (G71, F59; real Giac)", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  /** A number as Home shows it at 12 digits, its confirmed digits and warn; or the text; or null. */
  const atDouble = (input: string): unknown => {
    const d = decidedAtDouble(giac, "pasg146", input, 12);
    giac.eval("purge(pasg146)");
    if (d === null || "text" in d) return d;
    return d.facts.map((f) => ({ shown: formatComplex(f.value, { format: "STD", digits: 12 }).text, digits: f.reliableDigits, warn: f.warn, exact: f.exact }));
  };
  const n = (shown: string) => [{ shown, digits: 12, warn: "unaudited", exact: false }];

  it("g71-round-besselj-1e12: round(BesselJ(1,2)*10^12) → 576724807757 ⚠", () => expect(atDouble("round(BesselJ(1,2)*10^12)")).toEqual(n("576724807757")));
  it("g71-floor-besselj-1e12: floor(BesselJ(1,2)*10^12) → 576724807756 ⚠", () => expect(atDouble("floor(BesselJ(1,2)*10^12)")).toEqual(n("576724807756")));
  it("g71-round-besselj: round(BesselJ(1,2)) → 1 ⚠", () => expect(atDouble("round(BesselJ(1,2))")).toEqual(n("1")));
  it("g71-sign-besselj-half: sign(BesselJ(1,2)-0.5) → 1 ⚠", () => expect(atDouble("sign(BesselJ(1,2)-0.5)")).toEqual(n("1")));
  it("g71-max-besselj: max(BesselJ(1,2),0.1) → 0.576724807757 ⚠", () => expect(atDouble("max(BesselJ(1,2),0.1)")).toEqual(n("0.576724807757")));
  it("g71-gt-besselj-half: BesselJ(1,2)>0.5 → the text true", () => expect(atDouble("BesselJ(1,2)>0.5")).toEqual({ text: "true" }));
  it("family:symbolic: a free name gives no number and no plain text → null (the error stays)", () => expect(atDouble("BesselJ(1,x)>0.5")).toBeNull());
  it("at 30 digits the confirmed digits are the double's (DOUBLE_DIGITS = 14)", () => {
    const d = decidedAtDouble(giac, "pasg146", "round(BesselJ(1,2)*10^12)", 30);
    giac.eval("purge(pasg146)");
    expect(d && "facts" in d ? d.facts.map((f) => f.reliableDigits) : d).toEqual([14]);
  });
});
