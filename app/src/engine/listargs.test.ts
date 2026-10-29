// SPDX-License-Identifier: GPL-3.0-or-later
// G111 (backlog F98, F91): Giac reads one list argument of LambertW, hermite, legendre, tchebyshev1, tchebyshev2,
// cyclotomic, range and randvector as their argument list (LambertW([1,2]) is LambertW(1,2), branch 2), so such a call
// is refused in Home and CAS; two arguments typed as two, one number and a name that holds no list keep Giac's answer.
// fracmod with a modulus ≤ 0 is refused and the engine answers the next input (patch 0008; it trapped the wasm).
// Expected values are derived (the golden cases g111-* in home.yaml and precision.yaml).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { markOf } from "./format.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { listAsArguments } from "./listargs.ts";

const REFUSAL = { ok: false, error: "listAsArguments", display: "This function reads a list as its arguments: give it one value at a time" };

describe.skipIf(!giacAvailable())("G111 a list read as the argument list", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("refuses one list argument in Home, typed, of Giac's list type or stored", () => {
    expect(home("LambertW([1,2])")).toMatchObject(REFUSAL);
    expect(home("LambertW(list[1,2])")).toMatchObject(REFUSAL);
    expect(home("2*LambertW( [1,2] )+1")).toMatchObject(REFUSAL);
    expect(home("L:=[1,2]")).toMatchObject({ ok: true });
    expect(home("LambertW(L)")).toMatchObject(REFUSAL);
    for (const f of ["hermite", "legendre", "tchebyshev1", "tchebyshev2", "cyclotomic", "range", "randvector"]) {
      expect(home(`${f}([1,2])`), f).toMatchObject(REFUSAL);
    }
  });

  it("refuses it in CAS, and an assignment stores nothing", () => {
    expect(cas("LambertW([1,2])")).toMatchObject({ ok: false, error: "listAsArguments" });
    expect(cas("hermite([1,2])")).toMatchObject({ ok: false, error: "listAsArguments" });
    expect(cas("W:=LambertW([1,2])")).toMatchObject({ ok: false, error: "listAsArguments" });
    expect(cas("W")).toMatchObject({ ok: true, text: "W" });
  });

  it("keeps two arguments typed as two, a number, a free name and a name holding a number", () => {
    expect(home("LambertW(1)")).toMatchObject({ ok: true, display: "0.56714329041" });
    expect(home("hermite(1,2)")).toMatchObject({ ok: true, display: "4" });
    expect(home("range(1,3)")).toMatchObject({ ok: true });
    expect(cas("LambertW(x)")).toMatchObject({ ok: true, text: "LambertW(x)" });
    expect(cas("hermite(2,x)")).toMatchObject({ ok: true });
    expect(home("c:=2")).toMatchObject({ ok: true });
    expect(home("LambertW(c)")).toMatchObject({ ok: true });
  });
});

// R80f1: Giac's densities, cdfs and inverse cdfs read one list argument as their argument list too, probed with patch 0007
// (normald_cdf([0.5,1.5]) = normald_cdf(0.5,1.5) = P(0.5 ≤ X ≤ 1.5) ≈ 0.2417); a list as their x after the parameters is
// one value per element (uniform_cdf(3.2,5.7,list[1,2]) = list[0,0]), but negbinomial_icdf(3,1/2,list[1/5,7/10]) = 0
// (right {1,4}: P(K ≤ 0) = 1/8 < 1/5 ≤ P(K ≤ 1) = 5/16, and P(K ≤ 3) = 21/32 < 7/10 ≤ P(K ≤ 4) = 99/128) is refused.
describe.skipIf(!giacAvailable())("R80f1 a list in a distribution", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("refuses one list as a distribution's only argument, typed or stored", () => {
    for (const f of ["normald_cdf", "normald", "exponential_cdf", "binomial", "cauchy_cdf", "igamma"]) {
      expect(home(`${f}(list[1/2,3/2])`), f).toMatchObject(REFUSAL);
    }
    expect(home("M:=list[1/2,3/2]")).toMatchObject({ ok: true });
    expect(home("normald_cdf(M)")).toMatchObject(REFUSAL);
    expect(cas("normald_cdf([1/2,3/2])")).toMatchObject({ ok: false, error: "listAsArguments" });
  });

  it("refuses a list anywhere in negbinomial_icdf's arguments", () => {
    const wrong = { ok: false, error: "listInArgument", display: "This function answers a list wrongly: give it one value at a time" };
    expect(home("negbinomial_icdf(3,1/2,list[1/5,7/10])")).toMatchObject(wrong);
    expect(home("P:=list[1/5,7/10]")).toMatchObject({ ok: true });
    expect(home("negbinomial_icdf(3,1/2,P)")).toMatchObject(wrong);
    // G113: since patch 0009 Giac refuses a list itself (its probability must be a double), so CAS shows Giac's message
    expect(cas("negbinomial_icdf(3,1/2,[1/5,7/10])")).toMatchObject({ ok: false, error: "engine" });
    // one number is not refused, and is right since patch 0009 (G113, F104: it was 0)
    expect(home("negbinomial_icdf(3,1/2,1/5)")).toMatchObject({ ok: true, display: "1" });
  });

  // mlr_beta(X, y): the vector y gives Giac's betas [0.05,1.99] (intercept, slope of 2.1, 3.9, 6.2, 7.8, 10.1 on 1…5);
  // the list type gives a 2×5 matrix, and mlr_predict a matrix where five predictions belong
  it("refuses a list-type y or beta in mlr_beta and mlr_predict, and keeps a vector", () => {
    const wrong = { ok: false, error: "listInArgument" };
    const X = "[[1],[2],[3],[4],[5]]";
    expect(cas(`mlr_beta(${X},list[21/10,39/10,31/5,39/5,101/10])`)).toMatchObject(wrong);
    expect(cas(`mlr_predict(${X},list[1/20,199/100])`)).toMatchObject(wrong);
    expect(home("Y:=list[21/10,39/10,31/5,39/5,101/10]")).toMatchObject({ ok: true });
    expect(home(`mlr_beta(${X},Y)`)).toMatchObject(wrong);
    expect(cas(`mlr_beta(${X},[21/10,39/10,31/5,39/5,101/10])`)).toMatchObject({ ok: true });
    expect(cas(`mlr_beta(list[[1],[2],[3],[4],[5]],[21/10,39/10,31/5,39/5,101/10])`)).toMatchObject({ ok: true });
  });

  it("keeps a list after the parameters, one value per element", () => {
    expect(home("uniform_cdf(16/5,57/10,list[1,2])")).toMatchObject({ ok: true, display: "{0,0}" });
    expect(home("binomial(5,2)*list[1,4]")).toMatchObject({ ok: true, display: "{10,40}" });
    // 1−e^(−2·1) ≈ 0.864664716763 and 0 below the support; a float list takes its weakest element's mark (docs/04 2.4), ≈ here
    for (const [input, display] of [["exponential_cdf(2,list[1,-1])", "{0.864664716763,0}"], ["list[1,2]+normald_cdf(1)", "{1.84134474607,2.84134474607}"]]) {
      const r = home(input!);
      expect(r).toMatchObject({ ok: true, display });
      expect(markOf(precisionFacts(r), { format: "STD", digits: 12 })?.mark, input).toBe("≈");
    }
  });
});

