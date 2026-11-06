// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the oracle sweep as a gate stage (r16 section 3.1): random keyboard-LaTeX trees through the parser and Home as the app calls it,
// each judged against mpmath at 60 and 100 digits, 2k more for literals holding 10^±k (G162; tools/probes/sweep/oracle.py, judge.ts): does the mark tell the truth, is a number shown only
// where a value exists, does every input answer or refuse within the deadline.
//   node scripts/sweep.ts                      # the gate stage: fixed seed, SWEEP_COUNT trees (default 1000, about 1.6 runs each), exit 1 on a new failure
//   node scripts/sweep.ts --nightly [--edges] [--seed N] [--count N]   # report only (exit 0): the seed is the clock (seconds), printed first;
//     25000 trees, or with --edges (G116) 5000 of tools/probes/sweep/edges.ts's; an engine crash restarts it and is a `crash` row. Writes
//     the main checkout's .tasks/sweep-<date>-<seed>.md: every failure not in sweep-known.yaml by check, with its smallest failing subtree
//   In pieces (G167; each under `tools/devlock.sh slice <name> …`, at most 10 minutes; the one-piece run takes about 90 s per 1,000 --edges trees):
//     node scripts/sweep.ts --nightly [--edges] --seed N --count N --part i/n        # the i-th of n slices of the run list; its failures go to .tasks/sweep-part-<seed>-<count>[-edges]-<i>of<n>.json
//     node scripts/sweep.ts --shrink N [--count N] [--edges]                          # every part of seed N (all n there, or the missing ones are named and it exits 1), then the report as above
//     node scripts/sweep.ts --shrink N --part i/m   and   node scripts/sweep.ts --shrink N --join   # a shrink longer than a slice: m shrink parts (.tasks/sweep-shrink-…), then the report from them
// Known failures: tests/golden/sweep-known.yaml (id = "<angle> <digits> <latex>", check = the judge's check, package = the open backlog id): the gate's exact list.
// --nightly reads it and tests/golden/sweep-nightly-known.yaml (A44, same fields; the nightly fuzz adds its open findings there; a row whose case passes is
// listed as "now passing", report only); the gate run never reads the nightly file.
// Environment: GIAC_OUT as for the golden gate; N62_DL_DIR is not used. Needs mpmath (tests/golden/.venv).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnown, splitNightly, sweepFailures } from "./sweep-known.ts";
import { addStats, failedOf, mergeParts, parsePart, readSet, sliceOf, statsLine, sweepRuns, writeSaved, type Failed, type Header, type Loaded, type PartFile, type ShrinkFile } from "./sweep-parts.ts";
import { invariantsStage } from "./invariants.ts";
import { childrenOf } from "../../tools/probes/sweep/edges.ts";
import { reportMarkdown, shrink, type Finding } from "../../tools/probes/sweep/nightly.ts";
import { pythonFor, Runner, runsOf } from "../../tools/probes/sweep/run.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();

const args = process.argv.slice(2);
const edgesFlag = args.includes("--edges");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const textFlag = (name: string): string | undefined => args[args.indexOf(name) + 1];
const GATE_SEED = 20261021;
const shrinkSeed = flag("--shrink");
const nightly = args.includes("--nightly") || shrinkSeed !== null;
const part = args.includes("--part") ? parsePart(textFlag("--part")) : null;
function die(msg: string, code = 1): never {
  console.error(msg);
  return process.exit(code);
}
/** A loaded part set, or the message that names what is missing and exit 1. */
const need = <T extends Header>(r: Loaded<T>): Extract<Loaded<T>, { ok: true }> => (r.ok ? r : die(`SWEEP SHRINK: ${r.message}`));
if (args.includes("--part") && !part) die("--part wants i/n with 1 <= i <= n", 2);
if (part && shrinkSeed === null && !(nightly && flag("--seed") !== null)) die("--part needs --nightly and an explicit --seed (every part must sweep the same trees)", 2);
const seed = shrinkSeed ?? flag("--seed") ?? (nightly ? Math.floor(Date.now() / 1000) : GATE_SEED);
const DEADLINE_MS = 6000; // HOME_DEADLINE_MS is 2000; a case past this did not return at all
const python = pythonFor(repo, mainCheckout);
const oraclePy = resolve(repo, "tools/probes/sweep/oracle.py");
const tasksDir = process.env["SWEEP_TASKS_DIR"] ?? resolve(mainCheckout, ".tasks"); // SWEEP_TASKS_DIR: another folder for the report and the part files (a check run must not overwrite a night's report)

