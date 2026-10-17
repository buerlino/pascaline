// SPDX-License-Identifier: GPL-3.0-or-later
// The text form of a unit-view case in tests/golden/units.yaml and the Vitests: what R28's parser and R24a's slots
// will produce, written by hand. `input` is Giac text with each unit slot in braces and each constant as {=id}; `to`
// is the end slot without braces.
//   {k:m / h}      km ÷ h: tokens separated by spaces, "prefix:unit", one "/" for the ÷
//   {n:V Hz^-1/2}  nV·Hz^(−1/2): "^power" after a unit (an integer or p/q); c:m^2 is cm²; without a prefix, a unit
//                  id that itself holds "^" (m^2) is read whole
//   {=c}           the constant c
// Only erasable TypeScript syntax (the golden gate runs this file in Node).
import type { FactorTable } from "../src/units/factors.ts";
import type { UnitRequest, UnitSlot, UnitToken } from "../src/units/types.ts";

function token(text: string, table: FactorTable): UnitToken {
  const colon = text.indexOf(":");
  const prefix = colon > 0 ? text.slice(0, colon) : undefined;
  const rest = colon > 0 ? text.slice(colon + 1) : text;
  const hat = rest.lastIndexOf("^");
  // A prefix always takes the power outside it (c:m^2 is cm², not c·m²); without one, an id that holds "^" is whole.
  const split = hat > 0 && (prefix !== undefined || !table.units.has(rest)) && /^-?\d+(\/\d+)?$/.test(rest.slice(hat + 1));
  const unit = split ? rest.slice(0, hat) : rest;
  const power = split ? rest.slice(hat + 1) : undefined;
  return { ...(prefix !== undefined ? { prefix } : {}), unit, ...(power !== undefined ? { power } : {}) };
}

export function slotOf(text: string, table: FactorTable): UnitSlot {
  const parts = text.trim().split(/\s+/);
  const per = parts.indexOf("/");
  const tokens = parts.filter((p) => p !== "/").map((p) => token(p, table));
  return per >= 0 ? { tokens, per } : { tokens };
}

/** A case's input (and end slot) as the request the unit view sends. */
export function requestOf(input: string, to: string | undefined, table: FactorTable): UnitRequest {
  const slots: UnitSlot[] = [];
  const consts: string[] = [];
  const formula = input.replace(/\{([^}]*)\}/g, (_, body: string) => {
    if (body.startsWith("=")) {
      consts.push(body.slice(1));
      return `pask${consts.length}`;
    }
    slots.push(slotOf(body, table));
    return `pasu${slots.length}`;
  });
  return { formula, slots, ...(consts.length ? { consts } : {}), ...(to !== undefined ? { end: slotOf(to, table) } : {}) };
}
