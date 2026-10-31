// SPDX-License-Identifier: GPL-3.0-or-later
// A behaviour diff between two source trees (G55, night check 2026-10-19 section 2.4): the same fixed inputs run through
// each tree's own EngineHost (built as its nodeGiac.ts builds it: giac and bridge, A53), and every input whose display, mark,
// warn or why differs is printed. It reports and does not judge: it exits 0, unless more than half the runs of a tree throw
// or time out (A53: a host that cannot run compares nothing; then it exits 1 with the first message rather than say "none").
//   node scripts/behaviour-diff.ts <treeA> <treeB>      # tree = a checkout/worktree root (its app/src/engine is imported)
// A tree needs its own app/node_modules reachable (link it into a scratch worktree). Engine of tree A: $GIAC_MJS_A, of tree
// B: $GIAC_MJS_B (A53: a Giac patch shows only when the branch's tree runs the branch's engine); each falls back to
// $GIAC_MJS, else $GIAC_OUT/giac.mjs, else this repo's engine/giac/_out/gsl (a scratch worktree has no engine build).
// Inputs: the single-input cases of home.yaml, precision.yaml and bench.yaml (read from THIS repo), tests/golden/corpus.yaml,
// each in Home and CAS, at 12 and 30 digits, in RAD and DEG; then corpus.yaml's sequences in Home. Each configuration gets
// a fresh engine per tree, so stored names carry over only within it.
// A53: each tree runs in its own worker thread (behaviour-diff-worker.ts), the two side by side. A run with no answer in
// $BEHAVIOUR_RUN_SECONDS (10) is killed with its worker and shows as a timeout (the next run gets a fresh engine); the CAS
// view's hardTimeoutS is 0.8 of it (some inputs never reach Giac's check: precision.yaml's Home-budget cases run on in CAS).
// An input that times out in both trees is not run again in that view, and is listed at the end.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { parse } from "yaml";
import type { Job, Row } from "./behaviour-diff-worker.ts";

const [ta, tb] = process.argv.slice(2);
if (!ta || !tb) {
  console.error("usage: node scripts/behaviour-diff.ts <treeA> <treeB>");
  process.exit(0);
}
const here = fileURLToPath(new URL("../../", import.meta.url));
const env = (k: string): string | undefined => process.env[k] || undefined;
const shared = env("GIAC_MJS") ?? (env("GIAC_OUT") ? `${env("GIAC_OUT")}/giac.mjs` : `${here}engine/giac/_out/gsl/giac.mjs`);
const mjs = [env("GIAC_MJS_A") ?? shared, env("GIAC_MJS_B") ?? shared] as const;
const limitS = Number(env("BEHAVIOUR_RUN_SECONDS") ?? 10);
const TIMEOUT_MARK = "⏱";

type Angle = "rad" | "deg";
type View = "home" | "cas";

/** One tree's worker: runs a job, and kills and restarts the worker when a run gives no answer within limitS. */
class Tree {
  private w!: Worker;
  private pending: ((m: unknown) => void) | null = null;
  /** A worker that died (a failed import): every later job gets this, and no restart. */
  private dead: string | null = null;
  private readonly dir: string;
  private readonly engine: string;
  constructor(dir: string, engine: string) {
    this.dir = dir;
    this.engine = engine;
    this.start();
  }
  private start(): void {
    const w = new Worker(new URL("./behaviour-diff-worker.ts", import.meta.url), { workerData: { dir: this.dir, mjs: this.engine, casTimeoutS: limitS * 0.8 } });
    this.w = w;
    // a killed worker's late message or error is not the new one's answer
    w.on("message", (m: unknown) => {
      if (w === this.w) this.settle(m);
    });
    w.on("error", (e: Error) => {
      if (w !== this.w) return;
      this.dead = `throws: ${e.message.split("\n")[0]}`;
      this.settle(null);
    });
  }
  private settle(m: unknown): void {
    const p = this.pending;
    this.pending = null;
    p?.(m);
  }
  /** The worker's answer, or null when it died or gave none in `ms` (then it is killed and a new one started). */
  private ask(job: Job, ms: number): Promise<unknown> {
    if (this.dead) return Promise.resolve(null);
    return new Promise((done) => {
      const timer = setTimeout(() => {
        this.pending = null;
        void this.w.terminate();
        this.start();
        done(null);
      }, ms);
      this.pending = (m) => {
        clearTimeout(timer);
        done(m);
      };
      this.w.postMessage(job);
    });
  }
  async fresh(): Promise<void> {
    // loading the engine takes well under a second; a minute covers a loaded machine
    await this.ask({ op: "fresh" }, 60_000);
  }
  async run(view: View, input: string, digits: number, angle: Angle): Promise<Row> {
    const r = (await this.ask({ op: "run", view, input, digits, angle }, limitS * 1000)) as Row | null;
    if (r) return r;
    if (this.dead) return { display: this.dead, mark: "!", warn: "", why: "" };
    await this.fresh();
    return { display: `timeout: no answer in ${limitS} s`, mark: TIMEOUT_MARK, warn: "", why: "" };
  }
  stop(): Promise<number> {
    return this.w.terminate();
  }
}

