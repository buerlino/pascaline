// SPDX-License-Identifier: GPL-3.0-or-later
// R88: presets, a named snapshot of the user's own settings and free keys (docs/05 3.4; decisions.md "Settings in the
// Mode sheet, and presets"). The model and its stamped store.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { keyboard } from "../keyboard/keyboard.ts";
import { USER_KEY_IDS, UserKeys } from "../keyboard/userKeys.svelte.ts";
import type { Look } from "../theme/look.ts";
import { CELL_KEYS, UnitCells } from "../units/userCells.svelte.ts";
import { BACKUP_KEYS, VALIDATORS } from "./backup.ts";
import { readPresets } from "./presetRecord.ts";
import { PRESET_GROUPS, PRESETS_KEY, PresetError, Presets, START_COPIES, type PresetStore, type StoredPresets } from "./presets.svelte.ts";
import { Session } from "./session.svelte.ts";
import { DATA_VERSION, USER_KEYS, type Kv } from "./storage.ts";
import type { RawRecord } from "./storageRaw.ts";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

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

/** The presets' record as stored, stamped as kvSet stamps it. */
function memoryStore(rec?: RawRecord): PresetStore & { rec: RawRecord | undefined; writes: number } {
  const s = {
    rec,
    writes: 0,
    read: () => Promise.resolve(s.rec === undefined ? undefined : structuredClone(s.rec)),
    write: (value: StoredPresets) => {
      s.writes++;
      s.rec = { "@pascaline": DATA_VERSION, value: structuredClone(value) };
      return Promise.resolve();
    },
  };
  return s;
}

const [U1, U2] = USER_KEY_IDS as [string, string];
const [C1] = CELL_KEYS as [string];
const sinh = { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } };
const mol = { label: "mol", action: { type: "mol" } };

async function setup(rec?: RawRecord) {
  const kv = memoryKv();
  const session = new Session(new FakeCalc(), kv);
  const looks: Look[] = [];
  const env = { showLook: (look: Look): Promise<void> => (looks.push(look), Promise.resolve()) };
  const userKeys = new UserKeys(kv);
  const cells = new UnitCells(kv);
  const store = memoryStore(rec);
  const presets = await Presets.open({ session, userKeys, cells, store, showLook: (l) => env.showLook(l) });
  return { kv, session, userKeys, cells, store, presets, looks, env };
}

