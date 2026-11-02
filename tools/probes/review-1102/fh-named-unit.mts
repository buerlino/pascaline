// SPDX-License-Identifier: GPL-3.0-or-later
// fh probe (night review 2026-11-02): a Home name (stored as a plain number, as Home and the library store values) used
// in the unit view. Does the unit check see it as dimensionless and pass silently, or refuse it?
// Runs as tools/probes/unit-result.ts does (buildJob + EngineHost.units), after host.home() stores the name.
//   env -C <worktree>/app npx tsx <this file>
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const W = new URL("../../..", import.meta.url).pathname.replace(/\/$/, ""); // the checkout this file is in
const { EngineHost } = await import(join(W, "app/src/engine/host.ts"));
const { loadNodeGiac } = await import(join(W, "app/src/engine/nodeGiac.ts"));
const { defaultHomeSettings } = await import(join(W, "app/src/engine/homeEval.ts"));
const { buildJob } = await import(join(W, "app/src/units/build.ts"));
const { factorTable } = await import(join(W, "app/src/units/factors.ts"));
const { unitErrorMessage } = await import(join(W, "app/src/units/messages.ts"));
const { isUnitError } = await import(join(W, "app/src/units/types.ts"));
const { requestOf } = await import(join(W, "app/scripts/unit-case.ts"));

const candidates = [process.env.FIND_INDEX_JSON, join(W, "app/src/find/_gen/find-index.json")].filter(Boolean) as string[];
const indexFile = candidates.find((f) => existsSync(f));
if (!indexFile) { console.error("no Find index"); process.exit(2); }
console.log(`index: ${indexFile}`);
const table = factorTable(JSON.parse(readFileSync(indexFile, "utf8")));
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings };

for (const def of ["R:=4700", "g0:=980665/100000"]) {
  const r = host.home(def, s);
  console.log(`home ${def} -> ${JSON.stringify(r.result).slice(0, 120)}`);
}
const CASES: [string, string | undefined][] = [
  ["R*2*{A}", undefined],      // R meant as 4.7 kΩ: V expected, a dimensionless R gives A
  ["R*2*{A}", "V"],            // with the end slot: refused (dimension) or silently converted?
  ["R*2*{A}", "A"],
  ["5*{kg}*g0", "N"],          // the library's g0 (m/s²) used as a number: kg, not N
  ["5*{kg}*g0", undefined],
  ["5*{kg}*zz", undefined],    // a free name: refused as "Not a number"
];
for (const [input, to] of CASES) {
  const job = buildJob(requestOf(input, to, table), table);
  const q = isUnitError(job) ? job : host.units(job, s);
  const head = `${input}${to ? ` -> ${to}` : ""}`;
  if (isUnitError(q)) console.log(`${head}\n  refused: ${unitErrorMessage(q)} [${q.error}]`);
  else console.log(`${head}\n  ${q.value.display} ${q.unit}  dim ${q.dimensionText ?? "-"}${q.note ? `  note ${JSON.stringify(q.note)}` : ""}`);
}
