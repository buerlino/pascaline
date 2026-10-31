// SPDX-License-Identifier: GPL-3.0-or-later
// Presets (R88; docs/05 3.4, decisions.md "Settings in the Mode sheet, and presets"): a named snapshot of the user's own
// settings, the free keys included, in any of five groups. Applying one sets the groups it holds and nothing else; the
// fixed keys never change. Nothing saves by itself: after a change to a held setting the preset is `modified` until
// Update or another preset. Stored under the stamped key `presets` (docs/04 6.2). Loaded with the Mode sheet's chunk
// (views/modeSheet.ts), never in the start chunk.
import { keyboard } from "../keyboard/keyboard.ts";
import type { UserKeys, StoredUserKeys } from "../keyboard/userKeys.svelte.ts";
import { unitCells, UNIT_PAD_CELLS, type StoredCells, type UnitCells } from "../units/userCells.svelte.ts";
import { GROUP_FIELDS, nameKey, PRESET_GROUPS, PRESETS_KEY, readPresets, type GroupValues, type Preset, type PresetGroup, type StoredPresets } from "./presetRecord.ts";
import type { Look } from "../theme/look.ts";
import type { Session, Settings } from "./session.svelte.ts";
import { DATA_VERSION, idbKv, unstamp, type MIGRATIONS } from "./storage.ts";
import type { RawRecord } from "./storageRaw.ts";

export { PRESET_GROUPS, PRESETS_KEY, type GroupValues, type Preset, type PresetGroup, type StoredPresets };

/** Why a change was refused: an empty or taken name, no group ticked, no such preset, or a record from a newer version
 *  (it is kept as it is, so the newer build finds it again). */
export type PresetFault = "empty" | "taken" | "noGroups" | "unknown" | "newer";
export class PresetError extends Error {
  readonly fault: PresetFault;
  constructor(fault: PresetFault) {
    super(`preset: ${fault}`);
    this.fault = fault;
  }
}

/** Where the record lives: read as stored (its true stamp), written stamped (kvSet never writes over a newer record). */
export interface PresetStore {
  read(): Promise<RawRecord | undefined>;
  write(value: StoredPresets): Promise<void>;
}
export const idbPresetStore: PresetStore = {
  // storageRaw.ts is a chunk of its own (the backup's): a static import would add it to the preload list of the Mode
  // sheet's chunk, which the start chunk carries
  read: () => import("./storageRaw.ts").then((m) => m.kvGetRaw(PRESETS_KEY)),
  write: (value) => idbKv.set(PRESETS_KEY, value),
};

export interface PresetEnv {
  readonly session: Session;
  readonly userKeys: UserKeys;
  readonly cells: UnitCells;
  readonly store: PresetStore;
  /** The migration steps (tests); MIGRATIONS by default. */
  readonly steps?: typeof MIGRATIONS;
  /** Put a look on the page and settle once the theme's files are in (theme/lookApply.ts applyLook, as main.ts's
   *  session.onLook does, but awaited, so a second apply starts after the first one's look is on the page). */
  readonly showLook?: (look: Look) => Promise<void>;
}

const applyLook = (look: Look): Promise<void> => import("../theme/lookApply.ts").then((m) => m.applyLook(look));

// The start chunk's modules export to this chunk only what they already export to others (each new export costs the
// start chunk bytes): the free keys' ids come from the spec as in backup.ts, the stored keys' names are written out.
/** keyboard/userKeys.svelte.ts USER_KEY_IDS. */
const USER_KEY_IDS: readonly string[] = keyboard.keys.filter((k) => k.user).map((k) => k.id);
/** state/storage.ts USER_KEYS. */
const USER_KEYS = "userKeys";
/** For presets.test.ts, which checks them against the originals. */
export const START_COPIES = { USER_KEY_IDS, USER_KEYS };

/** JSON with sorted keys: two values are the same data whatever order their fields were written in. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    typeof x === "object" && x !== null && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x,
  );
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Where each settings group's fields live in `Settings`: at the top, in `look`, or in `haptics`. */
const PLACE: Partial<Record<PresetGroup, "top" | "look" | "haptics">> = { mode: "top", numbers: "top", look: "look", vibration: "haptics" };

/** A settings group's values in `s`. */
function settingsGroup(s: Settings, g: PresetGroup): GroupValues {
  const from: Record<string, unknown> = PLACE[g] === "look" ? { ...s.look } : PLACE[g] === "haptics" ? { ...s.haptics } : { ...s };
  return Object.fromEntries(GROUP_FIELDS[g].map((f) => [f, structuredClone(from[f])]));
}

