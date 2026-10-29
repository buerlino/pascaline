// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet and Settings as rows of the one sheet (docs/05 3.4): what each key does to the session.
import { beforeEach, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { modeItems, settingsSections } from "./modeSheet.ts";
import { SettingsPage } from "./settingsPage.svelte.ts";
import { Sheet, forgetPicks } from "./sheet.svelte.ts";

const memoryKv = (): Kv => {
  const data = new Map<string, unknown>();
  return { get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined), set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()) };
};
let session: Session;
let opened = 0;
const mode = (at?: string) => new Sheet("mode", "Mode", () => modeItems(session, () => opened++), { remember: false, at });
const settings = () => new SettingsPage(settingsSections(session));
const at = (p: SettingsPage, id: string) => p.rows.findIndex((r) => r.id === id);

beforeEach(() => {
  forgetPicks();
  opened = 0;
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
  it("Entry changes in place; the last row opens Settings; Decimals is no longer a Mode row", () => {
    expect(mode().level.items.some((i) => i.id === "decimals")).toBe(false);
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

describe("Settings page", () => {
  it("has one section per block and every row on one page, no submenus", () => {
    const p = settings();
    expect(p.sections.map((x) => x.id)).toEqual(["fmtCycle", "vibration", "taps"]);
    expect(p.rows.some((r) => r.submenu)).toBe(false);
    expect(p.current?.id).toBe("std");
  });
  it("Format key cycle: the Decimals row sits under the Fixed tick and steps in place", () => {
    const p = settings();
    expect(at(p, "decimals")).toBe(at(p, "fix") + 1);
    p.highlight = at(p, "decimals");
    p.step(-1);
    expect(session.settings.fixDecimals).toBe(3);
  });
  it("key vibration: ▶ switches it on; strength (the browser cannot set it) and length follow", () => {
    const p = settings();
    const byId = (id: string) => p.rows.find((i) => i.id === id);
    expect(byId("haptics")?.value).toBe("Off");
    expect(byId("ms")?.disabled).toBe(true);
    p.highlight = at(p, "haptics");
    p.step(1);
    expect(session.settings.haptics.on).toBe(true);
    expect(byId("ms")?.disabled).toBe(false);
    expect(byId("strength")?.disabled).toBe(true); // web build
    p.highlight = at(p, "ms");
    p.step(1);
    expect(session.settings.haptics.ms).toBe(20);
    expect(byId("ms")?.value).toBe("20 ms");
    p.highlight = at(p, "strength");
    expect(p.step(1)).toBe(false); // disabled: nothing happens
  });
  it("a tick toggles on Enter or a tap and the cycle is never empty", () => {
    const p = settings();
    const marked = () => p.rows.filter((i) => i.selected).map((i) => i.id);
    expect(marked()).toEqual(["std", "sci", "eng"]);
    p.activate(at(p, "fix"));
    p.activate(at(p, "sci")); // Scientific off
    expect(marked()).toEqual(["std", "eng", "fix"]);
    expect(session.settings.fmtCycle).toEqual(["std", "eng", "fix"]);
    for (const id of ["std", "eng", "fix"]) p.activate(at(p, id)); // all off: back to the default cycle
    expect(session.settings.fmtCycle).toEqual(["std", "sci", "eng"]);
  });
  it("▲ ▼ walk every row round the ends; an information row does nothing; Reset runs", () => {
    const p = settings();
    p.move(-1);
    expect(p.current?.id).toBe("reset");
    p.move(1);
    expect(p.highlight).toBe(0);
    p.activate(at(p, "since"));
    expect(p.step(1)).toBe(false);
    session.taps.counts.shift = 4;
    p.activate(at(p, "reset"));
    expect(session.taps.counts.shift).toBe(0);
  });
  it("keys: Esc closes, Menu-like keys pass, digits and letters do nothing", () => {
    const p = settings();
    expect(p.key({ kind: "back" })).toBe("close");
    expect(p.key({ kind: "pass" })).toBe("pass");
    expect(p.key({ kind: "pick", n: 3 })).toBe("stay");
    expect(p.key({ kind: "letter", ch: "a" })).toBe("stay");
  });
});
