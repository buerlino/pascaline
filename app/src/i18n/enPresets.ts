// SPDX-License-Identifier: GPL-3.0-or-later
// R89: the words of the presets in Mode (docs/05 3.4). A table of its own, loaded with the Mode sheet's chunk
// (views/presetsView.svelte.ts), so the start chunk does not carry it. English only so far.
export const enPresets = {
  "row": "Preset",
  "none": "None",
  "title": "Presets",
  "save": "Save the current setup as a preset",
  "edit": "Edit the presets",
  "edit.title": "Edit",
  "edit.empty": "No presets yet",
  "loading": "Loading the presets…",
  "newer": "Saved by a newer Pascaline: kept as it is",
  "name": "Preset name",
  "saved": "Saved {name}",
  "renamed": "Renamed to {name}",
  "updated": "{name} updated",
  "deleted": "{name} deleted",
  "fault.empty": "A preset needs a name",
  "fault.taken": "There is already a preset named {name}",
  "fault.noGroups": "A preset holds at least one group",
  "fault.unknown": "That preset is gone",
  "fault.newer": "Saved by a newer Pascaline: not changed",
  "group.mode": "Mode",
  "group.numbers": "Numbers",
  "group.look": "Appearance",
  "group.vibration": "Key vibration",
  "group.keys": "Your keys",
  "notHeld": "Not held: stays as it is",
  "update": "Update from the current setup",
  "manage": "Rename or delete",
  "rename": "Rename",
  "delete": "Delete {name}",
  "textbook": "textbook",
  "line": "one line",
  "point": "point",
  "comma": "comma",
  "Point": "Point",
  "Comma": "Comma",
  "keys.0": "no keys",
  "keys.1": "1 key",
  "keys.n": "{n} keys",
  "set.0": "None set",
  "set.n": "{n} set",
  "on": "On · {strength} % · {ms} ms",
  "off": "Off",
  "switched": "Presets switched",
} as const;

export type PresetKey = keyof typeof enPresets;

export function presetText(key: PresetKey, vars?: Readonly<Record<string, string | number>>): string {
  const m: string = enPresets[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => String(vars[k] ?? all)) : m;
}
