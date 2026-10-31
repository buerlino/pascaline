// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: one map from a hardware control key to the keypad key and layer it presses, for the entry line and the unit
// view's field (units/open.ts), so Delete is Shift + ⌫ (Del) in both (it was plain ⌫ on the unit view).
import { describe, expect, it } from "vitest";
import { controlKey, hardwareKey, type HwTarget } from "./hwkeys.ts";

const k = (key: string, shiftKey = false) => controlKey({ key, shiftKey });

describe("controlKey", () => {
  it("maps Backspace to ⌫ and Delete to Shift + ⌫ (Del)", () => {
    expect(k("Backspace")).toEqual(["bksp", "primary"]);
    expect(k("Delete")).toEqual(["bksp", "shift"]);
  });
  it("maps the arrows to the pad's arrow keys, and Shift + an arrow to none (MathLive's selection)", () => {
    expect(k("ArrowLeft")).toEqual(["left", "primary"]);
    expect(k("ArrowRight")).toEqual(["right", "primary"]);
    expect(k("ArrowUp")).toEqual(["up", "primary"]);
    expect(k("ArrowDown")).toEqual(["down", "primary"]);
    expect(k("ArrowLeft", true)).toBeUndefined();
  });
  it("maps Enter and Escape to Enter and Esc, and nothing else", () => {
    expect(k("Enter")).toEqual(["enter", "primary"]);
    expect(k("Escape")).toEqual(["esc", "primary"]);
    expect(k("Home")).toBeUndefined();
    expect(k("a")).toBeUndefined();
  });
});

describe("hardwareKey passes KeyboardEvent.repeat on (R70f1: a held key counts once, docs/04 5.2)", () => {
  const ev = (key: string, repeat: boolean) =>
    ({ key, repeat, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, getModifierState: () => false }) as unknown as KeyboardEvent;
  const target = () => {
    const keys: [string, string, boolean][] = [];
    const t: HwTarget = {
      field: {} as HwTarget["field"],
      decimalComma: false,
      run: () => {},
      onKey: (id, layer, repeat) => void keys.push([id, layer, repeat]),
      onLetter: () => {},
      onDead: () => {},
    };
    return { t, keys };
  };
  it("a first press goes on with repeat false, its auto-repeats with repeat true; each still presses the key", () => {
    const { t, keys } = target();
    expect(hardwareKey(ev("Backspace", false), t)).toBe(true);
    expect(hardwareKey(ev("Backspace", true), t)).toBe(true);
    expect(hardwareKey(ev("7", true), t)).toBe(true);
    expect(keys).toEqual([["bksp", "primary", false], ["bksp", "primary", true], ["d7", "primary", true]]);
  });
  it("a letter's repeat flag reaches onLetter", () => {
    const { t } = target();
    const letters: [string, boolean][] = [];
    t.onLetter = (ch, repeat) => void letters.push([ch, repeat]);
    hardwareKey(ev("x", false), t);
    hardwareKey(ev("x", true), t);
    expect(letters).toEqual([["x", false], ["x", true]]);
  });
});
