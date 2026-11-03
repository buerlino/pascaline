// SPDX-License-Identifier: GPL-3.0-or-later
// R122: a restore takes an older backup. The fixtures in fixtures/ are files saved by the app of their date (one more each
// time DATA_VERSION steps); each must pass the check for as long as the app reads its version. A settings part whose
// `look` or `haptics` lacks a field added later passes, and the start reader fills the field's default; a part the app no
// longer keeps (`units.history`) is skipped, never refused.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { checkBackup, type CheckedBackup } from "./backup.ts";
import { fakeIndexedDb } from "./fakeIdb.ts";
import { restoreParts } from "./restore.ts";
import { Session } from "./session.svelte.ts";
import { DATA_VERSION, idbKv } from "./storage.ts";

type File = { dataVersion: number; parts: Record<string, { "@pascaline": number; value: unknown }> };
const FIXTURES = ["backup-2026-11.json"] as const;
const fixture = (name: string): File => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as File;
const bytes = (f: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(f));
const checked = (f: unknown): CheckedBackup => {
  const r = checkBackup(bytes(f));
  if (!r.ok) throw new Error(`refused: ${r.message}`);
  return r;
};
/** The fixture with one field of a nested setting removed. */
function without(group: "look" | "haptics", field: string): File {
  const f = fixture("backup-2026-11.json");
  const s = f.parts["settings"]?.value as Record<string, Record<string, unknown>>;
  delete s[group]?.[field];
  return f;
}

describe("the backup fixtures (R122)", () => {
  it.each(FIXTURES)("%s passes the check with every part", (name) => {
    const f = fixture(name);
    expect(f.dataVersion).toBeLessThanOrEqual(DATA_VERSION);
    expect(Object.keys(checked(f).parts).sort()).toEqual(Object.keys(f.parts).sort());
  });
});

describe("a settings part without a nested field added later (R122, vr-9)", () => {
  beforeEach(() => {
    const idb = fakeIndexedDb();
    idb.stores.set("kv", new Map());
    vi.stubGlobal("indexedDB", idb.factory);
  });
  afterEach(() => vi.unstubAllGlobals());
  /** Restore the checked file's settings, then start a session on the store: the settings it reads. */
  const restored = async (f: File): Promise<Session["settings"]> => {
    await restoreParts({ settings: checked(f).parts["settings"] }, 1);
    const s = new Session(new FakeCalc(), idbKv);
    await s.restoreSettings();
    return s.settings;
  };

  it.each([
    ["look", "plain", false],
    ["look", "family", "pascaline"],
    ["look", "contrast", false],
    ["haptics", "ms", 15],
    ["haptics", "strength", 50],
  ] as const)("without %s.%s: accepted, the field restored as its default", async (group, field, value) => {
    const s = await restored(without(group, field));
    expect((s[group] as unknown as Record<string, unknown>)[field]).toBe(value);
    // the fields the file holds are kept
    if (group === "look") expect(s.look.brightness).toBe("dark");
    else expect(s.haptics.on).toBe(true);
    expect(s.digits).toBe(9);
  });
  it("a field the file holds is still checked: a wrong one, or one this version does not know, refuses the file", () => {
    const f = fixture("backup-2026-11.json");
    const s = f.parts["settings"]?.value as Record<string, Record<string, unknown>>;
    for (const [group, field, v] of [
      ["look", "family", "nope"],
      ["look", "dim", true],
      ["haptics", "ms", 4],
      ["haptics", "pattern", "x"],
      ["look", "toString", 1], // an inherited name is not a field (`in` found it)
      ["look", "constructor", 1],
    ] as const) {
      const g = { ...s[group] };
      s[group] = { ...g, [field]: v };
      const r = checkBackup(bytes(f));
      expect(r.ok, `${group}.${field}`).toBe(false);
      s[group] = g;
    }
  });
  it("a `__proto__` field in look or haptics refuses the file, and the check does not throw", () => {
    const f = fixture("backup-2026-11.json");
    const s = f.parts["settings"]?.value as Record<string, Record<string, unknown>>;
    for (const group of ["haptics", "look"] as const) {
      const g = s[group];
      s[group] = { ...g, marker: 1 };
      // JSON.parse makes "__proto__" an own key of the parsed object; JSON.stringify of a literal cannot write it.
      const raw = new TextEncoder().encode(JSON.stringify(f).replace('"marker":1', '"__proto__":{}'));
      s[group] = g as Record<string, unknown>;
      expect(new TextDecoder().decode(raw)).toContain('"__proto__":{}');
      let r: ReturnType<typeof checkBackup> | undefined;
      expect(() => (r = checkBackup(raw)), group).not.toThrow();
      expect(r?.ok, group).toBe(false);
    }
  });
});

describe("a part this version no longer keeps (R122, ca-6)", () => {
  it("units.history: skipped, never refused", () => {
    const f = fixture("backup-2026-11.json");
    f.parts["units.history"] = { "@pascaline": 3, value: { rows: [] } };
    const r = checked(f);
    expect(r.parts).not.toHaveProperty("units.history");
    expect(r.parts["settings"]).toBeDefined();
  });
  it("a part no version kept is still refused", () => {
    const f = fixture("backup-2026-11.json");
    f.parts["nope"] = { "@pascaline": 3, value: 1 };
    expect(checkBackup(bytes(f)).ok).toBe(false);
  });
});
