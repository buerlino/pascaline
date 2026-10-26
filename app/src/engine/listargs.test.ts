// SPDX-License-Identifier: GPL-3.0-or-later
// G111 (backlog F98, F91): Giac reads one list argument of LambertW, hermite, legendre, tchebyshev1, tchebyshev2,
// cyclotomic, range and randvector as their argument list (LambertW([1,2]) is LambertW(1,2), branch 2), so such a call
// is refused in Home and CAS; two arguments typed as two, one number and a name that holds no list keep Giac's answer.
// fracmod with a modulus ≤ 0 is refused and the engine answers the next input (patch 0008; it trapped the wasm).
// Expected values are derived (the golden cases g111-* in home.yaml and precision.yaml).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

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
    expect(cas("negbinomial_icdf(3,1/2,[1/5,7/10])")).toMatchObject({ ok: false, error: "listInArgument" });
    // one number is not refused (its value, 0 where 1 is right, is a finding of its own: the report of R80f1)
    expect(home("negbinomial_icdf(3,1/2,1/5)")).toMatchObject({ ok: true });
  });

  it("keeps a list after the parameters, one value per element", () => {
    expect(home("uniform_cdf(16/5,57/10,list[1,2])")).toMatchObject({ ok: true, display: "{0,0}" });
    expect(home("binomial(5,2)*list[1,4]")).toMatchObject({ ok: true, display: "{10,40}" });
    // 1−e^(−2·1) ≈ 0.864664716763 and 0 below the support
    expect(home("exponential_cdf(2,list[1,-1])")).toMatchObject({ ok: true, display: "{0.864664716763,0}" });
    expect(home("list[1,2]+normald_cdf(1)")).toMatchObject({ ok: true, display: "{1.84134474607,2.84134474607}" });
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
