// SPDX-License-Identifier: GPL-3.0-or-later
// G64: CAS answers checked back as a gate stage (r16 section 3): an antiderivative differentiates to the integrand, a solution
// substitutes to 0, a factorisation expands back, a simplification agrees at three points (tools/probes/casback/check.ts).
// Questions: G55's corpus (tests/golden/corpus.yaml, the checkable ones) and generated ones from a fixed seed.
//   node scripts/casback.ts                       # the gate stage: fixed seed, CASBACK_COUNT generated questions (default 120), exit 1 on a new failure or past 30 s
//   node scripts/casback.ts --nightly [--seed N] [--count N]   # rotating seed, default 1200, report only
// Known failures: tests/golden/casback-known.yaml (id = the question, check = its kind, package = the open backlog id). Environment: GIAC_OUT.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { setGiacHostGlobals } from "../src/engine/host.ts";
import { nodeHost } from "../src/engine/nodeGiac.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { checkBack, fromCorpus, generated, type At } from "../../tools/probes/casback/check.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261024;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 1200 : Number(process.env["CASBACK_COUNT"] ?? 120));
const BUDGET_S = 30;
const t0 = performance.now();
setGiacHostGlobals();
const host = await nodeHost();
const cas = (input: string): string => host.cas(input, defaultCasSettings).result.text;
const NUMBER = /^-?\d+(\.\d*)?(e[-+]?\d+)?$/i;
const at: At = (expr, x) => {
  const t = cas(`evalf(subs(${expr},x=${x}))`).trim();
  return NUMBER.test(t) ? Number(t) : null;
};

const corpus = parse(readFileSync(resolve(repo, "tests/golden/corpus.yaml"), "utf8")) as { cases: { input: string }[] };
const fromFile = fromCorpus(corpus.cases.map((c) => c.input));
const questions = [...fromFile.questions, ...generated(seed, count)];
let checked = 0;
let skipped = fromFile.skipped;
const failures: InvariantFailure[] = [];
for (const q of questions) {
  const answer = cas(q.input);
  const v = checkBack(q, answer, at);
  if (v.status === "skip") skipped++;
  else {
    checked++;
    if (v.status === "wrong") failures.push({ id: q.id, check: q.kind, detail: `${q.input} -> ${answer}: ${v.detail}` });
  }
}
const unique = [...new Map(failures.map((f) => [`${f.id} ${f.check}`, f])).values()];
const secs = (performance.now() - t0) / 1000;
const stats = `${questions.length} questions (seed ${seed}): ${checked} checked, ${skipped} skipped as not checkable, ${unique.length} failed, total ${secs.toFixed(1)} s`;

if (nightly) {
  for (const f of unique) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
  console.log(`CASBACK NIGHTLY: ${stats}`);
  process.exit(0);
}
const known = parse(readFileSync(resolve(repo, "tests/golden/casback-known.yaml"), "utf8")) as { known?: KnownFailure[] };
const v = invariantsStage(unique, known.known ?? []);
for (const l of v.lines) console.log(`  casback ${l}`);
const ok = v.ok && secs < BUDGET_S;
console.log(`CASBACK ${ok ? "PASSED" : "FAILED"}: ${stats}; ${v.summary}${secs < BUDGET_S ? "" : ` (over ${BUDGET_S} s)`}`);
process.exit(ok ? 0 : 1);
