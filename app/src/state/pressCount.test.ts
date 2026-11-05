// SPDX-License-Identifier: GPL-3.0-or-later
// What counts as one press (R70; docs/04 section 5.2): a key tap, a flick, a drag on the trackpad, a tap on the screen.
import { describe, expect, it } from "vitest";
import { counted, HW_KINDS, hwKind, isScreenTap, screenKind, touchKey, touchPresses } from "./pressCount.ts";

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

describe("a hardware key (docs/04 5.2, R70f1)", () => {
  /** A counted handler, as App.svelte sets entry.onKey, with what it counted and what it ran. */
  const hook = () => {
    let presses = 0;
    const ran: [string, string][] = [];
    const onKey = counted(() => presses++, (id: string, layer: string) => void ran.push([id, layer]));
    return { onKey, ran, presses: () => presses };
  };
  it("a press (KeyboardEvent.repeat false) counts 1 and runs the key", () => {
    const h = hook();
    h.onKey("d7", "primary", false);
    expect(h.presses()).toBe(1);
    expect(h.ran).toEqual([["d7", "primary"]]);
  });
  it("a held key's auto-repeats (repeat true) run the key again but count nothing: a held key counts once", () => {
    const h = hook();
    h.onKey("bksp", "primary", false);
    h.onKey("bksp", "primary", true);
    h.onKey("bksp", "primary", true);
    expect(h.presses()).toBe(1);
    expect(h.ran).toEqual([["bksp", "primary"], ["bksp", "primary"], ["bksp", "primary"]]);
  });
  it("Enter and Escape alike: the handler takes only the repeat flag", () => {
    let presses = 0;
    let runs = 0;
    const onEnter = counted(() => presses++, () => void runs++);
    onEnter(false);
    onEnter(true);
    expect([presses, runs]).toEqual([1, 2]);
  });
});

describe("which key and layer a press was (R127)", () => {
  const k = { id: "sin" };
  const plain = { shift: false, alpha: false };
  it("a tap is the key in the layer the pad shows: primary, Shift, or Alpha over Shift", () => {
    expect(touchKey({ kind: "key", key: k, flick: { state: "tap" } }, plain)).toBe("sin:primary");
    expect(touchKey({ kind: "key", key: k, flick: { state: "tap" } }, { shift: true, alpha: false })).toBe("sin:shift");
    expect(touchKey({ kind: "key", key: k, flick: { state: "tap" } }, { shift: true, alpha: true })).toBe("sin:alpha");
  });
  it("a flick is up or down whatever the layer", () => {
    expect(touchKey({ kind: "key", key: k, flick: { state: "up" } }, { shift: false, alpha: true })).toBe("sin:up");
    expect(touchKey({ kind: "key", key: k, flick: { state: "down" } }, plain)).toBe("sin:down");
  });
  it("a trackpad drag is one press of the trackpad; a tap on a pad zone is that key", () => {
    expect(touchKey({ kind: "pad", key: undefined, steps: { count: 3 } }, plain)).toBe("trackpad:drag");
    expect(touchKey({ kind: "pad", key: { id: "left" }, steps: { count: 2 } }, plain)).toBe("trackpad:drag");
    expect(touchKey({ kind: "pad", key: { id: "left" }, steps: { count: 0 } }, plain)).toBe("left:primary");
  });
  it("what touchPresses counts nothing for has no name", () => {
    expect(touchKey({ kind: "key", key: k, flick: { state: "cancelled" } }, plain)).toBeUndefined();
    expect(touchKey({ kind: "key", key: undefined, flick: { state: "tap" } }, plain)).toBeUndefined();
    expect(touchKey({ kind: "pad", key: undefined, steps: { count: 0 } }, plain)).toBeUndefined();
    expect(touchKey({ kind: "repeat" }, plain)).toBeUndefined();
  });
  it("a screen tap is named by the row's count kind (R92; a plain menu row: row), else button", () => {
    const hit = (m: Record<string, unknown>) => ({ closest: (sel: string) => m[sel] ?? null });
    expect(screenKind(hit({ "[data-count]": { dataset: { count: "units-const" } } }))).toBe("screen:units-const");
    expect(screenKind(hit({ "[data-count]": { dataset: { count: "row" } } }))).toBe("screen:row");
    expect(screenKind(hit({ button: {} }))).toBe("screen:button");
  });
  it("counted() hands the hardware key's own arguments to the counter", () => {
    const seen: string[] = [];
    const f = counted((...[id, layer]: [string, string]) => void seen.push(`${id}:hw${layer}`), (_id: string, _layer: string) => {});
    f("d7", "primary", false);
    f("d7", "primary", true); // an auto-repeat counts nothing
    expect(seen).toEqual(["d7:hwprimary"]);
  });
  it("a hardware key that is no keypad key is named hw:<kind>, never a key id (R127)", () => {
    expect(HW_KINDS.map(hwKind)).toEqual(["hw:letter", "hw:symbol", "hw:dead", "hw:other"]);
  });
});
