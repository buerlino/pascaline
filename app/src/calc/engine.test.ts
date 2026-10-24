// SPDX-License-Identifier: GPL-3.0-or-later
// G76: the Calc port carries a result's facts whole. The real EngineHost runs behind a MathEngine stand-in (as
// tools/probes/carriers.ts does), so what the views get is what the engine said. Expected facts: the engine's own
// (host.test.ts and precision.test.ts derive them); the rational rule is the one the port's text check had.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineCalc, CAS_KEYS, HOME_KEYS, type PortChecks, type PortKeys, type SameKeys, type Passed } from "./engine.ts";
import type { CalcSettings, CasOutcome, HomeOutcome } from "./port.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import type { CasResult, ConstTable, HomeResult, MathEngine, ValueFacts } from "../engine/types.ts";

// --- Type tests (run by typecheck) -------------------------------------------------------------------------------

// Every key of HomeResult and CasResult is listed: passed, or dropped with its reason.
const homeKeys: PortKeys<HomeResult> = HOME_KEYS;
const casKeys: PortKeys<CasResult> = CAS_KEYS;
// A key added to HomeResult or CasResult fails to compile until the port lists it.
// @ts-expect-error newFact is not in HOME_KEYS
const homeNew: PortKeys<HomeResult & { newFact: number }> = HOME_KEYS;
// @ts-expect-error newFact is not in CAS_KEYS
const casNew: PortKeys<CasResult & { newFact: number }> = CAS_KEYS;
// Every passed key is an outcome key, and every outcome key is passed (or `exact`, which the port gives itself).
const checks: PortChecks = [true, true];
// @ts-expect-error an outcome key the port never fills
const outcomeNew: SameKeys<Passed<HomeResult, typeof HOME_KEYS> | "exact", keyof (HomeOutcome & { newFact: number })> = true;
// The facts the views get are ValueFacts, whole.
const homeFacts: ValueFacts = {} as HomeOutcome["facts"];
const casFacts: ValueFacts = {} as CasOutcome["facts"];
void [homeKeys, casKeys, homeNew, casNew, checks, outcomeNew, homeFacts, casFacts];

// --- The port on the real engine ----------------------------------------------------------------------------------

const settings: CalcSettings = { digits: 12, angle: "rad", format: "std" };
// G: CODATA 2018 value and standard uncertainty, as the constants table sends them (host.test.ts G26).
const G: ConstTable = { G: { value: "6.67430E-11", unc: "0.00015E-11" } };

describe.skipIf(!giacAvailable())("EngineCalc passes a result's facts whole (G76, real Giac)", () => {
  let calc: EngineCalc;
  beforeAll(async () => {
    const host = (await nodeHost());
    // The stand-in sends the constants table the port does not hold yet, so a result can carry uncDigits.
    const stand = {
      home: async (i: string, s: Parameters<EngineHost["home"]>[1], _c?: ConstTable, ch?: Parameters<EngineHost["home"]>[3]) => host.home(i, s, G, ch).result,
      cas: async (i: string, s: Parameters<EngineHost["cas"]>[1]) => host.cas(i, s).result,
    } as unknown as MathEngine;
    calc = new EngineCalc(stand);
  });

  it("why reaches the view: an unaudited function's float, and a CAS non-number that was not compared", async () => {
    expect((await calc.home("romberg(exp(-x^2),x,0,1)", settings)).facts).toMatchObject({ warn: "unaudited", why: { unaudited: ["romberg"] } });
    expect((await calc.cas("evalf(x-0.54764225985)", settings)).facts).toMatchObject({ warn: "unchecked", why: { once: true } });
  });

  it("uncDigits reaches the view: G·5.972ᴇ24 holds 5 digits (derived in host.test.ts)", async () => {
    expect((await calc.home("pasc_G*5.972E24", settings)).facts.uncDigits).toBe(5);
  });

  it("the exact text reaches the view when the engine says it is a plain rational", async () => {
    expect((await calc.home("1/3", settings)).exact).toBe("1/3");
    expect((await calc.home("-7/3", settings)).exact).toBe("-7/3");
    expect((await calc.home("2^200", settings)).exact).toBe((2n ** 200n).toString());
    expect((await calc.home("sqrt(2)", settings)).exact).toBeUndefined();
    expect((await calc.home("1+2*i", settings)).exact).toBeUndefined();
    expect((await calc.home("[1/3,1/4]", settings)).exact).toBeUndefined();
    // more than 200 digits: not offered to the fraction modes (the old text check's bound)
    expect((await calc.home("10^200", settings)).exact).toBeUndefined();
    expect((await calc.home("10^199", settings)).exact).toBe((10n ** 199n).toString());
  });

  it("the keys the port lists as dropped are not in the outcome; the others are as the engine set them", async () => {
    const r = await calc.home("romberg(exp(-x^2),x,0,1)", settings);
    for (const [k, v] of Object.entries(HOME_KEYS)) if (v !== "pass" && k !== "exact") expect(r, k).not.toHaveProperty(k);
    expect(Object.keys(r).sort()).toEqual(["approximate", "display", "facts", "full", "ok", "value"]);
  });
});
