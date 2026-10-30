// SPDX-License-Identifier: GPL-3.0-or-later
// Settings schema 2 (docs/04 6.2): digits up to 30 and the PFX format, with field-by-field validation of old data.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { defaultSettings, migrateSettings, MAX_DIGITS, Session, SETTINGS_SCHEMA } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

function memoryKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

describe("migrateSettings", () => {
  it("version 1 (no schema field) is kept as it was and marked as migrated", () => {
    const v1 = { digits: 15, angle: "deg", format: "sci", entry: "line", fmtCycle: ["std", "eng"], fixDecimals: 6, haptics: { on: true, strength: 80, ms: 20 } };
    const { settings, migrated } = migrateSettings(v1);
    expect(migrated).toBe(true);
    expect(settings).toMatchObject({ digits: 15, angle: "deg", format: "sci", entry: "line", fixDecimals: 6, haptics: { on: true, strength: 80, ms: 20 } });
    expect(settings.fmtCycle).toEqual(["std", "eng"]);
  });
  it("version 2 allows digits up to 30 and the pfx format, and needs no migration", () => {
    const { settings, migrated } = migrateSettings({ schema: SETTINGS_SCHEMA, digits: 30, format: "pfx" });
    expect(migrated).toBe(false);
    expect(settings.digits).toBe(30);
    expect(settings.format).toBe("pfx");
  });
  it("digits are clamped to 1…30 and rounded", () => {
    expect(migrateSettings({ digits: 99 }).settings.digits).toBe(MAX_DIGITS);
    expect(migrateSettings({ digits: 0 }).settings.digits).toBe(1);
    expect(migrateSettings({ digits: 7.6 }).settings.digits).toBe(8);
  });
  it("a wrong field keeps its default and does not spoil the others", () => {
    const { settings } = migrateSettings({ digits: "20", angle: "grad", format: "hex", entry: 3, fmtCycle: "std", fixDecimals: NaN, haptics: 5, schema: 2 });
    expect(settings).toEqual(defaultSettings);
    expect(migrateSettings({ digits: 20, angle: "grad" }).settings).toMatchObject({ digits: 20, angle: defaultSettings.angle });
  });
  it("nothing stored, or something that is not an object, gives the defaults", () => {
    for (const bad of [undefined, null, 7, "x", []]) expect(migrateSettings(bad).settings).toEqual(defaultSettings);
  });
  it("unknown Format key modes are dropped from the cycle, pfx is kept", () => {
    expect(migrateSettings({ fmtCycle: ["std", "bogus", "pfx"] }).settings.fmtCycle).toEqual(["std", "pfx"]);
  });
});

describe("schema 3: the look (R50e)", () => {
  const first = { family: "pascaline", brightness: "dark", contrast: true, plain: false } as const;
  it("is schema 3, and every earlier schema gets the first-start look and is marked as migrated", () => {
    expect(SETTINGS_SCHEMA).toBe(3);
    for (const old of [{ digits: 9 }, { schema: 2, digits: 9 }]) {
      const { settings, migrated } = migrateSettings(old, first);
      expect(migrated).toBe(true);
      expect(settings.digits).toBe(9);
      expect(settings.look).toEqual(first);
    }
  });
  it("a stored look wins over the first-start look, field by field", () => {
    const stored = { schema: 3, look: { family: "nord", brightness: "light", contrast: false, plain: true } };
    const { settings, migrated } = migrateSettings(stored, first);
    expect(migrated).toBe(false);
    expect(settings.look).toEqual(stored.look);
    expect(migrateSettings({ schema: 3, look: { family: "bogus", brightness: 4, contrast: "yes", plain: true } }, first).settings.look).toEqual({ ...first, plain: true });
    expect(migrateSettings({ schema: 3, look: 7 }, first).settings.look).toEqual(first);
  });
  it("the defaults are Pascaline, System, both switches off", () => {
    expect(defaultSettings.look).toEqual({ family: "pascaline", brightness: "system", contrast: false, plain: false });
  });
  it("restoring tells the page the look it read", async () => {
    const kv = memoryKv();
    kv.data.set("settings", { schema: 3, look: { family: "nord", brightness: "light", contrast: false, plain: false } });
    const s = new Session(new FakeCalc(), kv);
    const seen: unknown[] = [];
    s.onLook = (l) => seen.push(l);
    await s.restoreSettings();
    expect(seen).toEqual([{ family: "nord", brightness: "light", contrast: false, plain: false }]);
  });
  it("a start with nothing stored writes its look, so a later start does not ask the phone again", async () => {
    const kv = memoryKv();
    const s = new Session(new FakeCalc(), kv);
    await s.restoreSettings();
    expect((kv.data.get("settings") as { schema: number; look: unknown }).schema).toBe(SETTINGS_SCHEMA);
    expect((kv.data.get("settings") as { look: unknown }).look).toEqual(defaultSettings.look);
  });
});

describe("Session settings", () => {
  it("restoring version-1 settings writes them back as the newest schema", async () => {
    const kv = memoryKv();
    kv.data.set("settings", { digits: 10, angle: "rad", format: "eng", entry: "textbook", fmtCycle: ["std"], fixDecimals: 4, haptics: { on: false, strength: 50, ms: 15 } });
    const s = new Session(new FakeCalc(), kv);
    await s.restoreSettings();
    expect(s.settings.digits).toBe(10);
    expect(s.settings.format).toBe("eng");
    expect((kv.data.get("settings") as { schema: number }).schema).toBe(SETTINGS_SCHEMA);
  });
  it("the digits setting takes 30 and nothing above", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.setDigits(30);
    expect(s.settings.digits).toBe(30);
    s.setDigits(31);
    expect(s.settings.digits).toBe(30);
  });
  it("pfx can be the number format and sits in the Format key cycle", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.setFormat("pfx");
    expect(s.settings.format).toBe("pfx");
    s.setFmtMode("pfx", true);
    expect(s.settings.fmtCycle).toContain("pfx");
  });
});
