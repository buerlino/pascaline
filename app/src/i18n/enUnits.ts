// SPDX-License-Identifier: GPL-3.0-or-later
// G16: the unit view's messages (docs/04 4.3). A table of its own, loaded with the unit view (units/messages.ts), so
// the start chunk does not carry it. English only so far. {dims}, {a}, {b} are dimensions ("L·T⁻¹"), {unit} a symbol.
// The slot model (units/slot.ts, R24a) uses it too.
export const enUnits = {
  "units.mismatch": "Units don't match: {dims}",
  "units.mismatchSep": " vs ",
  "units.cycle.rpm": "{unit} counts turns: write tr/min for an angular speed",
  "units.cycle.rev": "{unit} counts turns: write tr for an angle",
  "units.temperature": "Use K or Δ°C for a temperature difference",
  "units.logarithmic": "{unit} converts only",
  "units.level": "A level needs a positive value",
  "units.belowzero": "Below absolute zero",
  "units.nofactor": "No exact factor for {unit} yet",
  "units.function": "A function takes a pure number (sin, cos and tan also an angle)",
  "units.divzero": "Not defined: a division by 0",
  "units.uncpower": "A power of a unit can't carry ±",
  "units.minus": "Put the minus on the number, not before the bracket around {unit}",
  "units.symbolic": "Not a number: {detail}",
  "units.engine": "The unit view could not evaluate this",
  // G40: the notes under a result (decisions.md "Angles in the unit view").
  "units.note.radDropped": "rad = 1 dropped",
  "units.note.cycle": "{unit} counts turns: the speed at radius r is 2π·r·n",
  // G41: the why-line of a σ shown with ⚠ (docs/04 4.3).
  "units.why.order2": "first order does not hold here",
  "units.why.singular": "the interval reaches a singular point",
  // R24a: the slot model's refusals (a pad press that cannot go into the slot) and the reading in words. {u} is a
  // unit's name in words ("kilometer"), {p} a power ("−1/2").
  "units.slot.prefixAlone": "A prefix needs a unit after it",
  "units.slot.rootAlone": "√ needs a unit after it",
  "units.slot.perEmpty": "÷ needs a unit after it",
  "units.slot.secondPer": "One ÷ per unit: the rest is already below it",
  "units.slot.powerAlone": "A power needs a unit before it",
  "units.slot.unknown": "{unit} is not in Find's unit list",
  "units.read.per": "per",
  "units.read.square": "{u} squared",
  "units.read.cube": "{u} cubed",
  "units.read.fourth": "{u} to the fourth",
  "units.read.power": "{u} to the power {p}",
  "units.read.root": "square root of {u}",
  // G37: °C or °F inside a compound unit or with a power is a temperature interval ("per degree Celsius (difference)").
  "units.read.interval": "{u} (difference)",
} as const satisfies Record<string, string>;

export type UnitMessageKey = keyof typeof enUnits;

/** A unit-view message; `{name}` placeholders are filled from `vars`. */
export function unitText(key: UnitMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enUnits[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
