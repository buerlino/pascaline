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

/** The cycle unit (G25, decisions.md "G15"): a revolution is a count of cycles, a pure number, so `rev/s` is a
 *  frequency like Hz and `rpm` = 1 rev/min = 1/60 Hz with no 2π. It replaces qalc's rpm (π/30 rad/s), whose rad would
 *  make `1 rpm → Hz` the 2π trap. `tr` (turn) stays 2π rad: an angle. The index has "rev" only as a name of `tr`. */
const CYCLES: ReadonlyMap<string, UnitFactor> = new Map([
  ["rev", { si: "1", dim: "", symbol: "rev" }],
  ["rpm", { si: "1/60", dim: "s-1", symbol: "rpm" }],
]);

export function factorTable(items: readonly IndexItem[]): FactorTable {
  const units = new Map<string, UnitFactor>();
  const prefixes = new Map<string, { si: string; symbol: string }>();
  const consts = new Map<string, ConstFactor>();
  for (const it of items) {
    if (it.kind === "unit") units.set(bare(it.id), { ...(it.si ? { si: it.si } : {}), ...(it.dim !== undefined ? { dim: it.dim } : {}), symbol: symbolOf(it) });
    else if (it.kind === "pfx" && it.si) prefixes.set(bare(it.id), { si: it.si, symbol: symbolOf(it) });
    else if (it.kind === "const" && it.value)
      consts.set(bare(it.id), { value: it.value, ...(it.unc ? { unc: it.unc } : {}), ...(it.dim !== undefined ? { dim: it.dim } : {}), symbol: symbolOf(it) });
  }
  for (const [id, u] of CYCLES) units.set(id, u);
  return { units, prefixes, consts };
}
