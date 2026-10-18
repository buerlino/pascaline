// SPDX-License-Identifier: GPL-3.0-or-later
// G16: the unit view's messages (docs/04 4.3). A table of its own, loaded with the unit view (units/messages.ts), so
// the start chunk does not carry it. English only so far. {dims}, {a}, {b} are dimensions ("L·T⁻¹"), {unit} a symbol.
export const enUnits = {
  "units.mismatch": "Units don't match: {dims}",
  "units.mismatchSep": " vs ",
  "units.temperature": "Use K or Δ°C for a temperature difference",
  "units.logarithmic": "{unit} converts only",
  "units.nofactor": "No exact factor for {unit} yet",
  "units.function": "A function takes a pure number (sin, cos and tan also an angle)",
  "units.symbolic": "Not a number: {detail}",
  "units.engine": "The unit view could not evaluate this",
} as const satisfies Record<string, string>;

export type UnitMessageKey = keyof typeof enUnits;

/** A unit-view message; `{name}` placeholders are filled from `vars`. */
export function unitText(key: UnitMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enUnits[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