/** The nightly report: the failures not in the known files, shrunk (or the findings already shrunk in parts), written to .tasks/ and summarised in one line. */
async function nightlyReport(o: { edges: boolean; count: number; stats: ReturnType<typeof addStats>; failures: Failed[]; ran: ReadonlySet<string>; findingsOf: (failed: Failed[]) => Promise<Finding[]> }): Promise<void> {
  const known = loadKnown(repo, true);
  const split = splitNightly(o.failures, known, o.ran);
  for (const k of split.nowPassing) console.log(`NOW PASSING (nightly row, remove it from tests/golden/sweep-nightly-known.yaml) ${k.id} [${k.check}] (${k.package})`);
  for (const { run: j } of split.fresh) console.log(`FINDING ${j.angle} ${j.digits} ${j.latex} [${j.verdict.check ?? j.verdict.kind}]: ${j.verdict.detail ?? ""}`);
  const findings = await o.findingsOf(split.fresh);
  const per1000 = (o.stats.secs * 1000) / o.count;
  const stats = statsLine(o.stats, o.count, seed);
  const date = new Date().toISOString().slice(0, 10);
  const file = resolve(tasksDir, `sweep-${date}-${seed}.md`);
  const passingNote = split.nowPassing.length ? [`Nightly rows now passing (remove from tests/golden/sweep-nightly-known.yaml): ${split.nowPassing.map((k) => `${k.package}`).join(", ")}.`, ""] : [];
  const head = [
    `# Oracle sweep ${date}, seed ${seed}${o.edges ? " (edges)" : ""}`,
    "",
    `Repeat: \`node scripts/sweep.ts --nightly${o.edges ? " --edges" : ""} --seed ${seed} --count ${o.count}\` (from app/). ${stats}; ${per1000.toFixed(1)} s per 1,000 trees.`,
    "",
    ...passingNote,
  ];
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${reportMarkdown(head, findings)}\n`);
  console.log(`SWEEP NIGHTLY: ${o.failures.length} failures (${split.fresh.length} not in the known files, ${split.nowPassing.length} nightly rows now passing); ${stats}; ${per1000.toFixed(1)} s per 1,000 trees; report ${file}`);
}

const shrinkAll = async (failed: Failed[]): Promise<Finding[]> => {
  const runner = new Runner(DEADLINE_MS);
  return shrink(failed, childrenOf, runner, python, oraclePy).finally(() => runner.close());
};

if (shrinkSeed !== null) {
  // G167: the shrink and the report from the saved parts of a seed
  const loaded = need(readSet<PartFile>(tasksDir, "part", seed, { count: flag("--count"), edges: edgesFlag ? true : undefined }));
  const { count, edges } = loaded;
  const merged = mergeParts(loaded.files);
  console.log(`SWEEP SEED ${seed}${edges ? " --edges" : ""} (${loaded.of} parts of ${count} trees: ${merged.stats.runs} runs, ${merged.failed.length} failures)`);
  const known = loadKnown(repo, true);
  const fresh = splitNightly(merged.failed, known, merged.ran).fresh;
  const shrinkPart = args.includes("--part") ? part : null;
  if (shrinkPart) {
    const t0 = performance.now();
    const mine = sliceOf(fresh, shrinkPart);
    const findings = await shrinkAll(mine);
    const out = writeSaved(tasksDir, "shrink", { seed, count, edges, part: shrinkPart.i, of: shrinkPart.n, failedCount: fresh.length, findings } satisfies ShrinkFile);
    console.log(`SWEEP SHRINK PART ${shrinkPart.i}/${shrinkPart.n}: ${mine.length} of ${fresh.length} failures shrunk in ${((performance.now() - t0) / 1000).toFixed(1)} s; ${out}`);
    process.exit(0);
  }
  if (args.includes("--join")) {
    const shrunk = need(readSet<ShrinkFile>(tasksDir, "shrink", seed, { count, edges }));
    if (!shrunk.ok) process.exit(1);
    if (shrunk.files.some((f) => f.failedCount !== fresh.length)) die(`SWEEP SHRINK: the shrink parts were cut from another failure list than the ${fresh.length} the sweep parts give now (the known files changed?); shrink again`);
    await nightlyReport({ edges, count, stats: merged.stats, failures: merged.failed, ran: merged.ran, findingsOf: async () => shrunk.files.flatMap((f) => f.findings) });
  } else {
    await nightlyReport({ edges, count, stats: merged.stats, failures: merged.failed, ran: merged.ran, findingsOf: shrinkAll });
  }
  process.exit(0);
}

const edges = edgesFlag;
const count = flag("--count") ?? (nightly ? (edges ? 5000 : 25_000) : Number(process.env["SWEEP_COUNT"] ?? 1000));
if (nightly) console.log(`SWEEP SEED ${seed}${edges ? " --edges" : ""} (repeat: node scripts/sweep.ts --nightly${edges ? " --edges" : ""} --seed ${seed} --count ${count})`);
const allRuns = runsOf(seed, count, edges);
const runs = part ? sliceOf(allRuns, part) : allRuns;
const { judged, oracles, stats } = await sweepRuns(runs, python, oraclePy, DEADLINE_MS);
const failures = sweepFailures(judged);

if (part) {
  const from = allRuns.indexOf(runs[0]!);
  const file: PartFile = { seed, count, edges, part: part.i, of: part.n, total: allRuns.length, from: runs.length ? from : 0, to: runs.length ? from + runs.length : 0, ran: judged.map((j) => `${j.angle} ${j.digits} ${j.latex}`), failed: failedOf(judged, oracles), stats };
  const out = writeSaved(tasksDir, "part", file);
  console.log(`SWEEP PART ${part.i}/${part.n}: runs ${file.from + 1}–${file.to} of ${allRuns.length}, ${file.failed.length} failures; ${statsLine(stats, count, seed)}; ${((stats.secs * 1000) / Math.max(1, (count * runs.length) / allRuns.length)).toFixed(1)} s per 1,000 trees; ${out}`);
  process.exit(0);
}
if (nightly) {
  await nightlyReport({ edges, count, stats, failures: failedOf(judged, oracles), ran: new Set(judged.map((j) => `${j.angle} ${j.digits} ${j.latex}`)), findingsOf: shrinkAll });
  process.exit(0);
}
const known = loadKnown(repo, false);
const secs = stats.secs;
const r = invariantsStage(failures, known.gate);
for (const l of r.lines) console.log(`  sweep ${l}`);
const ok = r.ok && secs < 60;
console.log(`${ok ? "SWEEP PASSED" : "SWEEP FAILED"}: ${statsLine(stats, count, seed)}; ${r.summary}${secs < 60 ? "" : " (over 60 s)"}`);
process.exit(ok ? 0 : 1);