describe.skipIf(!giacAvailable())("G111 fracmod with a modulus ≤ 0 (patch 0008)", () => {
  it("is refused and the same engine answers the next input", async () => {
    const host = await nodeHost();
    expect(host.home("fracmod(41,-2)", defaultHomeSettings).result).toMatchObject({ ok: false });
    expect(host.home("1+1", defaultHomeSettings).result).toMatchObject({ ok: true, display: "2" });
    expect(host.cas("fracmod(41,-2)", defaultCasSettings).result).toMatchObject({ ok: false });
    expect(host.cas("fracmod(3,13)", defaultCasSettings).result).toMatchObject({ ok: true, text: "-1/4" });
  });
});

// R80f1 fix round 1: an entry for argument 0 (a list-type first argument) is a mode, not "no mode"
describe("R80f1 a LIST_IN_ARGUMENTS entry for argument 0", () => {
  const giac = { eval: (): string => "[0]" } as unknown as Parameters<typeof listAsArguments>[0];
  const table = { f0: 0 } as const;
  it("refuses a list-type first argument of a call with more arguments, as listInArgument", () => {
    expect(listAsArguments(giac, "f0(list[1,2],3)", () => false, table)).toBe("listInArgument");
    expect(listAsArguments(giac, "f0(list[1,2])", () => false, table)).toBe("listInArgument");
  });
  it("keeps a list-type value in another argument", () => {
    expect(listAsArguments(giac, "f0(3,list[1,2])", () => false, table)).toBeNull();
  });
});

// G124 (backlog F107): for a few names Giac's reading of one list as the argument list is the documented meaning (the probe's
// second class, listargsEvidence.ts PROBED_LIST_FORM_EVIDENCE): a matrix from its rows, dimensions of zeros or of a random
// matrix, the pair of simp2 and iegcd, subst's expression and equation. Expected values are Giac's own (derived: [[1,2],[3,4]]
// is the rows; 45·2 + 75·(−1) = 15 = gcd(45,75); 12/6 = 2, 18/6 = 3; x+1 at x=2 is 3); the G111, R80f1 and G112 names stay.
describe.skipIf(!giacAvailable())("G124 a list form Giac documents", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("answers the six inputs in Home with Giac's value", () => {
    expect(home("matrix(list[[1,2],[3,4]])")).toMatchObject({ ok: true, display: "[[1,2],[3,4]]" });
    expect(home("zeros(list[2,3])")).toMatchObject({ ok: true, display: "[[0,0,0],[0,0,0]]" });
    const r = home("ranm(list[2,3])");
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.display, "a 2×3 matrix").toMatch(/^\[\[-?\d+,-?\d+,-?\d+\],\[-?\d+,-?\d+,-?\d+\]\]$/);
    expect(home("simp2(list[12,18])")).toMatchObject({ ok: true, display: "{2,3}" });
    expect(home("iegcd(list[45,75])")).toMatchObject({ ok: true, display: "{2,-1,15}" });
    expect(home("subst(list[x+1,x=2])")).toMatchObject({ ok: true, display: "3" });
  });

  it("keeps refusing the G111, R80f1 and G112 names, and a list outside the documented form", () => {
    for (const input of ["LambertW([1,2])", "hermite([1,2])", "Psi(list[1,2])", "normald_cdf([0,1])", "comb(list[5,2])"]) {
      expect(home(input), input).toMatchObject(REFUSAL);
    }
    // zeros([x^2-1,x+y-1]) is zeros(x^2-1,x+y-1) = [] (the system has the roots [1,0] and [-1,2]); matrix(list[1,2]) is a 1×2 zero matrix
    for (const input of ["zeros([x^2-1,x+y-1])", "matrix(list[1,2])", "ranm(list[2,1/2])"]) {
      expect(home(input), input).toMatchObject(REFUSAL);
    }
  });
});
