// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census of Find's tier-1 functions as a gate stage (tools/probes/find-census.ts, tools/probes/findcensus/): every
// function's sample input as the keys write it, in Home and in CAS, classed (checked, unchecked, symbolic, refused, raw, wrong,
// state, hang, crash). The stage passes when every input's class is the one tests/golden/findcensus-known.yaml holds, and every
// finding (raw, wrong, state, hang, crash) sits under the backlog line that holds it. A class change, a new input, a lost input or a
// finding without its line fails it, so Find never opens a command whose kind of answer moved unseen.
//   node scripts/findcensus.ts             # the gate stage (about 45 s on 4 workers; fails over 5 minutes)
//   node scripts/findcensus.ts --update    # rewrite the known file's classes from this run (the findings lists are kept; new ones are listed)
// Environment: GIAC_OUT as for the golden gate; PASCALINE_DL_DIR (Giac's tarball, default the main checkout's cache); the Find index
// (`npm run index`); mpmath (tests/golden/.venv). FINDCENSUS_WORKERS (default 4).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { censusStage, knownText, type CensusKnown } from "../../tools/probes/findcensus/stage.ts";
import { aideCas, census, oracleFor, plan, pythonFor, tier1 } from "../../tools/probes/findcensus/run.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();
const KNOWN = resolve(repo, "tests/golden/findcensus-known.yaml");
const LIMIT_S = 300;
const DEADLINE_MS = 6000; // Home answers or refuses within HOME_DEADLINE_MS (2000); a case past this did not return

const update = process.argv.includes("--update");
const t0 = performance.now();
const p = plan(tier1(repo), await aideCas(mainCheckout));
const oracles = oracleFor(p.samples, pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/findcensus/oracle.py"));
const { rows, restarts } = await census(p.samples, oracles, DEADLINE_MS, Number(process.env["FINDCENSUS_WORKERS"] ?? 4));
const secs = (performance.now() - t0) / 1000;

const known = (parse(readFileSync(KNOWN, "utf8")) ?? {}) as CensusKnown;
const r = censusStage(rows, p.none.map((n) => n.name), known);
const counts = ["checked", "unchecked", "symbolic", "refused", "raw", "wrong", "defined", "state", "hang", "crash"].map((c) => `${c} ${rows.filter((x) => x.cls === c).length}`).join(", ");
const stats = `${rows.length} runs of ${p.samples.length} inputs (${new Set(p.samples.map((s) => s.name)).size} functions, ${p.none.length} without a sample): ${counts}; ${restarts} engine restarts; total ${secs.toFixed(1)} s`;

if (update) {
  writeFileSync(KNOWN, knownText(readFileSync(KNOWN, "utf8"), rows, p.none.map((n) => n.name), known));
  for (const l of r.lines.filter((x) => x.startsWith("NEW finding"))) console.log(`  findcensus ${l}`);
  console.log(`FINDCENSUS UPDATED: ${stats}; classes written to ${KNOWN}`);
  process.exit(0);
}
for (const l of r.lines) console.log(`  findcensus ${l}`);
const ok = r.ok && secs < LIMIT_S;
console.log(`${ok ? "FINDCENSUS PASSED" : "FINDCENSUS FAILED"}: ${stats}; ${r.summary}${secs < LIMIT_S ? "" : ` (over ${LIMIT_S} s)`}`);
process.exit(ok ? 0 : 1);
