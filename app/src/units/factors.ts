// SPDX-License-Identifier: GPL-3.0-or-later
// The factor table of the unit view (P15, docs/04 4.2): from the Find index, each unit's exact SI factor (`si`) and
// dimension (`dim`), each prefix's power of ten (or of two), each constant's value, uncertainty and dimension. Built
// once when the unit view first evaluates, never in the start chunk. Plain TS.
import type { IndexItem } from "../find/types.ts";

export interface UnitFactor {
  /** Exact factor to SI base units (p/q, with pi where needed); "a+b" for °C and °F (K = a·x + b); absent when the
   *  index has none (G13 adds them). */
  si?: string;
  /** Dimension key ("kg1m1s-2"); absent when qalc gives no conversion to SI base units. */
  dim?: string;
  /** What a message calls it ("°C", "hp"). */
  symbol: string;
}

export interface ConstFactor {
  /** Exact decimal text with every digit ("299792458", "6.67430E-11"). */
  value: string;
  /** Standard uncertainty (CODATA); absent when the value is exact. */
  unc?: string;
  /** G81: an inexact constant's basis over `pasl_<leaf>` names and its leaves (the Find item's, G80). */
  basis?: string;
  basisLeaves?: Readonly<Record<string, { value: string; unc: string }>>;
  dim?: string;
  symbol: string;
}

export interface FactorTable {
  units: ReadonlyMap<string, UnitFactor>;
  prefixes: ReadonlyMap<string, { si: string; symbol: string }>;
  consts: ReadonlyMap<string, ConstFactor>;
}

/** The symbol a unit's or prefix's chip shows (`\unit{oC}{\mathrm{°C}}` → °C), else the item's first name. */
function symbolOf(it: IndexItem): string {
  const m = /\{\\mathrm\{([^{}]+)\}\}$/.exec(it.insert ?? "");
  return m?.[1] ?? it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
}

const bare = (id: string): string => id.slice(id.indexOf(":") + 1);

export function factorTable(items: readonly IndexItem[]): FactorTable {
  const units = new Map<string, UnitFactor>();
  const prefixes = new Map<string, { si: string; symbol: string }>();
  const consts = new Map<string, ConstFactor>();
  for (const it of items) {
    if (it.kind === "unit") units.set(bare(it.id), { ...(it.si ? { si: it.si } : {}), ...(it.dim !== undefined ? { dim: it.dim } : {}), symbol: symbolOf(it) });
    else if (it.kind === "pfx" && it.si) prefixes.set(bare(it.id), { si: it.si, symbol: symbolOf(it) });
    else if (it.kind === "const" && it.value)
      consts.set(bare(it.id), {
        value: it.value,
        ...(it.unc ? { unc: it.unc } : {}),
        ...(it.unc && it.basis !== undefined && it.basisLeaves !== undefined ? { basis: it.basis, basisLeaves: it.basisLeaves } : {}),
        ...(it.dim !== undefined ? { dim: it.dim } : {}),
        symbol: symbolOf(it),
      });
  }
  return { units, prefixes, consts };
}
