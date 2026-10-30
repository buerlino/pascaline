// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet and Settings as rows of the one sheet (docs/05 3.4): what each key does to the session.
import { beforeEach, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { modeItems } from "./modeSheet.ts";
import { Sheet, forgetPicks } from "./sheet.svelte.ts";

const memoryKv = (): Kv => {
  const data = new Map<string, unknown>();
  return { get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined), set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()) };
};
let session: Session;
const mode = (at?: string) => new Sheet("mode", "Mode", () => modeItems(session), { remember: false, at });
/** Mode, 5, then the section numbered `n` (none: the Settings level). */
const settings = (n?: number): Sheet => {
  const s = mode();
  s.pickNumber(5);
  if (n !== undefined) s.pickNumber(n);
  return s;
};
const at = (s: Sheet, id: string) => s.level.items.findIndex((r) => r.id === id);
const byId = (s: Sheet, id: string) => s.level.items.find((r) => r.id === id);

beforeEach(() => {
  forgetPicks();
  session = new Session(new FakeCalc(), memoryKv());
});

describe("Mode sheet", () => {
  it("opens on Angle, shows its value, and ▶ then Enter switches RAD → DEG and closes (3 keys with Shift + Fmt)", () => {
    const s = mode();
    expect(s.level.current?.id).toBe("angle");
    expect(s.level.current?.value).toBe("Radians");
    s.right();
    expect(session.settings.angle).toBe("deg");
    expect(s.level.current?.value).toBe("Degrees");
    expect(s.enter().kind).toBe("run");
    s.right();
    expect(session.settings.angle).toBe("rad"); // DEG → RAD the same way
  });
  it("always opens on Angle, even after another row was picked last", () => {
    const s = mode();
    s.pickNumber(3); // Digits: opens its list
    expect(mode().level.current?.id).toBe("angle");
  });
  it("a status chip opens it on its row", () => {
    expect(mode("format").level.current?.id).toBe("format");
    expect(mode("digits").level.current?.id).toBe("digits");
  });
  it("Format steps Standard → Scientific → Engineering → Prefixes → round", () => {
    const s = mode("format");
    for (const f of ["sci", "eng", "pfx", "std"]) {
      s.right();
      expect(session.settings.format).toBe(f);
    }
    s.left();
    expect(session.settings.format).toBe("pfx");
  });
  it("Digits: ◀ ▶ step by one within 1…30; a digit key opens a list that marks the current value; a pick sets it (Shift + Fmt, 3, 7 = 20)", () => {
    const s = mode("digits");
    s.right();
    expect(session.settings.digits).toBe(13);
    for (let i = 0; i < 40; i++) s.right();
    expect(session.settings.digits).toBe(30);
    session.setDigits(12);
    const m = mode();
    expect(m.pickNumber(3)).toEqual({ kind: "stay" });
    expect(m.level.title).toBe("Significant digits");
    expect(m.level.current?.label).toBe("12");
    const p = m.pickNumber(7);
    expect(p.kind === "run" && p.item.label).toBe("20");
    if (p.kind === "run") p.item.run?.();
    expect(session.settings.digits).toBe(20);
  });
  it("Entry changes in place; the last row opens Settings as its submenu (R49); Decimals is no longer a Mode row", () => {
    expect(mode().level.items.some((i) => i.id === "decimals")).toBe(false);
    const e = mode("entry");
    e.right();
    expect(session.settings.entry).toBe("line");
    e.right();
    expect(session.settings.entry).toBe("textbook");
    const s = mode("settings");
    expect(s.level.current?.submenu).toBeDefined();
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.path).toBe("Mode › Settings");
  });
});

