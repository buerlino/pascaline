// SPDX-License-Identifier: GPL-3.0-or-later
// R108: an app's numbers go through the decimal comma as Home's do (commaResult): the mark for the point between digits,
// `;` for the commas that separated elements. With the setting off nothing changes.
import { describe, expect, it } from "vitest";
import type { AppHost } from "./types.ts";
import { SolveApp } from "./solve/app.svelte.ts";

const make = (decimalComma: boolean | undefined): SolveApp => {
  const settings = { digits: 12, angle: "rad", format: "std" };
  const h = { settings: { ...settings, ...(decimalComma === undefined ? {} : { decimalMark: decimalComma ? "comma" : "point" }) }, kv: { get: async () => undefined, set: async () => undefined }, userNames: [], setEntry: () => undefined, copy: () => undefined };
  return new SolveApp(h as unknown as AppHost);
};

describe("R108: Solve draws with the host's decimal mark", () => {
  it("comma: roots, values and element separators", () => {
    const app = make(true);
    expect(app.mark("-0.727136084491+0.43001428833*i")).toBe("-0,727136084491+0,43001428833*i");
    expect(app.mark("{1.5,2.5}")).toBe("{1,5;2,5}");
    app.values = { x: "1.41421356237" };
    expect(app.fmtValue("x")).toBe("1,41421356237");
  });
  it("point or unset: unchanged", () => {
    for (const on of [false, undefined]) {
      const app = make(on);
      expect(app.mark("{1.5,2.5}")).toBe("{1.5,2.5}");
      app.values = { x: "1.41421356237" };
      expect(app.fmtValue("x")).toBe("1.41421356237");
    }
  });
});
