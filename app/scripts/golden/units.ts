// SPDX-License-Identifier: GPL-3.0-or-later
// stage units
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { EngineHost } from "../../src/engine/host.ts";
import { markText, type Case } from "../../src/goldenRun.ts";
import { defaultHomeSettings, precisionFacts, type HomeSettings } from "../../src/engine/homeEval.ts";
import { markOf } from "../../src/engine/format.ts";
import { alternatives, withEnd } from "../../src/units/alternatives.ts";
import { buildJob } from "../../src/units/build.ts";
import { factorTable } from "../../src/units/factors.ts";
import { unitErrorMessage, unitNoteText, unitWhyText } from "../../src/units/messages.ts";
import { padUnitCells, userUnitCells } from "../../src/units/padCells.ts";
import type { UserCells } from "../../src/units/pad.ts";
import { isUnitError, type Quantity, type UnitError, type UnitJob } from "../../src/units/types.ts";
import type { FactorTable } from "../../src/units/factors.ts";
import type { IndexItem } from "../../src/find/types.ts";
import { requestOf, slotOf } from "../unit-case.ts";
import { root, ROUNDS, want, cases, median, freshHost, report, str, same } from "./lib.ts";

const UNIT_P95_MS = 5;

/** What a units case got, as text to compare and print. */
function unitGot(r: Quantity | UnitError, c: Case): string {
  if (isUnitError(r)) return `refused: ${unitErrorMessage(r)}`;
  const m = markText(markOf(precisionFacts(r.value), { format: "STD", digits: 12 }));
  return `${m ?? "-"} ${r.value.display} exact ${r.value.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(r.dimension)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(r.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(r.dimensionText)}` : ""}${c.si !== undefined ? ` si ${r.si ?? "-"}` : ""}${c.unc !== undefined ? ` unc ${r.unc?.text ?? "none"}` : ""}${c.shown !== undefined ? ` shown ${r.unc?.shown ?? "-"}` : ""}${r.unc?.why ? ` ⚠ ${unitWhyText(r.unc.why)}` : ""}${r.note ? ` note ${unitNoteText(r.note)}` : ""}`;
}

/** The same text for what the case expects; `dim` and `si` are checked where the case gives them. */
function unitWant(c: Case): string {
  if (c.message !== undefined) return `refused: ${c.message}`;
  return `${c.mark ?? "-"} ${str(c.expect as string)} exact ${c.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(c.dim)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(c.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(c.dimtext)}` : ""}${c.si !== undefined ? ` si ${c.si}` : ""}${c.unc !== undefined ? ` unc ${c.unc}` : ""}${c.shown !== undefined ? ` shown ${c.shown}` : ""}${c.unc_why !== undefined ? ` ⚠ ${c.unc_why}` : ""}${c.notice !== undefined ? ` note ${c.notice}` : ""}`;
}

/** R60: a `tap` case's job: the input evaluated without an end slot, its row of alternatives (the spec's pad and user
 *  cells, `target` as units.targets), and the alternative named `tap` as the end slot. */
async function tapJob(c: Case, table: FactorTable, settings: HomeSettings, host: () => Promise<EngineHost>): Promise<UnitJob | UnitError> {
  const spec = parse(readFileSync(`${root}spec/unit-pad.yaml`, "utf8")) as { user: { key: string }[] };
  const user = userUnitCells(Object.fromEntries(spec.user.map((u) => [u.key, u])) as unknown as UserCells);
  const req = requestOf(c.input!, undefined, table);
  const first = buildJob(req, table);
  const q = isUnitError(first) ? first : (await host()).units(first, settings);
  if (isUnitError(q)) return q;
  const row = alternatives(q, { table, pad: padUnitCells(spec), user, req, ...(c.target !== undefined ? { target: slotOf(c.target, table) } : {}) });
  const alt = row.find((a) => a.text === c.tap);
  if (alt) return buildJob(withEnd(req, alt), table);
  console.log(`  units ${c.id}: no alternative ${c.tap} in the row ${row.map((a) => a.text).join(", ") || "(none)"}`);
  return { error: "engine", detail: `no alternative ${c.tap}` };
}

export async function stageUnits(): Promise<void> {
  const cs = cases("units.yaml");
  const indexFile = process.env.FIND_INDEX_JSON ?? `${root}app/src/find/_gen/find-index.json`;
  if (!existsSync(indexFile)) {
    report("units", false, `no Find index at ${indexFile}: run npm run index (PASCALINE_QALC_DL_DIR=<main checkout>/engine/qalc/_downloads in a worktree)`);
    return;
  }
  const table = factorTable(JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]);
  const settingsOf = (c: Case): HomeSettings => ({ ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" });
  let tapHost: EngineHost | null = null;
  const jobs: (UnitJob | UnitError)[] = [];
  for (const c of cs)
    jobs.push(c.tap === undefined ? buildJob(requestOf(c.input!, c.to, table), table) : await tapJob(c, table, settingsOf(c), async () => (tapHost ??= await freshHost())));
  const runs = new Map<string, string[]>(cs.map((c) => [c.id, []]));
  let host: EngineHost | null = null;
  for (let r = 0; r < ROUNDS; r++) {
    host = await freshHost();
    cs.forEach((c, k) => {
      const job = jobs[k]!;
      runs.get(c.id)!.push(unitGot(isUnitError(job) ? job : host!.units(job, settingsOf(c)), c));
    });
  }
  let pass = 0;
  for (const c of cs) {
    const want = unitWant(c);
    const got = runs.get(c.id)!;
    if (got.every((g) => g === want)) pass++;
    else console.log(`  units ${c.id}: got ${[...new Set(got)].join(" / ")}, expect ${want}`);
  }
  // Warm timing: one pass to warm up, then five timed passes; each case counts with its fastest pass, so another
  // process on the desktop does not fail the gate (the device bar is measured on the device, docs/04 8.3).
  const best = new Map<string, number>();
  for (let r = 0; r < 6; r++) {
    cs.forEach((c, k) => {
      const job = jobs[k]!;
      if (isUnitError(job)) return;
      const t0 = performance.now();
      host!.units(job, settingsOf(c));
      const t = performance.now() - t0;
      if (r > 0) best.set(c.id, Math.min(best.get(c.id) ?? Infinity, t));
    });
  }
  const times = [...best.values()];
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;
  report(
    "units",
    pass === cs.length && p95 <= UNIT_P95_MS,
    `${pass}/${cs.length} match (value, mark, exact, dimension, or the refusal), rounds ${ROUNDS}; desktop warm (best of 5) median ${median(times).toFixed(2)} ms, p95 ${p95.toFixed(2)} ms (≤ ${UNIT_P95_MS}), max ${(sorted.at(-1) ?? 0).toFixed(2)} ms`,
  );
}
