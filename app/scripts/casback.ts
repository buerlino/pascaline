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
import { loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { EngineHost } from "../src/engine/host.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { generate } from "../../tools/probes/sweep/gen.ts";
import { compileDefinition } from "../src/apps/function/compile.ts";
import { checkBack, fromCorpus, generated, type At, type Entries, type Probe, type Question } from "../../tools/probes/casback/check.ts";

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
const loaded = await loadNodeGiac();
const host = new EngineHost(loaded.giac, loaded.bridge);
const cas = (input: string): string => host.cas(input, defaultCasSettings).result.text;
// P20: kinds and list entries come from Giac's bridge (bridge-3), not from a regex or a bracket loop over its text.
const UNRESOLVED_HEADS: ReadonlySet<string> = new Set(["int", "integrate", "solve", "undef", "="]);
const REAL = new Set(["integer", "rational", "float", "symbolic"]);
const at: At = (expr, x) => {
  const v = loaded.bridge.value(`subs(${expr},x=${x})`, [12]);
  const p = v.at?.["12"];
  if (!REAL.has(v.kind) || !p || p.length !== 1) return null;
  const [re, im] = p[0]!;
  const r = Number(re);
  return Number(im) === 0 && Number.isFinite(r) ? r : null;
};
const entries: Entries = (text) => {
  const v = loaded.bridge.value(text, []);
  return v.kind === "list" && v.elements ? v.elements : null;
};

const probe: Probe = (text) => ({
  kind: loaded.bridge.value(text, []).kind,
  unresolved: loaded.bridge.parse(text).heads.some((h) => UNRESOLVED_HEADS.has(h)),
});

const corpus = parse(readFileSync(resolve(repo, "tests/golden/corpus.yaml"), "utf8")) as { cases: { input: string }[] };
const fromFile = fromCorpus(corpus.cases.map((c) => c.input));
// G61's generator: expressions in x (depth 2) compiled to Giac by the function app's own compiler
const fromG61: Question[] = [];
for (const c of generate(seed, Math.ceil(count / 4), { x: true, depth: 2 })) {
  const k = compileDefinition(c.latex, "rad");
  if (k.giac !== "" && k.error === "" && !fromG61.some((q) => q.subject === k.giac)) fromG61.push({ id: `simplification: ${c.latex}`, kind: "simplification", input: `simplify(${k.giac})`, subject: k.giac });
}
const questions = [...fromFile.questions, ...generated(seed, count), ...fromG61];
let checked = 0;
let skipped = fromFile.skipped;
const failures: InvariantFailure[] = [];
for (const q of questions) {
  const answer = cas(q.input);
  const v = checkBack(q, answer, at, entries, probe);
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