describe("Settings, a level of the sheet (R49)", () => {
  it("has the three sections built so far, in their fixed order, each with › and a value; it opens on its first row", () => {
    const s = settings();
    expect(s.level.items.map((x) => x.id)).toEqual(["numbers", "vibration", "counters"]);
    expect(s.level.items.every((x) => x.submenu)).toBe(true);
    expect(s.level.items.map((x) => x.value)).toEqual(["STD SCI ENG", "Off", "0 taps"]);
    s.pickNumber(3);
    s.back();
    s.back();
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.level.current?.id).toBe("numbers"); // not the last pick
  });
  it("a digit opens a section with the path in its title; ◀ or Esc goes back onto the same row", () => {
    const s = settings(2);
    expect(s.path).toBe("Mode › Settings › Key vibration");
    expect(s.left()).toBe(false); // the switch has no value to step: ◀ goes back
    expect(s.back()).toBe(true);
    expect(s.level.current?.id).toBe("vibration");
    s.right();
    expect(s.path).toBe("Mode › Settings › Key vibration");
  });
  it("Numbers: the cycle's five ticks, the hint under the first, and the Decimals row under the Fixed tick, stepped in place", () => {
    const s = settings(1);
    expect(s.level.items.map((x) => x.id)).toEqual(["std", "sci", "eng", "pfx", "fix", "decimals"]);
    expect(s.level.items.filter((x) => x.hint).map((x) => x.id)).toEqual(["std"]);
    s.level.highlight = at(s, "decimals");
    expect(s.left()).toBe(true);
    expect(session.settings.fixDecimals).toBe(3);
    expect(s.enter()).toEqual({ kind: "stay" }); // Enter on a value row stays in Settings
  });
  it("a tick toggles on Enter or a pick, the sheet stays, and the cycle is never empty", () => {
    const s = settings(1);
    const marked = () => s.level.items.filter((i) => i.selected).map((i) => i.id);
    expect(marked()).toEqual(["std", "sci", "eng"]);
    expect(s.activate(at(s, "fix"))).toEqual({ kind: "stay" });
    s.activate(at(s, "sci")); // Scientific off
    expect(session.settings.fmtCycle).toEqual(["std", "eng", "fix"]);
    for (const id of ["std", "eng", "fix"]) s.activate(at(s, id)); // all off: back to the default cycle
    expect(session.settings.fmtCycle).toEqual(["std", "sci", "eng"]);
  });
  it("Key vibration: the switch, then strength (the browser cannot set it), length and Try it follow", () => {
    const s = settings(2);
    expect(s.level.items.map((x) => x.id)).toEqual(["haptics", "strength", "ms", "try"]);
    expect(byId(s, "ms")?.disabled).toBe(true);
    expect(byId(s, "try")?.disabled).toBe(true);
    expect(s.pickNumber(1)).toEqual({ kind: "stay" });
    expect(session.settings.haptics.on).toBe(true);
    expect(byId(s, "haptics")?.selected).toBe(true);
    expect(byId(s, "ms")?.disabled).toBe(false);
    expect(byId(s, "strength")?.disabled).toBe(true); // web build
    s.level.highlight = at(s, "ms");
    s.right();
    expect(session.settings.haptics.ms).toBe(20);
    expect(byId(s, "ms")?.value).toBe("20 ms");
    s.level.highlight = at(s, "strength");
    s.right();
    expect(session.settings.haptics.strength).toBe(50); // disabled: nothing happens
    expect(s.pickNumber(4)).toEqual({ kind: "stay" }); // Try it
  });
  it("Counters: ▲ ▼ walk round the ends; an information row does nothing; Reset runs and stays", () => {
    const s = settings(3);
    s.level.move(-1);
    expect(s.level.current?.id).toBe("reset");
    s.level.move(1);
    expect(s.level.current?.id).toBe("shift");
    expect(s.activate(at(s, "since"))).toEqual({ kind: "stay" });
    session.taps.counts.shift = 4;
    expect(s.activate(at(s, "reset"))).toEqual({ kind: "stay" });
    expect(session.taps.counts.shift).toBe(0);
  });
});
