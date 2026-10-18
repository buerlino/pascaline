// SPDX-License-Identifier: GPL-3.0-or-later
// Calc.units() behind the lazy import (G16): the factor table is built from the Find index once per index source, on
// the first call; the request is built into a job here, on the main thread, and only a job reaches the engine.
import type { HomeSettings, MathEngine } from "../engine/types.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "./build.ts";
import { factorTable, type FactorTable } from "./factors.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";

type IndexSource = () => Promise<readonly IndexItem[]>;

const tables = new WeakMap<IndexSource, Promise<FactorTable>>();

export async function evaluateUnits(engine: MathEngine, load: IndexSource | undefined, req: UnitRequest, s: HomeSettings): Promise<Quantity | UnitError> {
  if (!load) return { error: "engine", detail: "no Find index for the unit factors" };
  let pending = tables.get(load);
  if (!pending) tables.set(load, (pending = load().then(factorTable)));
  let table: FactorTable;
  try {
    table = await pending;
  } catch (e) {
    tables.delete(load); // the next call tries again
    return { error: "engine", detail: `the Find index did not load: ${e instanceof Error ? e.message : String(e)}` };
  }
  const job = buildJob(req, table);
  return "error" in job ? job : engine.units(job, s);
}