/** `s` with one field set, or undefined when the settings' reader would not keep `v` as it is (a value this version
 *  cannot read: applying it leaves the setting alone). `rules` is backup.ts's SETTING_RULES, the values `migrateSettings`
 *  keeps (restore.test.ts holds the two together); taken from there, since an import of `migrateSettings` from this
 *  chunk would cost the start chunk an export. */
function withField(s: Settings, g: PresetGroup, f: string, v: unknown, rules: Readonly<Record<string, (x: unknown) => boolean>>): Settings | undefined {
  const [key, value] = PLACE[g] === "look" ? ["look", { ...s.look, [f]: v }] : PLACE[g] === "haptics" ? ["haptics", { ...s.haptics, [f]: v }] : [f, v];
  return rules[key]?.(value) ? { ...s, [key]: structuredClone(value) } : undefined;
}

/** The free keys' stored slots, the keys without any left out (Your keys' record as UserKeys keeps it). */
function freeKeys(keys: UserKeys): StoredUserKeys {
  const out: StoredUserKeys = {};
  for (const id of USER_KEY_IDS) {
    const s = $state.snapshot(keys.slots(id));
    if (Object.keys(s).length > 0) out[id] = s;
  }
  return out;
}

export class Presets {
  /** The saved presets, in the order they were made. */
  list = $state<Preset[]>([]);
  /** The preset last applied, saved or updated; null for none. */
  active = $state<number | null>(null);
  /** The stored record is from a newer version: it is not read, and nothing is written over it. */
  refused = $state(false);
  private next = 1;
  private readonly env: PresetEnv;
  /** Applies run one after the other: the second starts once the first one's look is on the page. */
  private applying: Promise<void> = Promise.resolve();

  private constructor(env: PresetEnv) {
    this.env = env;
  }

  /** The model with its stored record read (migrated and written back when older; refused when newer), once the free
   *  keys' and the unit cells' own records are in (a capture before them would hold their defaults). */
  static async open(env: PresetEnv): Promise<Presets> {
    const p = new Presets(env);
    await Promise.all([env.userKeys.restore(), env.cells.restore()]);
    let rec: RawRecord | undefined;
    try {
      rec = await env.store.read();
    } catch {
      p.refused = true; // a failed read is not "nothing stored" (R93): writing now could lose the user's presets
      return p;
    }
    if (rec === undefined) return p;
    if (rec["@pascaline"] > DATA_VERSION) {
      p.refused = true;
      return p;
    }
    const up = (key: string, stored: unknown): unknown => (env.steps ? unstamp(key, stored, env.steps) : unstamp(key, stored)).value;
    const from = rec["@pascaline"];
    const { record } = readPresets(up(PRESETS_KEY, rec));
    // The keys a preset holds are the records of USER_KEYS and UNIT_PAD_CELLS: their own steps run on them too.
    for (const preset of record.presets) {
      const keys = preset.groups.keys;
      if (!keys) continue;
      if ("userKeys" in keys) keys["userKeys"] = up(USER_KEYS, { "@pascaline": from, value: keys["userKeys"] });
      if ("unitPadCells" in keys) keys["unitPadCells"] = up(UNIT_PAD_CELLS, { "@pascaline": from, value: keys["unitPadCells"] });
    }
    p.list = record.presets;
    p.active = record.active;
    p.next = record.next;
    if (from < DATA_VERSION) p.save();
    return p;
  }

  /** The current setup's values of each group. */
  private current(g: PresetGroup): GroupValues {
    if (g === "keys") return { userKeys: freeKeys(this.env.userKeys), unitPadCells: this.env.cells.snapshot() };
    return settingsGroup($state.snapshot(this.env.session.settings) as Settings, g);
  }

  private snapshot(groups: readonly PresetGroup[]): Preset["groups"] {
    const out: Preset["groups"] = {};
    for (const g of PRESET_GROUPS) if (groups.includes(g)) out[g] = this.current(g);
    return out;
  }

  private find(id: number): Preset {
    const p = this.list.find((x) => x.id === id);
    if (!p) throw new PresetError("unknown");
    return p;
  }

  private checkName(name: string, self?: number): string {
    const n = name.trim();
    if (n === "") throw new PresetError("empty");
    if (this.list.some((p) => p.id !== self && nameKey(p.name) === nameKey(n))) throw new PresetError("taken");
    return n;
  }

  private writable(): void {
    if (this.refused) throw new PresetError("newer");
  }

  private save(): void {
    void this.env.store.write({ presets: $state.snapshot(this.list) as Preset[], active: this.active, next: this.next });
  }

