// SPDX-License-Identifier: GPL-3.0-or-later
// R84: the apps list shows each place's glyph beside its name; other lists have none; numbers and picks are unchanged.
import { beforeEach, describe, expect, it } from "vitest";
import type { Calc, CalcSettings } from "../calc/port.ts";
import { forgetPicks } from "../views/sheet.svelte.ts";
import { placeGlyph } from "./registry.ts";
import { AppShell } from "./shell.svelte.ts";

const settings: CalcSettings = { digits: 12, angle: "rad", format: "std" };
const kv = { get: async () => undefined, set: async () => undefined };
const line = { value: "", set() {}, clear() {} };

describe("R84 glyphs in the apps list", () => {
  beforeEach(() => forgetPicks());

  it("every row carries its place's glyph, in order", () => {
    const s = new AppShell({} as Calc, kv, line, () => settings);
    s.toggleApps();
    const items = s.sheet?.level.items ?? [];
    expect(items.map((i) => i.id)).toEqual(["home", "cas", "function", "solve"]);
    for (const i of items) expect(i.glyph).toEqual(placeGlyph(i.id as "home"));
  });

  it("a digit still picks the row", () => {
    const s = new AppShell({} as Calc, kv, line, () => settings);
    const seen: string[] = [];
    s.goTo = (v) => seen.push(v);
    s.toggleApps();
    expect(s.pick(2)).toBe(true);
    expect(seen).toEqual(["cas"]);
  });

  it("other lists have no glyph", () => {
    const s = new AppShell({} as Calc, kv, line, () => settings);
    s.showMenu("x", [{ id: "a", label: "A" }]);
    expect(s.sheet?.level.items.every((i) => i.glyph === undefined)).toBe(true);
  });
});
