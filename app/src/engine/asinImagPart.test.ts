// SPDX-License-Identifier: GPL-3.0-or-later
// G133f1 (patch 0023): asin(i*y) for a real y, and asinh(i*y) for a real y with |y| < 1, are purely imaginary (derived:
// asin(i*y) = i*asinh(y), asinh(i*y) = i*asin(y)). Patch 0020's ln form left its rounding in the real part, and the CAS
// view showed it: evalf(asinh(i/10)) was -1.18694596822E-66+0.100167421162*i. The values themselves are golden cases
// (precision.yaml g133f1-*); this loop keeps the whole family covered: no real part, at 12 and 30 digits, both signs.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";

const KS = ["3", "5", "7", "10", "10^5", "10^12", "10^20", "10^30"];
// A number times i, nothing before it: the text of a value whose real part is 0.
const PURELY_IMAGINARY = /^-?\d+(\.\d+)?(E-?\d+)?\*i$/;

describe.skipIf(!giacAvailable())("G133f1: CAS evalf of asin(i/k) and asinh(i/k) has no real part", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  it("for k = 3 … 10^30, both signs, at 12 and 30 digits", () => {
    const bad: string[] = [];
    for (const f of ["asin", "asinh"])
      for (const k of KS)
        for (const sign of ["", "-"])
          for (const digits of [12, 30]) {
            const input = `evalf(${f}(${sign}i/${k}))`;
            const r = host.cas(input, { ...defaultCasSettings, digits }).result;
            if (!r.ok || !PURELY_IMAGINARY.test(r.text ?? "")) bad.push(`${input} at ${digits}: ${r.ok ? r.text : JSON.stringify(r)}`);
          }
    expect(bad).toEqual([]);
  });
});