interface YamlCase {
  id?: string;
  input?: string;
  latex?: string;
  steps?: unknown;
  before?: unknown;
  beforeHome?: unknown;
  beforeCas?: unknown;
}
const golden = (f: string): YamlCase[] => (parse(readFileSync(`${here}tests/golden/${f}`, "utf8")) as { cases: YamlCase[] }).cases;
const inputs: string[] = [];
for (const f of ["home.yaml", "precision.yaml", "bench.yaml", "corpus.yaml"]) {
  for (const c of golden(f)) if (c.input && !c.latex && !c.steps && !c.before && !c.beforeHome && !c.beforeCas && !inputs.includes(c.input)) inputs.push(c.input);
}
const sequences = (parse(readFileSync(`${here}tests/golden/corpus.yaml`, "utf8")) as { sequences?: { id: string; steps: string[] }[] }).sequences ?? [];

const t0 = performance.now();
const trees = [new Tree(ta, mjs[0]), new Tree(tb, mjs[1])] as const;
const rows: string[][] = [];
let compared = 0;
/** A53: the runs of each tree, and how many threw or timed out (with the first message). */
const runs = [0, 0];
const failed = [0, 0];
const timeouts = [0, 0];
const firstFail: (string | undefined)[] = [undefined, undefined];
const tally = (k: 0 | 1, r: Row): Row => {
  runs[k]!++;
  if (r.mark === TIMEOUT_MARK) timeouts[k]!++;
  if (r.mark === "!" || r.mark === TIMEOUT_MARK) {
    failed[k]!++;
    firstFail[k] ??= r.display;
  }
  return r;
};
/** Inputs that timed out in both trees, by view: not run again in that view. */
const hung: Record<View, string[]> = { home: [], cas: [] };
const same = (a: Row, b: Row): boolean => a.display === b.display && a.mark === b.mark && a.warn === b.warn && a.why === b.why;
const fmtRow = (r: Row): string => `${r.mark} ${r.display}${r.warn ? ` warn=${r.warn}` : ""}${r.why ? ` why=${r.why}` : ""}`;
const clip = (s: string): string => (s.length > 90 ? `${s.slice(0, 87)}...` : s);
const fresh = (): Promise<unknown> => Promise.all(trees.map((t) => t.fresh()));
/** One input in both trees side by side; a difference becomes a row. */
async function both(where: string, label: string, view: View, input: string, digits: number, angle: Angle): Promise<void> {
  const [a, b] = await Promise.all([trees[0].run(view, input, digits, angle), trees[1].run(view, input, digits, angle)]);
  tally(0, a);
  tally(1, b);
  compared++;
  if (a.mark === TIMEOUT_MARK && b.mark === TIMEOUT_MARK && !hung[view].includes(input)) hung[view].push(input);
  if (!same(a, b)) rows.push([where, label, clip(fmtRow(a)), clip(fmtRow(b))]);
}

for (const view of ["home", "cas"] as const) {
  for (const digits of [12, 30]) {
    for (const angle of ["rad", "deg"] as const) {
      await fresh();
      for (const input of inputs) if (!hung[view].includes(input)) await both(`${view} ${digits} ${angle}`, input, view, input, digits, angle);
    }
  }
}
for (const digits of [12, 30]) {
  for (const angle of ["rad", "deg"] as const) {
    for (const seq of sequences) {
      await fresh();
      for (const [k, step] of seq.steps.entries()) await both(`seq ${seq.id} ${digits} ${angle}`, `#${k + 1} ${step}`, "home", step, digits, angle);
    }
  }
}
await Promise.all(trees.map((t) => t.stop()));

const secs = (): string => `${((performance.now() - t0) / 1000).toFixed(1)} s`;
console.log(`A = ${ta}\nB = ${tb}\nengine A ${mjs[0]}\nengine B ${mjs[1]}${mjs[0] === mjs[1] ? " (the same build)" : ""}\n${inputs.length} inputs x 8 settings + ${sequences.length} sequences x 4, ${compared} runs compared, ${limitS} s per run at most; timeouts A ${timeouts[0]}, B ${timeouts[1]}`);
const broken = ([0, 1] as const).filter((k) => failed[k]! * 2 > runs[k]!);
if (broken.length) {
  for (const k of broken) console.log(`tree ${"AB"[k]}: ${failed[k]} of ${runs[k]} runs throw or time out; the first: ${firstFail[k]}`);
  console.log('the diff compares nothing (A53): not "none"');
  console.log(secs());
  process.exit(1);
}
if (rows.length === 0) console.log("none");
else {
  console.log("| where | input | A | B |\n|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`);
  console.log(`${rows.length} difference(s)`);
}
for (const view of ["home", "cas"] as const) if (hung[view].length) console.log(`timed out in both trees in ${view} (not run again there): ${hung[view].map(clip).join("; ")}`);
console.log(secs());
