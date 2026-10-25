// SPDX-License-Identifier: GPL-3.0-or-later
// stage parser
import { existsSync, readFileSync } from "node:fs";
import { type GiacApi } from "../../src/engine/host.ts";
import { type Case } from "../../src/goldenRun.ts";
import { ENGINE_DEFINITIONS } from "../../src/engine/homeEval.ts";
import { DEFAULT_USER_FUNCTIONS, latexToGiac, latexToGiacInfo, type UnitsInfo } from "../../src/input/latex-to-giac.ts";
import { SerializeError } from "../../src/input/errors.ts";
import { buildJob } from "../../src/units/build.ts";
import { factorTable, type FactorTable } from "../../src/units/factors.ts";
import { isUnitError } from "../../src/units/types.ts";
import type { IndexItem } from "../../src/find/types.ts";
import { slotOf } from "../unit-case.ts";
import { root, only, want, cases, freshEngine, report, same } from "./lib.ts";

function equalByGiac(g: GiacApi, a: string, b: string): { ok: boolean; how: string } {
  if (a === b) return { ok: true, how: "identical" };
  const ea = g.eval(a);
  if (ea === g.eval(b) && !/undef|error/i.test(ea)) return { ok: true, how: "same value" };
  const diff = `(${a})-(${b})`;
  const s = g.eval(`simplify(${diff})`);
  if (s === "0" || s === "0=0") return { ok: true, how: "simplify" };
  const vars = g
    .eval(`lname(${diff})`)
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter((v) => v && v !== "pi" && v !== "i");
  // Fixed sample points (deterministic runs), inside (0.15, 1.85) like the original random ones.
  for (const x of [0.3719, 0.9137, 1.6453]) {
    const at = (e: string): string =>
      vars.length ? `subst(${e},[${vars.join(",")}],[${vars.map((_, j) => (x + j * 0.31).toFixed(6)).join(",")}])` : e;
    const r = g.eval(`evalf(abs(${at(diff)}) / max(1, abs(${at(`(${b})`)})))`);
    // Internal comparison only, never shown to users.
    const v = Number(r);
    if (!Number.isFinite(v) || v > 1e-8) return { ok: false, how: `numeric diff ${r} (simplify gave ${s.slice(0, 60)})` };
  }
  return { ok: true, how: "numeric" };
}

let unitTable: FactorTable | null | undefined;

/** R28: a units-mode case: the formula as written, the slots and the end slot it names, and the Giac text G16's builder
 *  makes from it with the Find index's factors, compared by Giac. */
function unitsCase(g: GiacApi, c: Case, formula: string, u: UnitsInfo | undefined): { ok: boolean; how: string } {
  if (formula !== c.formula) return { ok: false, how: `formula ${formula}, want ${c.formula}` };
  if (!u || u.slots.length !== (c.slots ?? []).length) return { ok: false, how: `slots ${JSON.stringify(u?.slots)}, want ${(c.slots ?? []).length}` };
  if ((u.end !== undefined) !== (c.to !== undefined)) return { ok: false, how: `end slot ${u.end ?? "none"}, want ${c.to ?? "none"}` };
  if (unitTable === undefined) {
    const indexFile = process.env.FIND_INDEX_JSON ?? `${root}app/src/find/_gen/find-index.json`;
    unitTable = existsSync(indexFile) ? factorTable(JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : null;
  }
  if (!unitTable) return { ok: false, how: "no Find index: run npm run index" };
  const table = unitTable;
  const job = buildJob(
    { formula, slots: (c.slots ?? []).map((s) => slotOf(s, table)), ...(u.consts.length ? { consts: u.consts } : {}), ...(c.to !== undefined ? { end: slotOf(c.to, table) } : {}) },
    table,
  );
  if (isUnitError(job)) return { ok: false, how: `builder refused: ${JSON.stringify(job)}` };
  return equalByGiac(g, job.expr, c.expect as string);
}

export async function stageParser(): Promise<void> {
  const cs = cases("parser.yaml");
  const g = (await freshEngine()).giac;
  // The parser emits our own names (pasmod); the host loads them on first use, here they are all loaded.
  for (const def of Object.values(ENGINE_DEFINITIONS)) g.eval(def);
  let pass = 0;
  let run = 0;
  let gaps = 0;
  const gapPassing: string[] = [];
  for (const c of cs) {
    let produced: string;
    let r: { ok: boolean; how: string };
    try {
      // A function a `before` entry defines is a call in what follows, as the session counts it (R56)
      const userFunctions = new Set(DEFAULT_USER_FUNCTIONS);
      const o = { ...(c.options ?? {}), ...(c.chips ? { chips: c.chips } : {}), userFunctions };
      for (const b of c.before ?? []) {
        const d = latexToGiacInfo(b, o).defines;
        if (d) userFunctions.add(d);
      }
      if (c.options?.units && !c.error) {
        const u = latexToGiacInfo(c.latex!, o);
        produced = u.giac;
        r = unitsCase(g, c, u.giac, u.units);
      } else {
        produced = latexToGiac(c.latex!, o);
        r = c.error ? { ok: false, how: "accepted, but must be an error" } : equalByGiac(g, produced, c.expect as string);
      }
    } catch (e) {
      produced = "";
      const msg = e instanceof Error ? e.message : String(e);
      r = c.error && e instanceof SerializeError ? { ok: true, how: `error: ${msg}` } : { ok: false, how: `parser threw: ${msg}` };
    }
    if (c.status === "gap") {
      gaps++;
      if (r.ok) gapPassing.push(c.id);
      continue;
    }
    run++;
    if (r.ok) pass++;
    else console.log(`  parser ${c.id}: ${c.latex} -> ${produced}, want ${c.expect}: ${r.how}`);
  }
  report(
    "parser",
    pass === run,
    `${pass}/${run} match, ${gaps} known gaps${gapPassing.length ? ` (now passing: ${gapPassing.join(", ")})` : ""}; total ${pass}/${cs.length}`,
  );
}
