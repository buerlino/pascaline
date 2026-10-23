// SPDX-License-Identifier: GPL-3.0-or-later
// G62: sequences and state as a gate stage (r16 section 3.2): random action sequences (store, Ans and chips, a function body, a relaunch from the
// definitions log, Copy, a Solve root as a known, a bound variable named as a stored one) judged by one invariant: a value read later shows the
// text and the mark it had when it left the line (tools/probes/sweep/seq.ts).
//   node scripts/seqsweep.ts                      # the gate stage: fixed seed, SEQ_COUNT sequences (default 300), exit 1 on a new failure or past 30 s
//   node scripts/seqsweep.ts --nightly [--seed N] [--count N]   # rotating seed, default 2000 sequences, report only
// Known failures: tests/golden/seqsweep-known.yaml (id = the sequence, check = the carrier, package = the open backlog id). Environment: GIAC_OUT.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost, setGiacHostGlobals } from "../src/engine/host.ts";
import { nodeHost } from "../src/engine/nodeGiac.ts";
import { invariantsStage, type KnownFailure } from "./invariants.ts";
import { runSequences, sequencesOf } from "../../tools/probes/sweep/seq.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261021;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 2000 : Number(process.env["SEQ_COUNT"] ?? 300));
const BUDGET_S = 30;
const t0 = performance.now();
setGiacHostGlobals();
const fresh = async (): Promise<EngineHost> => (await nodeHost());
const seqs = sequencesOf(seed, count);
const r = await runSequences(seqs, fresh);
// one line per class: a failing read met in many sequences counts once
r.failures = [...new Map(r.failures.map((f) => [`${f.id} ${f.check}`, f])).values()];
const secs = (performance.now() - t0) / 1000;
const stats = `${seqs.length} sequences (seed ${seed}): ${r.checked} reads checked, ${r.relaunches} relaunches, total ${secs.toFixed(1)} s`;

if (nightly) {
  for (const f of r.failures) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
  console.log(`SEQ NIGHTLY: ${r.failures.length} findings; ${stats}`);
  process.exit(0);
}
const known = parse(readFileSync(resolve(repo, "tests/golden/seqsweep-known.yaml"), "utf8")) as { known?: KnownFailure[] };
const v = invariantsStage(r.failures, known.known ?? []);
for (const l of v.lines) console.log(`  seq ${l}`);
const ok = v.ok && secs < BUDGET_S;
console.log(`SEQ ${ok ? "PASSED" : "FAILED"}: ${stats}; ${v.summary}${secs < BUDGET_S ? "" : ` (over ${BUDGET_S} s)`}`);
process.exit(ok ? 0 : 1);
