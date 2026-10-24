// SPDX-License-Identifier: GPL-3.0-or-later
// G58: Home never hangs. The deadline for Home's own steps, and the guard on Giac's symbolic re and im (real Giac build;
// skipped when none is found, see nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { defaultHomeSettings, HOME_DEADLINE_MS, homeEval, homeSetupCommands } from "./homeEval.ts";
import { heavySplit } from "./numeric.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe("heavySplit: a root next to an integer of 13 digits or more", () => {
  it("flags the acos(120^7.5) result, not small integers or a text without a root", () => {
    expect(heavySplit("1/2*pi+i*ln(i*2*sqrt(30)*358318080000000+sqrt(1-2*sqrt(30)*358318080000000))")).toBe(true);
    expect(heavySplit("1/2*pi+i*ln(i*2*sqrt(30)*1000+sqrt(1-120000000))")).toBe(false);
    expect(heavySplit("sin(10000000000000000000000)")).toBe(false);
    expect(heavySplit("2^(1/3)*1234567890123")).toBe(true);
  });
});

describe.skipIf(!giacAvailable())("Home's deadline (real Giac)", () => {
  let giac: Awaited<ReturnType<typeof loadNodeGiac>>["giac"];
  let bridge: Awaited<ReturnType<typeof loadNodeGiac>>["bridge"];
  beforeAll(async () => {
    ({ giac, bridge } = await loadNodeGiac());
    for (const c of homeSetupCommands(defaultHomeSettings)) giac.eval(c);
  });

  it("past HOME_DEADLINE_MS after the exact steps, the input is refused with the time-out reason", () => {
    let calls = 0;
    // The first reading is the start; every later one is past the deadline.
    const now = () => (calls++ === 0 ? 0 : HOME_DEADLINE_MS + 1);
    const r = homeEval(giac, "sqrt(2)", defaultHomeSettings, now);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("timeout");
    expect(r.display).toBe(enEngine["error.timeout"]);
  });

  it("within the deadline the same input answers", () => {
    const r = homeEval(giac, "sqrt(2)", defaultHomeSettings);
    expect(r.ok).toBe(true);
    expect(r.display).toBe("1.41421356237");
  });

  it("guard (passes on phase-1): through bridge-3 (G103) acos(120^(5/2+5)) does not hang either; its split is not asked", () => {
    // Only the time: under a parallel test run Giac's own budget (0.3 s) can end the exact run, which then has no value.
    const t0 = performance.now();
    homeEval({ eval: (t) => giac.eval(t), value: (t, p) => bridge.value(t, p) }, "acos(120^(5/2+5))", defaultHomeSettings);
    expect(performance.now() - t0).toBeLessThan(HOME_DEADLINE_MS);
  });

  it("acos(120^(5/2+5)) answers: Giac's im() of its exact result looped past the interrupt", () => {
    const t0 = performance.now();
    const r = homeEval(giac, "acos(120^(5/2+5))", defaultHomeSettings);
    expect(performance.now() - t0).toBeLessThan(HOME_DEADLINE_MS);
    expect(r.ok).toBe(true);
  });
});
