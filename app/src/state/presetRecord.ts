// SPDX-License-Identifier: GPL-3.0-or-later
// The presets' stored record (R88, docs/04 6.2 `presets`): its shape and its load check. A module without imports, so
// the backup's check (state/backup.ts) runs the same rule as the model (state/presets.svelte.ts) without pulling the
// start chunk's modules into its own (see the note in backup.ts).

/** The stamped key the presets are stored under. */
export const PRESETS_KEY = "presets";

/** The five groups a preset can hold, each a tick (docs/05 3.4). */
export type PresetGroup = "mode" | "numbers" | "look" | "vibration" | "keys";
export const PRESET_GROUPS: readonly PresetGroup[] = ["mode", "numbers", "look", "vibration", "keys"];

/** The fields of each group. A group stored before a field existed lacks it, and applying it leaves that setting alone. */
export const GROUP_FIELDS: Readonly<Record<PresetGroup, readonly string[]>> = {
  mode: ["angle", "format", "digits", "entry"],
  numbers: ["decimalMark", "fmtCycle", "fixDecimals", "uncertainty", "marks", "groupSep"],
  look: ["family", "brightness", "contrast", "plain"],
  vibration: ["on", "strength", "ms"],
  keys: ["userKeys", "unitPadCells"],
};

/** A group's values by field, as captured (`keys`: the stored records of USER_KEYS and UNIT_PAD_CELLS). */
export type GroupValues = Record<string, unknown>;

export interface Preset {
  id: number;
  name: string;
  /** The held groups only. A group this version does not know (a newer build's) is kept as it is and not applied. */
  groups: Partial<Record<PresetGroup, GroupValues>> & Record<string, GroupValues>;
}

export interface StoredPresets {
  presets: Preset[];
  /** The preset last applied, saved or updated; null for none. */
  active: number | null;
  /** The next preset's id (ids are never used twice). */
  next: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1;

/** The key a name is compared by: two names that differ only in case or outer spaces are the same name. */
export const nameKey = (name: string): string => name.trim().toLocaleLowerCase();

/** R138: the presets' value with a look group of the house look's id before the name N62 (`pascaline`) read as `n62`,
 *  as theme/look.ts renamedLook does (repeated here: this module imports nothing). A value of another shape is returned
 *  as it is, for the check that follows. */
export function renamedLooks(v: unknown): unknown {
  if (!isObject(v) || !Array.isArray(v["presets"])) return v;
  const renamed = (p: unknown): unknown => {
    if (!isObject(p) || !isObject(p["groups"]) || !isObject(p["groups"]["look"]) || p["groups"]["look"]["family"] !== "pascaline") return p;
    return { ...p, groups: { ...p["groups"], look: { ...p["groups"]["look"], family: "n62" } } };
  };
  return { ...v, presets: (v["presets"] as unknown[]).map(renamed) };
}

/**
 * The presets from a stored value, entry by entry: a preset without a whole id, a name, or groups as an object is
 * dropped, and so is a later one with an id or a name already taken; `dropped` counts them (the backup's check refuses
 * a part with any). `active` that names no preset is none; `next` is past every id.
 */
export function readPresets(stored: unknown): { record: StoredPresets; dropped: number } {
  const v = renamedLooks(stored);
  const o = isObject(v) ? v : {};
  const list = Array.isArray(o["presets"]) ? (o["presets"] as unknown[]) : [];
  const presets: Preset[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const p of list) {
    if (!isObject(p)) continue;
    const { id, name, groups } = p;
    if (!isId(id) || typeof name !== "string" || name.trim() === "" || !isObject(groups)) continue;
    if (ids.has(id) || names.has(nameKey(name))) continue;
    if (!Object.values(groups).every(isObject) || Object.keys(groups).length === 0) continue;
    ids.add(id);
    names.add(nameKey(name));
    presets.push({ id, name, groups: groups as Preset["groups"] });
  }
  const top = Math.max(0, ...ids);
  const next = isId(o["next"]) && o["next"] > top ? o["next"] : top + 1;
  const active = isId(o["active"]) && ids.has(o["active"]) ? o["active"] : null;
  const dropped =
    list.length - presets.length + (isObject(v) && Array.isArray(o["presets"]) ? 0 : 1) + (o["active"] === null || active !== null ? 0 : 1) + (next === o["next"] ? 0 : 1);
  return { record: { presets, active, next }, dropped };
}

/** Runs the migration steps of the stored key `key` on `value`, written in version `from`, up to the current version
 *  (state/storage.ts unstamp, passed in: this module imports nothing). */
export type KeySteps = (key: string, value: unknown, from: number) => unknown;

/**
 * The presets' value with each preset's keys group brought up from version `from`: the group holds the records of the
 * stored keys `userKeys` and `unitPadCells` (GROUP_FIELDS.keys, the stored keys' own names), so their own steps run on
 * them. The model's open and the backup's check both run it, each with the presets record's own stamp: a restore writes
 * the part stamped as current, and the model then runs no step on it. Anything else in the value stays as it is.
 */
export function migratePresetKeys(v: unknown, from: number, up: KeySteps): unknown {
  if (!isObject(v) || !Array.isArray(v["presets"])) return v;
  const presets = (v["presets"] as unknown[]).map((p) => {
    const groups = isObject(p) ? p["groups"] : undefined;
    if (!isObject(p) || !isObject(groups) || !isObject(groups["keys"])) return p;
    const keys: Record<string, unknown> = { ...groups["keys"] };
    for (const key of GROUP_FIELDS.keys) if (key in keys) keys[key] = up(key, keys[key], from);
    return { ...p, groups: { ...groups, keys } };
  });
  return { ...v, presets };
}
