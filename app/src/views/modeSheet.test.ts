// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet and Settings as rows of the one sheet (docs/05 3.4): what each key does to the session.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { UserKeys } from "../keyboard/userKeys.svelte.ts";
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
/** The id of the value button that is marked on the highlighted row (R86). */
const marked = (s: Sheet) => s.level.current?.options?.find((o) => o.selected)?.id;
const byId = (s: Sheet, id: string) => s.level.items.find((r) => r.id === id);

beforeEach(() => {
  forgetPicks();
  session = new Session(new FakeCalc(), memoryKv());
});

describe("Mode sheet", () => {
  it("opens on Angle, shows its value, and ▶ then Enter switches RAD → DEG and closes (3 keys with Shift + Fmt)", () => {
    const s = mode();
    expect(s.level.current?.id).toBe("angle");
    expect(marked(s)).toBe("rad");
    s.right();
    expect(session.settings.angle).toBe("deg");
    expect(marked(s)).toBe("deg");
    expect(s.enter().kind).toBe("run");
    s.right();
    expect(session.settings.angle).toBe("rad"); // DEG → RAD the same way
  });
  it("Angle, Format and Entry have a button per value, Digits keeps its ◀ ▶ row (R86)", () => {
    const s = mode();
    expect(byId(s, "angle")?.options?.map((o) => o.label)).toEqual(["RAD", "DEG"]);
    expect(byId(s, "format")?.options?.map((o) => o.label)).toEqual(["STD", "SCI", "ENG", "PFX"]);
    expect(byId(s, "entry")?.options?.map((o) => o.id)).toEqual(["textbook", "line"]);
    expect(byId(s, "digits")?.options).toBeUndefined();
    expect(byId(s, "digits")?.value).toBe("12");
    expect(byId(s, "settings")?.options).toBeUndefined();
  });
  it("a tap on a value button sets it and closes the sheet; a digit still steps the row forward; Enter closes", () => {
    const s = mode("format");
    const p = s.pickOption(at(s, "format"), "pfx");
    expect(p.kind).toBe("run");
    if (p.kind === "run") p.item.run?.();
    expect(session.settings.format).toBe("pfx");
    expect(marked(s)).toBe("pfx");
    expect(s.pickNumber(2)).toEqual({ kind: "stay" }); // Format: forward, round the end
    expect(session.settings.format).toBe("std");
    expect(s.enter().kind).toBe("run");
    expect(s.pickOption(at(s, "format"), "nope")).toEqual({ kind: "stay" });
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

describe("Settings › Appearance (R50e)", () => {
  it("is the first section: Theme with its dots, Brightness, and the two switches with one line each", () => {
    const s = settings(1);
    expect(s.path).toBe("Mode › Settings › Appearance");
    expect(s.level.items.map((x) => x.id)).toEqual(["theme", "brightness", "contrast", "plain"]);
    expect(byId(s, "theme")?.dots).toHaveLength(5);
    expect(byId(s, "theme")?.value).toBe("Pascaline");
    expect(s.level.items.filter((x) => x.hint).map((x) => x.id)).toEqual(["contrast", "plain"]);
  });
  it("▶ ◀ step the theme in place, round the ends; the sheet stays", () => {
    const s = settings(1);
    s.right();
    expect(session.settings.look.family).toBe("graphite");
    expect(s.left()).toBe(true);
    expect(s.left()).toBe(true);
    expect(session.settings.look.family).toBe("nord");
    expect(byId(s, "theme")?.value).toBe("Nord");
  });
  it("Enter, a digit or a tap on Theme lists the five; a pick keeps the sheet open and the page is told", () => {
    const seen: string[] = [];
    session.onLook = (l) => void seen.push(l.family);
    const s = settings(1);
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.path).toBe("Settings › Appearance › Theme");
    expect(s.level.items.map((x) => x.label)).toEqual(["Pascaline", "Graphite", "Solarized", "Gruvbox", "Nord"]);
    expect(s.level.items.every((x) => x.dots?.length === 5)).toBe(true);
    expect(s.pickNumber(4)).toEqual({ kind: "stay" });
    expect(session.settings.look.family).toBe("gruvbox");
    expect(s.path).toBe("Settings › Appearance › Theme");
    expect(s.level.items.filter((x) => x.selected).map((x) => x.id)).toEqual(["gruvbox"]);
    expect(seen).toEqual(["gruvbox"]);
    s.back();
    expect(s.activate(0)).toEqual({ kind: "stay" }); // a tap
    expect(s.path).toBe("Settings › Appearance › Theme");
    s.back();
    s.level.highlight = 0;
    expect(s.pickNumber(1)).toEqual({ kind: "stay" }); // a digit
    expect(s.path).toBe("Settings › Appearance › Theme");
  });
  it("Brightness steps System, Light, Dark; the switches toggle and stay", () => {
    const s = settings(1);
    s.level.highlight = at(s, "brightness");
    expect(byId(s, "brightness")?.value).toBe("System");
    s.right();
    expect(session.settings.look.brightness).toBe("light");
    s.right();
    expect(byId(s, "brightness")?.value).toBe("Dark");
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.pickNumber(3)).toEqual({ kind: "stay" });
    expect(session.settings.look.contrast).toBe(true);
    expect(s.pickNumber(4)).toEqual({ kind: "stay" });
    expect(session.settings.look.plain).toBe(true);
    expect(byId(s, "plain")?.selected).toBe(true);
  });
});

describe("Settings, a level of the sheet (R49)", () => {
  it("has the sections built so far, in their fixed order, each with › and a value; it opens on its first row", () => {
    const s = settings();
    expect(s.level.items.map((x) => x.id)).toEqual(["appearance", "numbers", "vibration", "counters", "help"]);
    expect(s.level.items.every((x) => x.submenu)).toBe(true);
    expect(s.level.items.map((x) => x.value)).toEqual(["Pascaline · System", "STD SCI ENG", "Off", "0 taps", undefined]);
    s.pickNumber(4);
    s.back();
    s.back();
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(s.level.current?.id).toBe("appearance"); // not the last pick
  });
  it("a digit opens a section with the path in its title; ◀ or Esc goes back onto the same row", () => {
    const s = settings(3);
    expect(s.path).toBe("Mode › Settings › Key vibration");
    expect(s.left()).toBe(false); // the switch has no value to step: ◀ goes back
    expect(s.back()).toBe(true);
    expect(s.level.current?.id).toBe("vibration");
    s.right();
    expect(s.path).toBe("Mode › Settings › Key vibration");
  });
  it("Numbers: the cycle's five ticks, the hint under the first, and the Decimals row under the Fixed tick, stepped in place", () => {
    const s = settings(2);
    expect(s.level.items.map((x) => x.id)).toEqual(["std", "sci", "eng", "pfx", "fix", "decimals"]);
    expect(s.level.items.filter((x) => x.hint).map((x) => x.id)).toEqual(["std"]);
    s.level.highlight = at(s, "decimals");
    expect(s.left()).toBe(true);
    expect(session.settings.fixDecimals).toBe(3);
    expect(s.enter()).toEqual({ kind: "stay" }); // Enter on a value row stays in Settings
  });
  it("a tick toggles on Enter or a pick, the sheet stays, and the cycle is never empty", () => {
    const s = settings(2);
    const marked = () => s.level.items.filter((i) => i.selected).map((i) => i.id);
    expect(marked()).toEqual(["std", "sci", "eng"]);
    expect(s.activate(at(s, "fix"))).toEqual({ kind: "stay" });
    s.activate(at(s, "sci")); // Scientific off
    expect(session.settings.fmtCycle).toEqual(["std", "eng", "fix"]);
    for (const id of ["std", "eng", "fix"]) s.activate(at(s, id)); // all off: back to the default cycle
    expect(session.settings.fmtCycle).toEqual(["std", "sci", "eng"]);
  });
  it("Key vibration: the switch, then strength (the browser cannot set it), length and Try it follow", () => {
    const s = settings(3);
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
    const s = settings(4);
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

describe("Help and about (R87)", () => {
  const loaded = (s: Sheet) => vi.waitFor(() => expect(s.level.items[0]?.id).not.toBe("loading"));

  it("is the fourth section; it holds About and Parts, each opening a level", () => {
    const s = settings(5);
    expect(s.path).toBe("Mode › Settings › Help and about");
    expect(s.level.items.map((x) => x.id)).toEqual(["about", "parts"]);
    expect(s.level.items.every((x) => x.submenu)).toBe(true);
  });

  it("About: the version from package.json, the licence, the source URL; the licence opens its text", async () => {
    const s = settings(5);
    s.pickNumber(1);
    expect(s.path).toBe("Settings › Help and about › About"); // the last three levels
    await loaded(s);
    const { version } = (await import("../../package.json")).default;
    expect(byId(s, "version")?.value).toBe(version);
    expect(byId(s, "licence")?.hint).toBe("GPL-3.0-or-later");
    expect(byId(s, "source")?.hint).toBe("https://github.com/buerlino/pascaline");
    expect(s.activate(at(s, "licence"))).toEqual({ kind: "stay" });
    expect(s.level.text).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(s.level.items).toEqual([]);
  });

  it("Parts: a row per part of THIRD_PARTY.md; a single licence opens its text, a dual one a list of both", async () => {
    const s = settings(5);
    s.pickNumber(2);
    await loaded(s);
    const about = (await import("virtual:about")).default;
    expect(s.level.items.length).toBe(about.parts.length);
    const giac = s.level.items.find((x) => x.label.startsWith("Giac"));
    expect(giac?.hint).toBe("GPL-3.0-or-later");
    expect(giac?.preview).toContain("B. Parisse");
    s.activate(s.level.items.findIndex((x) => x.label.startsWith("MPFR")));
    expect(s.level.title).toBe("LGPL-3.0-or-later");
    expect(s.level.text).toContain("GNU LESSER GENERAL PUBLIC LICENSE");
    s.back();
    s.activate(s.level.items.findIndex((x) => x.label.startsWith("GMP")));
    expect(s.level.items.map((x) => x.id)).toEqual(["LGPL-3.0-or-later", "GPL-2.0-or-later"]);
    s.activate(1);
    expect(s.level.text).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(s.path).toBe("Parts › GMP 6.3.0 › GPL-2.0-or-later");
  });

  it("a text level pages with ▲ ▼ and goes back with ◀", async () => {
    const s = settings(5);
    s.pickNumber(1);
    await loaded(s);
    s.activate(at(s, "licence"));
    s.level.move(1);
    s.level.move(1);
    s.level.move(-1);
    expect(s.level.nudge).toBe(1);
    expect(s.left()).toBe(false); // nothing to step: ◀ goes back, as everywhere
    expect(s.back()).toBe(true);
  });
});

describe("Settings › Your keys (R4b)", () => {
  const withKeys = () => {
    const userKeys = new UserKeys(memoryKv());
    const chosen: string[] = [];
    const s = new Sheet("mode", "Mode", () => modeItems(session, { userKeys, chooseFor: (id, layer) => void chosen.push(`${id}:${layer}`) }), { remember: false });
    s.pickNumber(5);
    return { s, userKeys, chosen };
  };

  it("is the third section, between Key vibration and Counters, only where the app gives the slots", () => {
    expect(withKeys().s.level.items.map((x) => x.id)).toEqual(["appearance", "numbers", "vibration", "keys", "counters", "help"]);
    expect(settings().level.items.map((x) => x.id)).not.toContain("keys");
  });

  it("lists U1–U6 in three layers and Reset all; a place sets a slot, Empty this slot gives it back", () => {
    const { s, userKeys } = withKeys();
    expect(byId(s, "keys")?.value).toBe("None set");
    s.pickNumber(4);
    const ids = s.level.items.map((x) => x.id);
    expect(ids).toHaveLength(19);
    expect(ids.slice(0, 4)).toEqual(["u1:primary", "u1:shift", "u1:alpha", "u2:primary"]);
    expect(byId(s, "u2:shift")?.label).toBe("U2 ⇧");
    expect(byId(s, "u1:alpha")?.label).toBe("U1 α");
    expect(byId(s, "u1:primary")?.value).toBe("Empty");
    s.pickNumber(1); // U1's level: Find…, the six places, Empty this slot
    expect(s.level.items.map((x) => x.id)).toEqual(["find", "home", "cas", "apps", "menu", "mode", "settings", "empty"]);
    expect(s.pickNumber(3)).toEqual({ kind: "stay" }); // CAS: set, the sheet stays
    expect(userKeys.placeOf("u1", "primary")).toBe("cas");
    expect(byId(s, "cas")?.selected).toBe(true);
    s.pickNumber(4);
    expect(byId(s, "cas")?.selected).toBe(false);
    s.pickNumber(8);
    expect(userKeys.labelOf("u1", "primary")).toBeUndefined();
  });

  it("Find… hands the slot to the app", () => {
    const { s, chosen } = withKeys();
    s.pickNumber(4);
    s.pickNumber(5); // U2 ⇧
    const p = s.pickNumber(1);
    if (p.kind === "run") p.item.run?.();
    expect(chosen).toEqual(["u2:shift"]);
  });

  it("a free key pressed while the slots are listed goes to its row in its layer; elsewhere it does nothing", () => {
    const { s } = withKeys();
    expect(s.goKey("u3", "primary")).toBe(false); // the Settings level lists no slots
    s.pickNumber(4);
    expect(s.goKey("u3", "shift")).toBe(true);
    expect(s.level.current?.id).toBe("u3:shift");
    expect(s.goKey("u6", "alpha")).toBe(true);
    expect(s.level.current?.id).toBe("u6:alpha");
    expect(s.goKey("sin", "primary")).toBe(false);
  });
});
