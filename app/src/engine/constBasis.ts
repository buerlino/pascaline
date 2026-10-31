// SPDX-License-Identifier: GPL-3.0-or-later
// G81: an inexact constant's basis (G80: its value over the measured leaves it is computed from, `pasl_<leaf>`), as
// Home (constUnc.ts) and the unit view (units/build.ts) read it. Pure text, no engine. Only erasable TypeScript syntax.
import { mapNames, names } from "./giacPrint.ts";

/** The prefix of a basis leaf (G80, G81). */
export const LEAF_PREFIX = "pasl_";

/** A constant as a chip, Home's table or the unit view's factors carry it. */
export interface BasisCarrier {
  unc?: string;
  basis?: string;
  basisLeaves?: Readonly<Record<string, { value: string; unc: string }>>;
}

/** A decimal or integer text that is exactly zero ("0", "0.0", "0E-11"). */
export function isZeroText(s: string): boolean {
  return /^\s*[+-]?0*\.?0*(?:[eE][+-]?\d+)?\s*$/.test(s) && /\d/.test(s);
}

/** G81: the basis an inexact constant enters through, when it has one whose every leaf it carries with a value and an
 *  uncertainty; else undefined (an exact constant, or a chip stored before G81: its own value, as before). */
export function basisOf(e: BasisCarrier): string | undefined {
  const leaves = e.basisLeaves;
  if (e.unc === undefined || isZeroText(e.unc) || !e.basis || !leaves) return undefined;
  for (const { name } of names(e.basis, "typed")) {
    const l = name.slice(LEAF_PREFIX.length);
    if (name.startsWith(LEAF_PREFIX) && !(Object.hasOwn(leaves, l) && typeof leaves[l]?.value === "string" && typeof leaves[l]?.unc === "string")) return undefined;
  }
  return e.basis;
}

/** `basis` with each leaf name replaced by `f` of its leaf id (null keeps the name). */
export function mapLeaves(basis: string, f: (leaf: string) => string | null): string {
  return mapNames(basis, ({ name }) => (name.startsWith(LEAF_PREFIX) && name.length > LEAF_PREFIX.length ? f(name.slice(LEAF_PREFIX.length)) : null), "typed");
}
