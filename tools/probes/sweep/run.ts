// SPDX-License-Identifier: GPL-3.0-or-later
// G61: run generated inputs through the parser, the host (worker thread, deadline per case) and the oracle, and judge them.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { latexToGiac } from "../../../app/src/input/latex-to-giac.ts";
import { generate, PINNED } from "./gen.ts";
import { judge, type Oracle, type Shown, type Verdict } from "./judge.ts";
import type { Job } from "./worker.ts";

export interface Run {
  latex: string;
  mp: string;
  angle: "rad" | "deg";
  digits: 12 | 30;
}
export interface Judged extends Run {
  verdict: Verdict;
  shown?: Shown;
  ms: number;
}

/** The runs of a seed: the pinned inputs, then every tree in RAD at 12 or 30 digits, trees with an angle function also in DEG. Duplicates dropped. */
export function runsOf(seed: number, count: number): Run[] {
  const seen = new Set<string>();
  const out: Run[] = [];
  const all = [...PINNED.map((c) => ({ c, digits: 12 as const })), ...generate(seed, count).map((c, i) => ({ c, digits: (i % 2 === 0 ? 12 : 30) as 12 | 30 }))];
  all.forEach(({ c, digits }) => {
    for (const angle of c.angle ? (["rad", "deg"] as const) : (["rad"] as const)) {
      const key = `${angle} ${digits} ${c.latex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ latex: c.latex, mp: c.mp, angle, digits });
    }
  });
  return out;
}

/** The python with mpmath: tests/golden/.venv of this or the main checkout, else python3. */
export function pythonFor(repo: string, mainCheckout: string): string {
  for (const root of [repo, mainCheckout]) {
    const p = resolve(root, "tests/golden/.venv/bin/python");
    if (existsSync(p)) return p;
  }
  return "python3";
}

export function oracleFor(runs: readonly Run[], python: string, oraclePy: string): Oracle[] {
  const r = spawnSync(python, ["-I", oraclePy], { input: JSON.stringify(runs.map((x) => ({ mp: x.mp, deg: x.angle === "deg" }))), encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60_000 });
  if (r.status !== 0) throw new Error(`oracle.py failed (${python}, mpmath needed): ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" | ")}`);
  return JSON.parse(r.stdout) as Oracle[];
}

/** One worker thread with a deadline per job. */
export class Runner {
  private w: Worker | null = null;
  private id = 0;
  readonly restarts = { n: 0 };
  private readonly deadlineMs: number;
  constructor(deadlineMs: number) {
    this.deadlineMs = deadlineMs;
  }

  private start(): Promise<Worker> {
    const w = new Worker(new URL("./worker.ts", import.meta.url));
    this.w = w;
    return new Promise((res, rej) => {
      w.once("error", rej);
      w.once("message", () => {
        w.off("error", rej);
        res(w);
      });
    });
  }

  async run(giac: string, angle: "rad" | "deg", digits: number): Promise<Shown> {
    const w = this.w ?? (await this.start());
    const job: Job = { id: ++this.id, giac, angle, digits };
    return new Promise((res) => {
      const done = (s: Shown): void => {
        clearTimeout(t);
        w.off("message", on);
        w.off("error", onErr);
        res(s);
      };
      const on = (m: { id: number; shown: Shown }): void => {
        if (m.id === job.id) done(m.shown);
      };
      const kill = (s: Shown): void => {
        this.w = null;
        this.restarts.n++;
        void w.terminate();
        done(s);
      };
      const onErr = (e: Error): void => kill({ ok: false, error: "engine", display: `worker error: ${e.message}` });
      const t = setTimeout(() => kill({ hang: true }), this.deadlineMs);
      w.on("message", on);
      w.on("error", onErr);
      w.postMessage(job);
    });
  }

  async close(): Promise<void> {
    await this.w?.terminate();
    this.w = null;
  }
}

export interface SweepResult {
  judged: Judged[];
  refused: number;
  restarts: number;
}

/** Runs and judges; `budgetMs` stops early (nightly runs are long, the gate's fixed seed fits). */
export async function sweep(runs: readonly Run[], oracles: readonly Oracle[], deadlineMs: number): Promise<SweepResult> {
  const runner = new Runner(deadlineMs);
  const judged: Judged[] = [];
  let refused = 0;
  try {
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!;
      const oracle = oracles[i]!;
      let giac: string;
      try {
        giac = latexToGiac(run.latex);
      } catch (e) {
        refused++;
        judged.push({ ...run, verdict: { kind: "skip", detail: `parser refused: ${(e as Error).message.slice(0, 60)}` }, ms: 0 });
        continue;
      }
      const t0 = performance.now();
      const shown = await runner.run(giac, run.angle, run.digits);
      judged.push({ ...run, verdict: judge(shown, oracle, run.digits), shown, ms: performance.now() - t0 });
    }
  } finally {
    await runner.close();
  }
  return { judged, refused, restarts: runner.restarts.n };
}