describe("presets (R88)", () => {
  it("the model's copies of the start chunk's constants agree with them", () => {
    expect(START_COPIES).toEqual({ USER_KEY_IDS, USER_KEYS });
  });

  it("capture holds exactly the ticked groups", async () => {
    const { session, userKeys, presets } = await setup();
    session.setAngle("deg");
    userKeys.set(U1, "primary", sinh);
    const id = presets.capture("Lab", ["mode", "keys"]);
    const p = presets.list.find((x) => x.id === id);
    expect(Object.keys(p?.groups ?? {}).sort()).toEqual(["keys", "mode"]);
    expect(p?.groups.mode).toEqual({ angle: "deg", format: "std", digits: 12, entry: "textbook" });
    expect(p?.groups.keys).toMatchObject({ userKeys: { [U1]: { primary: sinh } } });
    const all = presets.capture("All", PRESET_GROUPS);
    expect(Object.keys(presets.list.find((x) => x.id === all)?.groups ?? {}).sort()).toEqual([...PRESET_GROUPS].sort());
  });

  it("names are unique and not empty", async () => {
    const { presets } = await setup();
    const id = presets.capture("Lab", PRESET_GROUPS);
    expect(() => presets.capture("  ", PRESET_GROUPS)).toThrow(PresetError);
    expect(() => presets.capture(" lab ", PRESET_GROUPS)).toThrow(PresetError);
    expect(() => presets.capture("Other", [])).toThrow(PresetError);
    const other = presets.capture("Chemistry", PRESET_GROUPS);
    expect(() => presets.rename(other, "LAB")).toThrow(PresetError);
    presets.rename(id, "Lab bench");
    expect(presets.list.map((p) => p.name)).toEqual(["Lab bench", "Chemistry"]);
    presets.rename(id, "Lab bench"); // its own name is not taken
  });

  it("apply sets the held groups and leaves every other setting alone", async () => {
    const { session, presets } = await setup();
    session.setAngle("deg");
    session.setFormat("eng");
    session.setDigits(4);
    const id = presets.capture("Lab", ["mode"]);
    session.setAngle("rad");
    session.setFormat("std");
    session.setDigits(12);
    session.setDecimalMark("comma");
    session.setHaptics({ on: true, ms: 30 });
    await presets.apply(id);
    expect(session.settings).toMatchObject({ angle: "deg", format: "eng", digits: 4, entry: "textbook" });
    expect(session.settings.decimalMark).toBe("comma");
    expect(session.settings.haptics).toEqual({ on: true, strength: 50, ms: 30 });
  });

  it("apply, then capture, gives the same snapshot", async () => {
    const { session, userKeys, cells, presets } = await setup();
    session.setAngle("deg");
    session.setFixDecimals(7);
    session.setFmtMode("pfx", true);
    session.settings.look = { family: "nord", brightness: "light", contrast: true, plain: true };
    userKeys.set(U2, "shift", mol);
    cells.set(C1, "up", { unit: "mol" });
    const id = presets.capture("Chemistry", PRESET_GROUPS);
    const before = structuredClone(presets.list.find((p) => p.id === id)?.groups);
    session.setAngle("rad");
    userKeys.reset();
    cells.reset();
    await presets.apply(id);
    const again = presets.capture("Again", PRESET_GROUPS);
    expect(presets.list.find((p) => p.id === again)?.groups).toEqual(before);
  });

  it("a preset saved before a later setting existed applies without touching it", async () => {
    // A numbers group stored before R57 has no decimal mark; a vibration group without a length.
    const old: StoredPresets = { presets: [{ id: 1, name: "Old", groups: { numbers: { fmtCycle: ["std", "sci"], fixDecimals: 2 }, vibration: { on: true, strength: 80 } } }], active: null, next: 2 };
    const { session, presets } = await setup({ "@pascaline": DATA_VERSION, value: old });
    session.setDecimalMark("comma");
    session.setHaptics({ ms: 40 });
    await presets.apply(1);
    expect(session.settings.decimalMark).toBe("comma");
    expect(session.settings.fmtCycle).toEqual(["std", "sci"]);
    expect(session.settings.fixDecimals).toBe(2);
    expect(session.settings.haptics).toEqual({ on: true, strength: 80, ms: 40 });
    expect(presets.modified).toBe(false);
  });

  it("a held field the app cannot read is skipped, and the other fields still apply", async () => {
    const bad: StoredPresets = { presets: [{ id: 1, name: "Bad", groups: { mode: { angle: "grad", digits: 8, format: "hex" } } }], active: null, next: 2 };
    const { session, presets } = await setup({ "@pascaline": DATA_VERSION, value: bad });
    session.setAngle("deg");
    session.setFormat("sci");
    await presets.apply(1);
    expect(session.settings).toMatchObject({ angle: "deg", format: "sci", digits: 8 });
  });

  it("the free keys switch and the fixed keys never do", async () => {
    const fixed = keyboard.keys.find((k) => !k.user);
    if (!fixed) throw new Error("no fixed key");
    const { userKeys, cells, presets, store } = await setup();
    userKeys.set(U1, "primary", sinh);
    cells.set(C1, "tap", { unit: "mol" });
    const a = presets.capture("Maths", ["keys"]);
    userKeys.reset();
    userKeys.set(U2, "primary", mol);
    cells.reset();
    const b = presets.capture("Chemistry", ["keys"]);
    await presets.apply(a);
    expect(userKeys.labelOf(U1, "primary")).toBe("sinh");
    expect(userKeys.labelOf(U2, "primary")).toBeUndefined();
    expect(cells.get(C1, "tap")).toEqual({ unit: "mol" });
    await presets.apply(b);
    expect(userKeys.labelOf(U1, "primary")).toBeUndefined();
    expect(userKeys.labelOf(U2, "primary")).toBe("mol");
    expect(cells.isSet(C1, "tap")).toBe(false);
    // a record that names a fixed key: the key stays as spec/keyboard.yaml has it
    const v = store.rec?.value as StoredPresets;
    const hacked = { ...v, presets: v.presets.map((p) => (p.id === a ? { ...p, groups: { keys: { userKeys: { [fixed.id]: { primary: sinh }, [U1]: { primary: sinh } }, unitPadCells: {} } } } : p)) };
    const { userKeys: k2, presets: p2 } = await setup({ "@pascaline": DATA_VERSION, value: hacked });
    await p2.apply(a);
    expect(k2.resolve(fixed)).toBe(fixed);
    expect(k2.labelOf(U1, "primary")).toBe("sinh");
    expect(USER_KEY_IDS.filter((id) => Object.keys(k2.slots(id)).length > 0)).toEqual([U1]);
    expect(k2.slots(fixed.id)).toEqual({});
  });

  it("a record stamped newer than DATA_VERSION is refused, and never written over", async () => {
    const newer: StoredPresets = { presets: [{ id: 1, name: "Future", groups: { mode: { angle: "deg" } } }], active: 1, next: 2 };
    const { presets, store } = await setup({ "@pascaline": DATA_VERSION + 1, value: newer });
    expect(presets.refused).toBe(true);
    expect(presets.list).toEqual([]);
    expect(() => presets.capture("Mine", PRESET_GROUPS)).toThrow(PresetError);
    expect(store.writes).toBe(0);
    expect(store.rec?.["@pascaline"]).toBe(DATA_VERSION + 1);
  });

  it("an older record migrates: through the steps of presets and of the keys it holds, then written back", async () => {
    const older: StoredPresets = { presets: [{ id: 3, name: "Old", groups: { keys: { userKeys: { [U1]: { primary: { label: "x", action: { type: "x" } } } }, unitPadCells: {} } } }], active: 3, next: 4 };
    const kv = memoryKv();
    const session = new Session(new FakeCalc(), kv);
    const userKeys = new UserKeys(kv);
    const store = memoryStore({ "@pascaline": DATA_VERSION - 1, value: older });
    const steps = {
      [DATA_VERSION - 1]: {
        [PRESETS_KEY]: (v: unknown) => ({ ...(v as StoredPresets), next: 9 }),
        userKeys: (v: unknown) => ({ ...(v as object), [U2]: { primary: mol } }),
      },
    };
    const presets = await Presets.open({ session, userKeys, cells: new UnitCells(kv), store, steps });
    expect(presets.refused).toBe(false);
    expect(presets.active).toBe(3);
    await presets.apply(3);
    expect(userKeys.labelOf(U1, "primary")).toBe("x");
    expect(userKeys.labelOf(U2, "primary")).toBe("mol");
    expect(store.rec?.["@pascaline"]).toBe(DATA_VERSION);
    expect((store.rec?.value as StoredPresets).next).toBe(9);
    // a record from before versions (no stamp) reads too
    const { presets: p0 } = await setup({ "@pascaline": 0, value: older });
    expect(p0.list.map((p) => p.name)).toEqual(["Old"]);
  });

  it("a damaged record holds no presets and breaks nothing", async () => {
    for (const value of [null, 7, "x", { presets: "no" }, { presets: [{ id: "a", name: 3 }, { id: 2, name: "Ok", groups: { mode: { angle: "deg" } } }] }]) {
      const { presets } = await setup({ "@pascaline": DATA_VERSION, value });
      expect(presets.refused).toBe(false);
      expect(presets.list.every((p) => typeof p.id === "number" && typeof p.name === "string")).toBe(true);
      presets.capture("New", PRESET_GROUPS); // and a new one gets a fresh id
      expect(new Set(presets.list.map((p) => p.id)).size).toBe(presets.list.length);
    }
  });

  it("modified is true after a change to a held setting and false after update", async () => {
    const { session, userKeys, presets } = await setup();
    const id = presets.capture("Lab", ["mode", "keys"]);
    expect(presets.active).toBe(id);
    expect(presets.modified).toBe(false);
    session.setDecimalMark("comma"); // not held
    expect(presets.modified).toBe(false);
    session.setDigits(5);
    expect(presets.modified).toBe(true);
    presets.update(id);
    expect(presets.modified).toBe(false);
    userKeys.set(U1, "alpha", sinh);
    expect(presets.modified).toBe(true);
    presets.update(id);
    expect(presets.modified).toBe(false);
    session.setDigits(6);
    presets.remove(id);
    expect(presets.active).toBe(null);
    expect(presets.modified).toBe(false);
  });

  it("setGroups ticks a group (its current values) and unticks one", async () => {
    const { session, presets } = await setup();
    const id = presets.capture("Lab", ["mode"]);
    session.setDecimalMark("comma");
    presets.setGroups(id, ["mode", "numbers"]);
    expect(presets.list[0]?.groups.numbers).toMatchObject({ decimalMark: "comma" });
    presets.setGroups(id, ["numbers"]);
    expect(Object.keys(presets.list[0]?.groups ?? {})).toEqual(["numbers"]);
    expect(() => presets.setGroups(id, [])).toThrow(PresetError);
  });

  it("two applies in a row end in the second, the theme's loads awaited", async () => {
    const { session, presets, env } = await setup();
    const shown: string[] = [];
    let loads = 0;
    env.showLook = (look) => {
      loads++;
      // the first load is the slow one: it ends after the second apply began
      return new Promise<void>((r) => setTimeout(() => (shown.push(look.family), r()), loads === 1 ? 30 : 1));
    };
    session.settings.look = { ...session.settings.look, family: "nord" };
    session.setAngle("deg");
    const a = presets.capture("A", PRESET_GROUPS);
    session.settings.look = { ...session.settings.look, family: "gruvbox" };
    session.setAngle("rad");
    const b = presets.capture("B", PRESET_GROUPS);
    const first = presets.apply(a);
    const second = presets.apply(b);
    await Promise.all([first, second]);
    expect(shown).toEqual(["nord", "gruvbox"]);
    expect(session.settings.look.family).toBe("gruvbox");
    expect(session.settings.angle).toBe("rad");
    expect(presets.active).toBe(b);
  });

  it("every apply is counted, and the count is kept", async () => {
    const { kv, session, presets } = await setup();
    const id = presets.capture("Lab", PRESET_GROUPS);
    await presets.apply(id);
    await presets.apply(id);
    expect(session.taps.counts.presets).toBe(2);
    await session.taps.flush();
    expect(kv.data.get("taps")).toMatchObject({ presets: 2 });
  });

  it("the store holds the list and the active preset across a reload", async () => {
    const { session, store, presets } = await setup();
    session.setAngle("deg");
    const id = presets.capture("Lab", PRESET_GROUPS);
    presets.capture("Other", ["look"]);
    await presets.apply(id);
    const { presets: again } = await setup(store.rec);
    expect(again.list.map((p) => p.name)).toEqual(["Lab", "Other"]);
    expect(again.active).toBe(id);
  });

  it("the backup holds the presets and checks them with the model's own load check", async () => {
    expect(BACKUP_KEYS).toContain(PRESETS_KEY);
    const { presets, store } = await setup();
    presets.capture("Lab", PRESET_GROUPS);
    presets.capture("Bench", ["mode"]);
    expect(VALIDATORS[PRESETS_KEY]?.(store.rec?.value)).toBe(true);
    const v = store.rec?.value as StoredPresets;
    const bad = [
      null,
      [],
      {},
      { ...v, presets: [...v.presets, { id: 1, name: "Twice", groups: { mode: {} } }] },
      { ...v, presets: [...v.presets, { id: 7, name: " LAB ", groups: { mode: {} } }] },
      { ...v, presets: [{ id: 9, name: "", groups: { mode: {} } }], next: 10 },
      { ...v, presets: [{ id: 9, name: "  ", groups: { mode: {} } }], next: 10 },
      { ...v, presets: [{ id: 9, name: "X", groups: {} }], next: 10 },
      { ...v, presets: [{ id: 9, name: "X", groups: { mode: 3 } }], next: 10 },
      { ...v, presets: [{ id: 1.5, name: "X", groups: { mode: {} } }] },
      { ...v, active: 77 },
      { ...v, active: "1" },
      { ...v, next: 1 },
      { ...v, next: undefined },
    ];
    for (const b of bad) expect(VALIDATORS[PRESETS_KEY]?.(b), JSON.stringify(b).slice(0, 80)).toBe(false);
    // backup.ts repeats the model's load check (no import, see there): both agree on every value above
    for (const x of [v, { ...v, active: null }, { presets: [], active: null, next: 1 }, ...bad])
      expect(VALIDATORS[PRESETS_KEY]?.(x), JSON.stringify(x).slice(0, 80)).toBe(isObject(x) && Array.isArray(x["presets"]) && readPresets(x).dropped === 0);
    expect(VALIDATORS["taps"]?.({ shift: 0, alpha: 0, presses: 1, presets: 3, since: "" })).toBe(true);
    expect(VALIDATORS["taps"]?.({ shift: 0, alpha: 0, presses: 1, presets: -1, since: "" })).toBe(false);
  });
});
