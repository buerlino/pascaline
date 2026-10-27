// SPDX-License-Identifier: GPL-3.0-or-later
// R82f2: every place (Home, CAS and each app) has a glyph for the status line's tile, and no two are alike.
import { describe, expect, it } from "vitest";
import { APPS, HOME_GLYPHS, placeGlyph } from "./registry.ts";

describe("place glyphs", () => {
  const places = ["home", "cas", ...APPS.map((a) => a.id)] as const;
  it("every place has a non-empty glyph", () => {
    for (const p of places) {
      const g = placeGlyph(p);
      expect("text" in g ? g.text.trim() : g.icon, p).not.toBe("");
    }
  });
  it("no two places share a glyph", () => {
    const keys = places.map((p) => JSON.stringify(placeGlyph(p)));
    expect(new Set(keys).size).toBe(places.length);
  });
  it("Home and CAS are in the same table as the apps", () => {
    expect(Object.keys(HOME_GLYPHS).sort()).toEqual(["cas", "home"]);
  });
});
