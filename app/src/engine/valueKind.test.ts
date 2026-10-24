// SPDX-License-Identifier: GPL-3.0-or-later
// G103 (backlog F73): Home reads a value's kind, num/den and elements from bridge-3 (giac_value), not from Giac's print.
// Each case is one the text readers missed (G85's probe, tools/probes/bridge.ts) and fails on phase-1; the kind each
// test names is the one giac_value gives (checked first). Expected values are derived (exact arithmetic, Giac's types).
// Skipped when no engine build is found (nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, homeEval } from "./homeEval.ts";
import type { GiacBridge } from "./bridge.ts";
import type { Giac } from "./numeric.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("G103: a value's kind from bridge-3 (F73)", () => {
  let host: EngineHost;
  let bridge: GiacBridge;
  /** A raw engine with no mode setup: a setting it is given stays (the host puts Giac's settings back after an input). */
  let raw: Giac & { eval(t: string): string };
  beforeAll(async () => {
    host = await nodeHost();
    const L = await loadNodeGiac();
    bridge = L.bridge;
    raw = { eval: (t) => L.giac.eval(t), value: (t, p) => L.bridge.value(t, p) };
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;

  it("a float printed without a point is a float: trunc(sin(10^50)*10^12,0) is not exact (derived: Giac's two-argument trunc works in a double, G71)", () => {
    expect(bridge.value("trunc(sin(10^50)*10^12,0)", []).kind).toBe("float");
    const r = home("trunc(sin(10^50)*10^12,0)");
    expect(r.display).toBe("595872309788");
    expect(r.facts.exact).toBe(false);
    expect(r.rational).toBeUndefined();
    expect(r.facts.warn).toBe("unaudited");
  });

  it("a boolean in a list stays a boolean: [1==1,2] is Giac's list [true,2], not the numbers [1,2]", () => {
    const v = bridge.value("[1==1,2]", [40]);
    expect([v.kind, v.elements]).toEqual(["list", ["true", "2"]]);
    const r = home("[1==1,2]");
    expect(r.display).toBe("[true,2]");
    expect(r.items).toBeUndefined();
  });

  it("an integer under integer_format(16) is an integer: 255 is exactly 255, though Giac prints 0xFF", () => {
    raw.eval("integer_format(16)");
    try {
      const v = bridge.value("255", []);
      expect([v.kind, v.text, v.num, v.den]).toEqual(["integer", "0xFF", "255", "1"]);
      const r = homeEval(raw, "255", defaultHomeSettings);
      expect([r.display, r.facts.exact]).toEqual(["255", true]);
    } finally {
      raw.eval("integer_format(10)");
    }
  });

  it("an Integer_too_large_for_display print is an integer: 10^1000000+7 is exact, shown from its digits, with no such text as its exact form", () => {
    // 10^1000000 as 25 factors 10^40000 (each under the power limit), on the raw engine (no time budget): 1000001 digits,
    // past Giac's print limit
    const big = `${Array.from({ length: 25 }, () => "10^40000").join("*")}+7`;
    // a clock that stands still: under a parallel test run the exact steps can pass HOME_DEADLINE_MS (G58), not tested here
    const r = homeEval(raw, big, defaultHomeSettings, () => 0);
    // derived: 10^1000000+7 to 12 significant digits is 1.00000000000E1000000, shown without its trailing zeros
    expect([r.display, r.facts.exact, r.path, r.exact]).toEqual(["1E1000000", true, "exact-big", undefined]);
    expect(r.full).not.toContain("Integer_too_large");
  });

  it("guard (passes on phase-1): a symbolic quotient 1/(1+i) is kind symbolic, its value exact 1/2-1/2*i from its parts", () => {
    expect(bridge.value("1/(1+i)", []).kind).toBe("symbolic");
    const r = home("1/(1+i)");
    expect([r.display, r.facts.exact]).toEqual(["0.5-0.5*i", true]);
  });
});
