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

describe.skipIf(!giacAvailable())("G111 fracmod with a modulus ≤ 0 (patch 0008)", () => {
  it("is refused and the same engine answers the next input", async () => {
    const host = await nodeHost();
    expect(host.home("fracmod(41,-2)", defaultHomeSettings).result).toMatchObject({ ok: false });
    expect(host.home("1+1", defaultHomeSettings).result).toMatchObject({ ok: true, display: "2" });
    expect(host.cas("fracmod(41,-2)", defaultCasSettings).result).toMatchObject({ ok: false });
    expect(host.cas("fracmod(3,13)", defaultCasSettings).result).toMatchObject({ ok: true, text: "-1/4" });
  });
});
