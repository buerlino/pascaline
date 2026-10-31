// SPDX-License-Identifier: GPL-3.0-or-later
// What counts as one press (R70; docs/04 section 5.2): a key tap, a flick, a drag on the trackpad, a tap on the screen.
import { describe, expect, it } from "vitest";
import { isScreenTap, touchPresses } from "./pressCount.ts";

const key = {};
/** A stand-in element that answers `closest` for the selectors it is given. */
const el = (...inside: string[]) => ({ closest: (sel: string) => (inside.some((s) => sel.includes(s)) ? {} : null) });

describe("a touch on the keypad (docs/04 5.2)", () => {
  it("a key tap counts 1", () => expect(touchPresses({ kind: "key", key, flick: { state: "tap" } })).toBe(1));
  it("a flick up or down counts 1, lock flicks included", () => {
    expect(touchPresses({ kind: "key", key, flick: { state: "up" } })).toBe(1);
    expect(touchPresses({ kind: "key", key, flick: { state: "down" } })).toBe(1);
  });
  it("a cancelled touch, or a touch between keys, counts nothing", () => {
    expect(touchPresses({ kind: "key", key, flick: { state: "cancelled" } })).toBe(0);
    expect(touchPresses({ kind: "key", key: undefined, flick: { state: "tap" } })).toBe(0);
  });
  it("a trackpad drag counts 1 however many steps it takes; a tap on a pad zone counts 1; an empty touch nothing", () => {
    expect(touchPresses({ kind: "pad", key: undefined, steps: { count: 7 } })).toBe(1);
    expect(touchPresses({ kind: "pad", key, steps: { count: 0 } })).toBe(1);
    expect(touchPresses({ kind: "pad", key: undefined, steps: { count: 0 } })).toBe(0);
  });
  it("a held ⌫ is counted when it goes down, not by its repeats", () => expect(touchPresses({ kind: "repeat" })).toBe(0));
});

describe("a tap on the screen (docs/04 5.2)", () => {
  it("a button, a menu row or a chip counts 1", () => {
    expect(isScreenTap(el("button"))).toBe(true);
    expect(isScreenTap(el("[role=menuitem]"))).toBe(true);
  });
  it("a key of the keypad is counted by its own gesture, not twice", () => expect(isScreenTap(el("button", "[data-key]"))).toBe(false));
  it("text, or nothing, is not a press", () => {
    expect(isScreenTap(el())).toBe(false);
    expect(isScreenTap(null)).toBe(false);
  });
});
