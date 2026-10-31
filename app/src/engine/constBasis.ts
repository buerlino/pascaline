// SPDX-License-Identifier: GPL-3.0-or-later
// G81: an inexact constant's basis (G80: its value over the measured leaves it is computed from, `pasl_<leaf>`), as
// Home (constUnc.ts) and the unit view (units/build.ts) read it. Pure text, no engine. Only erasable TypeScript syntax.
import { mapNames } from "./giacPrint.ts";

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
 *  uncertainty; else undefined (an exact constant, a chip stored before G81 or a malformed one: its own value, as before). */
export function basisOf(e: BasisCarrier): string | undefined {
  const L = e.basisLeaves;
  // a stored chip's fields are as read back (input/chips.ts validChips): the types are checked here
  if (typeof e.unc !== "string" || isZeroText(e.unc) || typeof e.basis !== "string" || !e.basis || !L) return undefined;
  return [...leavesOf(e.basis)].every((l) => Object.hasOwn(L, l) && typeof L[l]?.value === "string" && typeof L[l]?.unc === "string") ? e.basis : undefined;
}

/** `basis` with each leaf name replaced by `f` of its leaf id (null keeps the name; a bare `pasl_` is the leaf "",
 *  which no basisLeaves holds, so basisOf refuses it). */
export function mapLeaves(basis: string, f: (leaf: string) => string | null): string {
  return mapNames(basis, ({ name }) => (name.startsWith(LEAF_PREFIX) ? f(name.slice(LEAF_PREFIX.length)) : null), "typed");
}

/** G81: `basis` (basisOf's, of `e`) as Giac text, the one rule Home and the unit view share: a leaf of zero uncertainty
 *  is its value; any other is written by `uncertain` (its value, or its name as an input of σ). */
export function basisGiac(e: BasisCarrier, basis: string, uncertain: (leaf: string, v: { value: string; unc: string }) => string): string {
  return mapLeaves(basis, (l) => {
    const v = e.basisLeaves![l]!;
    return isZeroText(v.unc) ? `(${v.value})` : uncertain(l, v);
  });
}

/** The leaf ids `basis` names. */
function leavesOf(basis: string): Set<string> {
  const out = new Set<string>();
  mapLeaves(basis, (l) => (out.add(l), null));
  return out;
}

/**
 * G81: the constants of `entries` (id, entry; the inexact constants of one input) that enter through their basis: those
 * sharing a leaf with another one's basis, the only case where the correlation changes value or σ. Any other constant
 * keeps its own value and σ, the index's curated CODATA ones (G13: Z₀'s 5.9E-8 where the leaves give 5.8E-8).
 */
export function correlated(entries: Iterable<readonly [string, BasisCarrier]>): Set<string> {
  const sets = [...entries].map(([id, e]) => [id, leavesOf(basisOf(e) ?? "")] as const);
  return new Set(sets.filter(([id, a]) => sets.some(([j, b]) => j !== id && [...a].some((l) => b.has(l)))).map(([id]) => id));
}
