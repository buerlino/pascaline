// SPDX-License-Identifier: GPL-3.0-or-later
// G153 (F155): Home's double fallback (numeric.ts doubleFallback) runs when the exact result has no MPFR value to check.
// When MPFR has a number at P and none at P+20, the precision decides whether there is a value at all (a cancellation),
// and the double, which cancels more, confirms no digit: ⚠ without a count. Before, it carried min(digits, 14):
// ln(ln((10^1003+89999)/(10^1003-89999))/2) showed ⚠ 14 -70.007865236555+3.1415926535898*i at 30 digits (derived: the
// inner ln(…)/2 is atanh(89999/10^1003) ≈ 9E-999, so the value is about -2298.085, real). A function with no MPFR path
// (BesselJ(1,2) at 30 digits, Giac's double at every precision) keeps its count.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultHomeSettings } from "./homeEval.ts";

describe.skipIf(!giacAvailable())("G153: a double fallback after a cancellation has no count", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  const home = (input: string, digits: number) => host.home(input, { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) }).result;

  it.each([12, 30])("ln of the cancelling ln form of atanh(89999/10^1003) at %i digits", (digits) => {
    const r = home("ln(ln((10^1003+89999)/(10^1003-89999))/2)", digits);
    expect(r.ok).toBe(true);
    expect(r.facts?.reliableDigits).toBeNull();
    expect(r.facts?.warn).toBe("unchecked");
  });

  it("BesselJ(1,2) at 30 digits keeps the double's count (no MPFR path)", () => {
    const r = home("BesselJ(1,2)", 30);
    expect(r.ok).toBe(true);
    expect(r.facts?.reliableDigits).toBe(14);
  });
});
