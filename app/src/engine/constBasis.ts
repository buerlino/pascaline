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
  const withBasis = [...entries].flatMap(([id, e]) => {
    const b = basisOf(e);
    return b === undefined ? [] : [{ id, leaves: leavesOf(b) }];
  });
  const out = new Set<string>();
  for (const a of withBasis) if (withBasis.some((b) => b.id !== a.id && [...a.leaves].some((l) => b.leaves.has(l)))) out.add(a.id);
  return out;
}
