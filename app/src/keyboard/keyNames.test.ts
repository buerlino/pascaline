// SPDX-License-Identifier: GPL-3.0-or-later
// R41: every key and layer of spec/keyboard.yaml has a spoken name in the i18n table (TalkBack reads the button's
// aria-label and aria-description, never the glyphs "sin⁻¹" or "ᴇ"). English only.
import { describe, expect, it } from "vitest";
import { enKeyNames } from "../i18n/enKeyNames.ts";
import { keyboard, type Key, type Layer } from "./keyboard.ts";
import { hasLayer, keyLabels, layerName } from "./keyNames.ts";

const LETTER = /^[A-Z]$/;
const layers = (k: Key): Layer[] => (["primary", "shift", "alpha"] as const).filter((l) => hasLayer(k, l));

describe("key names (R41)", () => {
  it("every key has a name for its tap, and for each Shift and Alpha layer it has", () => {
    for (const k of keyboard.keys)
      for (const l of layers(k)) {
        const n = layerName(k, l, false);
        expect(n, `${k.id} ${l}`).toBeTruthy();
        // a spoken name is words, not the glyph on the key (an Alpha letter is its own name)
        if (!(l === "alpha" && LETTER.test(n ?? ""))) expect(n, `${k.id} ${l}`).not.toBe(k.label[l]);
      }
  });

  it("the table holds an entry for every key and layer, and nothing else", () => {
    const want = new Set<string>(["layer.shift", "layer.alpha"]);
    for (const k of keyboard.keys)
      for (const l of layers(k)) {
        if (l === "primary") want.add(k.id);
        else if (l === "shift") want.add(`${k.id}.shift`);
        else if (!LETTER.test(k.label.alpha ?? "")) want.add(`${k.id}.alpha`);
      }
    expect(Object.keys(enKeyNames).sort()).toEqual([...want].sort());
  });

  it("names the examples of the package", () => {
    const k = (id: string) => keyboard.byId.get(id) as Key;
    expect(layerName(k("sin"), "primary", false)).toBe("sine");
    expect(layerName(k("sin"), "shift", false)).toBe("arc sine");
    expect(layerName(k("div"), "shift", false)).toBe("x to the minus one");
    expect(layerName(k("emark"), "primary", false)).toBe("E for the exponent");
    expect(layerName(k("shift"), "primary", false)).toBe("Shift");
  });

  it("the label is the layer a tap gives now, the description the other layers", () => {
    const sin = keyboard.byId.get("sin") as Key;
    expect(keyLabels(sin, false, false, false)).toEqual({ label: "sine", description: "Shift: arc sine. Alpha: G" });
    expect(keyLabels(sin, true, false, false)).toEqual({ label: "arc sine", description: "Alpha: G" });
    expect(keyLabels(sin, false, true, false)).toEqual({ label: "G", description: "Shift: arc sine" });
    const shift = keyboard.byId.get("shift") as Key;
    expect(keyLabels(shift, false, false, false)).toEqual({ label: "Shift", description: "" });
  });

  it("an Alpha letter follows the case the view types (R58)", () => {
    const sin = keyboard.byId.get("sin") as Key;
    expect(keyLabels(sin, false, true, true).label).toBe("g");
    expect(keyLabels(sin, true, true, false).label).toBe("g");
    expect(keyLabels(sin, false, false, true).description).toBe("Shift: arc sine. Alpha: g");
  });

  it("a key whose face the app changed (a user key, the decimal comma) is named by its own face", () => {
    const dot = keyboard.byId.get("dot") as Key;
    const comma: Key = { ...dot, label: { ...dot.label, primary: "," } };
    expect(keyLabels(comma, false, false, false)).toEqual({ label: ",", description: "Shift: Equals" });
    const u1 = keyboard.byId.get("u1") as Key;
    expect(keyLabels(u1, false, false, false)).toEqual({ label: "Free key 1", description: "" });
    const set: Key = { ...u1, label: { primary: "kN" }, actions: { primary: { kind: "type", text: "kN" } } };
    expect(keyLabels(set, false, false, false)).toEqual({ label: "kN", description: "" });
  });
});
