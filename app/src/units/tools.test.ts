// SPDX-License-Identifier: GPL-3.0-or-later
// R92: the units menu's Tools (spec/units-menu.yaml `tools`): one row per unit tool, each the unit view's own place,
// running when the view has what it needs and saying why not otherwise.
import { describe, expect, it } from "vitest";
import type { Alternative } from "./alternatives.ts";
import type { Shown } from "./result.ts";
import { unitTools, type ToolActs } from "./tools.ts";

const SI: Alternative = { slot: { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 }, text: "m/s", kind: "si" };
const MPH: Alternative = { slot: { tokens: [{ unit: "mph" }] }, text: "mph", kind: "pad" };
const result = (dimension: string, alts: readonly Alternative[]): Shown => ({
  kind: "result", text: "72", display: "72", unit: "km/h", mark: "=", markText: "=", warn: false, dimension, alts,
} as Shown);

function acts(): { acts: ToolActs; ran: string[] } {
  const ran: string[] = [];
  return { ran, acts: { end: () => void ran.push("end"), alt: (a) => void ran.push(`alt ${a.text}`), alts: () => void ran.push("alts"), home: () => void ran.push("home") } };
}
const ids = ["end", "si", "alts", "unit", "number"];

describe("the unit tools", () => {
  it("without a result: the end slot runs; the SI form, the alternatives and the number need a result; the unit alone is not built", () => {
    for (const shown of [{ kind: "none" }, { kind: "working" }, { kind: "message", text: "Units don't match" }] as Shown[]) {
      const { acts: a, ran } = acts();
      const t = unitTools(shown, a);
      expect(t.map((x) => x.id)).toEqual(ids);
      expect(t.map((x) => x.reason)).toEqual([undefined, "needs a result first", "needs a result first", "not built yet", "needs a result first"]);
      t[0]?.run?.();
      expect(ran).toEqual(["end"]);
      expect(t.slice(1).every((x) => x.run === undefined)).toBe(true);
    }
  });

  it("with a result: the SI form picks the row's SI chip, the alternatives enter the row, the number goes into Home", () => {
    const { acts: a, ran } = acts();
    const t = unitTools(result("m1s-1", [SI, MPH]), a);
    expect(t.map((x) => x.reason)).toEqual([undefined, undefined, undefined, "not built yet", undefined]);
    for (const x of t) x.run?.();
    expect(ran).toEqual(["end", "alt m/s", "alts", "home"]);
  });

  it("a result shown in its SI form already has no SI chip; a pure number has no row", () => {
    const { acts: a } = acts();
    expect(unitTools(result("m1s-1", [MPH]), a)[1]?.reason).toBe("the result is in its SI form");
    const pure = unitTools(result("", []), a);
    expect(pure.map((x) => x.reason)).toEqual([undefined, "needs a result with a unit", "needs a result with a unit", "not built yet", undefined]);
  });
});
