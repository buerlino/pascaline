// SPDX-License-Identifier: GPL-3.0-or-later
// R61: EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts): a chip with σ in Home.
// Its own file because host.test.ts is at its line in tools/line-baseline.yaml.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { decimalFromString, markOf, type FormatOptions } from "./format.ts";
import { uncDigitsOf } from "./constUnc.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("EngineHost (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });

// R61 (r17 section 2): a unit result's chip with σ is an independent input of σ, as a constant (G26). t10's chip:
// 4936/125 m² with σ 1.24432953835 (tasks.yaml t10, first order, derived).
describe("a chip with σ (R61)", () => {
  const t10 = { value: "4936/125", reliableDigits: null, exact: false, unc: "1.24432953835" };
  const { unc: _u, ...plain } = t10;
  const G = { value: "6.67430E-11", unc: "0.00015E-11" };
  const home = (i: string, chips: Parameters<EngineHost["home"]>[3], consts?: Parameters<EngineHost["home"]>[2]) => host.home(i, defaultHomeSettings, consts, chips).result;
  const dec = (t: string) => decimalFromString(t)!;
  const o: FormatOptions = { format: "STD", digits: 12 };

  it("chip × 2: 78.976 ± 2.4886590767 (linear, derived), ≈ with uncDigits, never =", () => {
    const r = home("pasr_1*2", { "1": t10 });
    expect(r.display).toBe("78.976");
    expect(r.facts.uncDigits).toBe(uncDigitsOf(dec("78.976"), dec("2.4886590767"), 12));
    expect(markOf(precisionFacts(r), o)?.mark).toBe("≈");
  });

  it("chip + G·6.65E15: both σ counted in quadrature (derived)", () => {
    // 39.488 + 443840.95 = 443880.438; σ = sqrt(1.24432953835² + (1.5E-15·6.65E15)²) = sqrt(1.5483560 + 99.500625)
    // = 10.0523 (exponent 1), where either σ alone is below 10 (exponent 0): 4 digits hold, 5 with either alone
    const r = home("pasr_1+pasc_G*6.65E15", { "1": t10 }, { G });
    expect(r.display).toBe("443880.438");
    expect(r.facts.uncDigits).toBe(uncDigitsOf(dec("443880.438"), dec("10.0523"), 12));
    expect(r.facts.uncDigits).toBe(4);
    expect(home("pasr_1+pasc_G*6.65E15", { "1": plain }, { G }).facts.uncDigits).toBe(5);
  });

  it("a chip without unc keeps G49's path: the same result and facts, without uncDigits", () => {
    const same = (r: ReturnType<typeof home>) => ({ ...r, exactMs: 0, totalMs: 0 });
    const a = home("pasr_1*2", { "1": plain });
    expect("uncDigits" in a.facts).toBe(false);
    const b = home("pasr_1*2", { "1": t10 });
    const { uncDigits: d, ...withoutUnc } = b.facts;
    expect(d).toBe(1); // a stub that drops unc fails here
    expect(same(a)).toEqual(same({ ...b, facts: withoutUnc }));
    // a σ of 0 is no uncertain input, as a constant's (G26)
    expect("uncDigits" in home("pasr_1*2", { "1": { ...t10, unc: "0" } }).facts).toBe(false);
  });

  it("an exact chip that says it has σ is still not exact: never =", () => {
    const r = home("pasr_1*2", { "1": { ...t10, exact: true } });
    expect(markOf(precisionFacts(r), o)?.mark).not.toBe("=");
    expect(r.facts.uncDigits).toBe(1);
  });
});
});