  /** Save the current setup as a new preset holding `groups` (all five from the sheet); it becomes the active one. */
  capture(name: string, groups: readonly PresetGroup[] = PRESET_GROUPS): number {
    this.writable();
    const n = this.checkName(name);
    if (!PRESET_GROUPS.some((g) => groups.includes(g))) throw new PresetError("noGroups");
    const id = this.next++;
    this.list = [...this.list, { id, name: n, groups: this.snapshot(groups) }];
    this.active = id;
    this.save();
    return id;
  }

  /** Set the groups the preset holds and their values; the ones held stay held (none: refused). Wait for the
   *  result: a second apply waits for the first. Counted (the removal test). */
  apply(id: number): Promise<void> {
    const run = this.applying.then(() => this.run(id));
    this.applying = run.catch(() => {});
    return run;
  }

  private async run(id: number): Promise<void> {
    const { SETTING_RULES } = await import("./backup.ts");
    const p = $state.snapshot(this.find(id)) as Preset; // (the list is a proxy: structuredClone cannot copy it)
    const { session, userKeys, cells } = this.env;
    let s = $state.snapshot(session.settings) as Settings;
    for (const g of PRESET_GROUPS) {
      const held = p.groups[g];
      if (!held || g === "keys") continue;
      for (const f of GROUP_FIELDS[g]) if (f in held) s = withField(s, g, f, held[f], SETTING_RULES) ?? s;
    }
    const lookChanged = canon(s.look) !== canon($state.snapshot(session.settings.look));
    Object.assign(session.settings, s);
    session.save();
    const keys = p.groups.keys;
    // only the free keys' entries: a record that names a fixed key never reaches it (each slot is checked when used)
    if (keys && isObject(keys["userKeys"]))
      userKeys.write(Object.fromEntries(Object.entries(keys["userKeys"]).filter(([id, v]) => USER_KEY_IDS.includes(id) && isObject(v))) as StoredUserKeys);
    if (keys && isObject(keys["unitPadCells"])) cells.replace(keys["unitPadCells"] as StoredCells);
    session.taps.tap("presets");
    this.active = id;
    if (!this.refused) this.save();
    if (p.groups.look && lookChanged) await (this.env.showLook ?? applyLook)({ ...s.look }).catch(() => {}); // (a theme that will not load leaves the old one)
  }

  /** The held groups take the current setup's values (Update from the current setup); it becomes the active one. */
  update(id: number): void {
    this.writable();
    const p = this.find(id);
    const groups = PRESET_GROUPS.filter((g) => p.groups[g]);
    this.list = this.list.map((x) => (x.id === id ? { ...x, groups: { ...x.groups, ...this.snapshot(groups) } } : x));
    this.active = id;
    this.save();
  }

  /** Tick and untick groups: a newly ticked group takes the current values, an unticked one is dropped. */
  setGroups(id: number, groups: readonly PresetGroup[]): void {
    this.writable();
    const p = this.find(id);
    if (!PRESET_GROUPS.some((g) => groups.includes(g))) throw new PresetError("noGroups");
    const next: Preset["groups"] = {};
    for (const [g, v] of Object.entries(p.groups)) if (!PRESET_GROUPS.includes(g as PresetGroup) || groups.includes(g as PresetGroup)) next[g] = v;
    for (const g of groups) next[g] ??= this.current(g);
    this.list = this.list.map((x) => (x.id === id ? { ...x, groups: next } : x));
    this.save();
  }

  rename(id: number, name: string): void {
    this.writable();
    this.find(id);
    const n = this.checkName(name, id);
    this.list = this.list.map((x) => (x.id === id ? { ...x, name: n } : x));
    this.save();
  }

  remove(id: number): void {
    this.writable();
    this.find(id);
    this.list = this.list.filter((x) => x.id !== id);
    if (this.active === id) this.active = null;
    this.save();
  }

  /** A setting the active preset holds differs from it now (its name then carries a dot). A field the preset does not
   *  hold (stored before that setting existed) is not compared. */
  get modified(): boolean {
    const p = this.list.find((x) => x.id === this.active);
    if (!p) return false;
    return PRESET_GROUPS.some((g) => {
      const held = p.groups[g];
      if (!held) return false;
      const now = this.current(g);
      return GROUP_FIELDS[g].some((f) => f in held && canon(now[f]) !== canon(held[f]));
    });
  }
}

let shared: Promise<Presets> | undefined;
/** The app's presets, on the app's store (one model per page; the Mode sheet and window.pascaline.presets). */
export function presetsFor(session: Session, userKeys: UserKeys): Promise<Presets> {
  return (shared ??= Presets.open({ session, userKeys, cells: unitCells, store: idbPresetStore }));
}
