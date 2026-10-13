// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet and Settings as rows of the one sheet (docs/05 3.4): what each key does to the session.
import { beforeEach, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { modeItems, settingsItems } from "./modeSheet.ts";
import { Sheet, forgetPicks } from "./sheet.svelte.ts";

const memoryKv = (): Kv => {
  const data = new Map<string, unknown>();
  return { get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined), set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()) };
};
let session: Session;
let opened = 0;
const mode = (at?: string) => new Sheet("mode", "Mode", () => modeItems(session, () => opened++), { remember: false, at });
const settings = () => new Sheet("settings", "Settings", () => settingsItems(session), { remember: false });

beforeEach(() => {
  forgetPicks();
  opened = 0;
  session = new Session(new FakeCalc(), memoryKv());
});

describe("Mode sheet", () => {
  it("opens on Angle, shows its value, and ▶ then Enter switches RAD → DEG and closes (3 keys with Shift + CAS)", () => {
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
  it("Digits: ◀ ▶ step by one within 1…30; a digit key opens a list that marks the current value; a pick sets it (Shift + CAS, 3, 7 = 20)", () => {
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
  it("Decimals and Entry change in place; the last row opens Settings", () => {
    const s = mode("decimals");
    s.left();
    expect(session.settings.fixDecimals).toBe(3);
    const e = mode("entry");
    e.right();
    expect(session.settings.entry).toBe("line");
    e.right();
    expect(session.settings.entry).toBe("textbook");
    const last = mode("settings").enter();
    if (last.kind === "run") last.item.run?.();
    expect(opened).toBe(1);
  });
});

describe("Settings sheet", () => {
  it("key vibration: ▶ switches it on; strength (the browser cannot set it) and length follow", () => {
    const s = settings();
    const byId = (id: string) => s.level.items.find((i) => i.id === id);
    expect(byId("haptics")?.value).toBe("Off");
    expect(byId("ms")?.disabled).toBe(true);
    s.level.move(1);
    expect(s.level.current?.id).toBe("haptics");
    s.right();
    expect(session.settings.haptics.on).toBe(true);
    expect(byId("ms")?.disabled).toBe(false);
    expect(byId("strength")?.disabled).toBe(true); // web build
    s.level.move(1);
    s.level.move(1);
    s.right();
    expect(session.settings.haptics.ms).toBe(20);
    expect(byId("ms")?.value).toBe("20 ms");
  });
  it("the Format key cycle: picking a form ticks or unticks it, the sheet stays, and the cycle is never empty", () => {
    const s = settings();
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.level.title).toBe("Format key cycle");
    const marked = () => s.level.items.filter((i) => i.selected).map((i) => i.id);
    expect(marked()).toEqual(["std", "sci", "eng"]);
    s.pickNumber(5); // Fixed
    s.pickNumber(2); // Scientific off
    expect(marked()).toEqual(["std", "eng", "fix"]);
    expect(session.settings.fmtCycle).toEqual(["std", "eng", "fix"]);
    for (const n of [1, 3, 5]) s.pickNumber(n); // all off: back to the default cycle
    expect(session.settings.fmtCycle).toEqual(["std", "sci", "eng"]);
    expect(s.depth).toBe(2);
  });
});
