// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: one map from a hardware control key to the keypad key and layer it presses, for the entry line and the unit
// view's field (units/open.ts), so Delete is Shift + ⌫ (Del) in both (it was plain ⌫ on the unit view).
import { describe, expect, it } from "vitest";
import { controlKey, hardwareKey, undoKey, type HwTarget } from "./hwkeys.ts";

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

describe("undoKey (R119): Ctrl+Z is the Undo key, Ctrl+Y and Ctrl+Shift+Z the Redo key", () => {
  const u = (key: string, m: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = { ctrl: true }) =>
    undoKey({ key, ctrlKey: m.ctrl ?? false, metaKey: m.meta ?? false, altKey: m.alt ?? false, shiftKey: m.shift ?? false });
  it("maps the three combinations (and Cmd for Ctrl) to the Undo and Redo keys (R146: Redo is a key of its own)", () => {
    expect(u("z")).toBe("undo");
    expect(u("Z", { ctrl: true, shift: true })).toBe("redo");
    expect(u("y")).toBe("redo");
    expect(u("z", { meta: true })).toBe("undo");
  });
  it("leaves every other combination alone", () => {
    expect(u("z", {})).toBeUndefined();
    expect(u("z", { ctrl: true, alt: true })).toBeUndefined();
    expect(u("Y", { ctrl: true, shift: true })).toBeUndefined();
    expect(u("a")).toBeUndefined();
    expect(u("c")).toBeUndefined();
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
      onSymbol: () => {},
      onKey: (id, layer, repeat) => void keys.push([id, layer, repeat]),
      onLetter: () => {},
      onDead: () => {},
      onPress: () => {},
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
  it("Ctrl+Z presses Undo, Ctrl+Y and Ctrl+Shift+Z press Redo, both on their tap layer (R146)", () => {
    const { t, keys } = target();
    const ctrl = (key: string, shiftKey: boolean) => ({ ...ev(key, false), ctrlKey: true, shiftKey }) as unknown as KeyboardEvent;
    for (const [key, sh] of [["z", false], ["y", false], ["Z", true]] as const) expect(hardwareKey(ctrl(key, sh), t)).toBe(true);
    expect(keys).toEqual([["undo", "primary", false], ["redo", "primary", false], ["redo", "primary", false]]);
  });
  it("a letter's repeat flag reaches onLetter", () => {
    const { t } = target();
    const letters: [string, boolean][] = [];
    t.onLetter = (ch, repeat) => void letters.push([ch, repeat]);
    hardwareKey(ev("x", false), t);
    hardwareKey(ev("x", true), t);
    expect(letters).toEqual([["x", false], ["x", true]]);
  });
  it("a palette symbol (< > !) goes to onSymbol with the repeat flag, and nothing else runs", () => {
    const { t, keys } = target();
    const symbols: [string, boolean][] = [];
    t.onSymbol = (ch, repeat) => void symbols.push([ch, repeat]);
    for (const ch of ["<", ">", "!"]) hardwareKey(ev(ch, false), t);
    hardwareKey(ev("<", true), t);
    expect(symbols).toEqual([["<", false], [">", false], ["!", false], ["<", true]]);
    expect(keys).toEqual([]);
  });
  it("a dead key's repeat flag reaches onDead", () => {
    const { t } = target();
    const dead: boolean[] = [];
    t.onDead = (repeat) => void dead.push(repeat);
    hardwareKey(ev("$", false), t);
    hardwareKey(ev("$", true), t);
    expect(dead).toEqual([false, true]);
  });
});
