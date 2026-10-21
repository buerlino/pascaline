// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the oracle sweep as a gate stage (r16 section 3.1): random keyboard-LaTeX trees through the parser and Home as the app calls it,
// each judged against mpmath at 60 and 100 digits (tools/probes/sweep/judge.ts): does the mark tell the truth, is a number shown only
// where a value exists, does every input answer or refuse within the deadline.
//   node scripts/sweep.ts                      # the gate stage: fixed seed, SWEEP_COUNT trees (default 1000, about 1.6 runs each), exit 1 on a new failure
//   node scripts/sweep.ts --nightly [--seed N] [--count N]   # rotating seed (the day number), default 25000 trees, report only (exit 0)
// Known failures: tests/golden/sweep-known.yaml (id = "<angle> <digits> <latex>", check = the judge's check, package = the open backlog id).
// Environment: GIAC_OUT as for the golden gate; PASCALINE_DL_DIR is not used. Needs mpmath (tests/golden/.venv).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { oracleFor, pythonFor, runsOf, sweep } from "../../tools/probes/sweep/run.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();

const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261021;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 25_000 : Number(process.env["SWEEP_COUNT"] ?? 1000));
const DEADLINE_MS = 6000; // HOME_DEADLINE_MS is 2000; a case past this did not return at all
const t0 = performance.now();

const runs = runsOf(seed, count);
const oracles = oracleFor(runs, pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/sweep/oracle.py"));
const tOracle = performance.now();
const { judged, refused, restarts } = await sweep(runs, oracles, DEADLINE_MS);

const count_ = (k: string): number => judged.filter((j) => j.verdict.kind === k).length;
const failures: InvariantFailure[] = judged
  .filter((j) => j.verdict.kind === "wrong" || j.verdict.kind === "novalue" || j.verdict.kind === "hang")
  .map((j) => ({ id: `${j.angle} ${j.digits} ${j.latex}`, check: j.verdict.check ?? j.verdict.kind, detail: j.verdict.detail ?? "" }));
const bareWarn = judged.filter((j) => j.verdict.kind === "ok" && j.verdict.detail === "⚠ without a count").length;
const judgedNumbers = judged.filter((j) => j.verdict.kind === "ok" || j.verdict.kind === "wrong").length;
const secs = (performance.now() - t0) / 1000;
const stats = `${judged.length} runs of ${count} trees (seed ${seed}): ${judgedNumbers} numbers judged, ${count_("refused")} refused by Home, ${count_("nonnumber")} not numbers, ${count_("skip")} skipped (${refused} parser), ${bareWarn} bare ⚠ (${judgedNumbers ? ((100 * bareWarn) / judgedNumbers).toFixed(1) : "0"} %), ${restarts} worker restarts; oracle ${((tOracle - t0) / 1000).toFixed(1)} s, total ${secs.toFixed(1)} s`;

if (nightly) {
  for (const f of failures) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
  console.log(`SWEEP NIGHTLY: ${failures.length} findings; ${stats}`);
  process.exit(0);
}
const known = parse(readFileSync(resolve(repo, "tests/golden/sweep-known.yaml"), "utf8")) as { known?: KnownFailure[] };
const r = invariantsStage(failures, known.known ?? []);
for (const l of r.lines) console.log(`  sweep ${l}`);
const ok = r.ok && secs < 60;
console.log(`${ok ? "SWEEP PASSED" : "SWEEP FAILED"}: ${stats}; ${r.summary}${secs < 60 ? "" : " (over 60 s)"}`);
process.exit(ok ? 0 : 1);
