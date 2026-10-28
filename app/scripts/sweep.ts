// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the oracle sweep as a gate stage (r16 section 3.1): random keyboard-LaTeX trees through the parser and Home as the app calls it,
// each judged against mpmath at 60 and 100 digits (tools/probes/sweep/judge.ts): does the mark tell the truth, is a number shown only
// where a value exists, does every input answer or refuse within the deadline.
//   node scripts/sweep.ts                      # the gate stage: fixed seed, SWEEP_COUNT trees (default 1000, about 1.6 runs each), exit 1 on a new failure
//   node scripts/sweep.ts --nightly [--edges] [--seed N] [--count N]   # report only (exit 0): the seed is the clock (seconds), printed first;
//     25000 trees, or with --edges (G116) 5000 of tools/probes/sweep/edges.ts's; an engine crash restarts it and is a `crash` row. Writes
//     the main checkout's .tasks/sweep-<date>-<seed>.md: every failure not in sweep-known.yaml by check, with its smallest failing subtree
// Known failures: tests/golden/sweep-known.yaml (id = "<angle> <digits> <latex>", check = the judge's check, package = the open backlog id).
// Environment: GIAC_OUT as for the golden gate; PASCALINE_DL_DIR is not used. Needs mpmath (tests/golden/.venv).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { childrenOf } from "../../tools/probes/sweep/edges.ts";
import { reportMarkdown, shrink } from "../../tools/probes/sweep/nightly.ts";
import { oracleFor, pythonFor, Runner, runsOf, sweep } from "../../tools/probes/sweep/run.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();

const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const edges = args.includes("--edges");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261021;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 1000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? (edges ? 5000 : 25_000) : Number(process.env["SWEEP_COUNT"] ?? 1000));
if (nightly) console.log(`SWEEP SEED ${seed}${edges ? " --edges" : ""} (repeat: node scripts/sweep.ts --nightly${edges ? " --edges" : ""} --seed ${seed} --count ${count})`);
const DEADLINE_MS = 6000; // HOME_DEADLINE_MS is 2000; a case past this did not return at all
const t0 = performance.now();

const runs = runsOf(seed, count, edges);
const python = pythonFor(repo, mainCheckout);
const oraclePy = resolve(repo, "tools/probes/sweep/oracle.py");
const oracles = oracleFor(runs, python, oraclePy);
const tOracle = performance.now();
const { judged, refused, restarts } = await sweep(runs, oracles, DEADLINE_MS);

const count_ = (k: string): number => judged.filter((j) => j.verdict.kind === k).length;
const failures: InvariantFailure[] = judged
  .filter((j) => j.verdict.kind === "wrong" || j.verdict.kind === "novalue" || j.verdict.kind === "hang")
  .map((j) => ({ id: `${j.angle} ${j.digits} ${j.latex}`, check: j.verdict.check ?? j.verdict.kind, detail: j.verdict.detail ?? "" }));
const bareWarn = judged.filter((j) => j.verdict.kind === "ok" && j.verdict.detail === "⚠ without a count").length;
const judgedNumbers = judged.filter((j) => j.verdict.kind === "ok" || j.verdict.kind === "wrong").length;
const secs = (performance.now() - t0) / 1000;
const crashes = count_("crash");
const stats = `${judged.length} runs of ${count} trees (seed ${seed}): ${judgedNumbers} numbers judged, ${count_("refused")} refused by Home,${crashes ? ` ${crashes} engine crashes,` : ""} ${count_("nonnumber")} not numbers, ${count_("skip")} skipped (${refused} parser), ${bareWarn} bare ⚠ (${judgedNumbers ? ((100 * bareWarn) / judgedNumbers).toFixed(1) : "0"} %), ${restarts} worker restarts; oracle ${((tOracle - t0) / 1000).toFixed(1)} s, total ${secs.toFixed(1)} s`;

const known = parse(readFileSync(resolve(repo, "tests/golden/sweep-known.yaml"), "utf8")) as { known?: KnownFailure[] };
if (nightly) {
  const knownIds = new Set((known.known ?? []).map((k) => `${k.id} ${k.check}`));
  const failed = judged
    .map((j, i) => ({ run: j, oracle: oracles[i]! }))
    .filter(({ run: j }) => ["wrong", "novalue", "hang", "crash"].includes(j.verdict.kind))
    .filter(({ run: j }) => !knownIds.has(`${j.angle} ${j.digits} ${j.latex} ${j.verdict.check ?? j.verdict.kind}`));
  for (const { run: j } of failed) console.log(`FINDING ${j.angle} ${j.digits} ${j.latex} [${j.verdict.check ?? j.verdict.kind}]: ${j.verdict.detail ?? ""}`);
  const runner = new Runner(DEADLINE_MS);
  const findings = await shrink(failed, childrenOf, runner, python, oraclePy).finally(() => runner.close());
  const per1000 = (secs * 1000) / count;
  const date = new Date().toISOString().slice(0, 10);
  const file = resolve(mainCheckout, ".tasks", `sweep-${date}-${seed}.md`);
  const head = [
    `# Oracle sweep ${date}, seed ${seed}${edges ? " (edges)" : ""}`,
    "",
    `Repeat: \`node scripts/sweep.ts --nightly${edges ? " --edges" : ""} --seed ${seed} --count ${count}\` (from app/). ${stats}; ${per1000.toFixed(1)} s per 1,000 trees.`,
  ];
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${reportMarkdown(head, findings)}\n`);
  console.log(`SWEEP NIGHTLY: ${failures.length} findings (${failed.length} not in sweep-known.yaml); ${stats}; ${per1000.toFixed(1)} s per 1,000 trees; report ${file}`);
  process.exit(0);
}
const r = invariantsStage(failures, known.known ?? []);
for (const l of r.lines) console.log(`  sweep ${l}`);
const ok = r.ok && secs < 60;
console.log(`${ok ? "SWEEP PASSED" : "SWEEP FAILED"}: ${stats}; ${r.summary}${secs < 60 ? "" : " (over 60 s)"}`);
process.exit(ok ? 0 : 1);
