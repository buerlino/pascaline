// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census run. Every Find tier-1 function's samples (samples.ts) through our parser and the host, in Home and in CAS, each
// in a worker thread with a deadline; the numbers judged against oracle.py; each input classed (classify.ts). The inputs are cut into
// `workers` fixed runs of consecutive inputs, one worker each, so the order on each engine (and what one input leaves for the next,
// until a state change, a hang or a crash starts a new engine) is the same on every run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { giacOfEntry } from "../../../app/src/input/entry.ts";
import type { Oracle } from "../sweep/judge.ts";
import { classify, type CensusClass } from "./classify.ts";
import { helpExamples, samplesOf, type Sample } from "./samples.ts";
import type { Answer, Job } from "./worker.ts";

export type View = "home" | "cas";

export interface Row {
  /** `<view> <name>/<k>`: k 0 is the help's example, 1… its number variants. */
  id: string;
  name: string;
  view: View;
  latex: string;
  /** What our parser sent to Giac (absent when it refused). */
  giac?: string;
  cls: CensusClass;
  detail: string;
  /** Bridge-3's kind of Giac's answer (worker.ts), absent after a hang, a crash or a parser refusal. */
  kind?: string;
  ms: number;
}

export interface Entry {
  name: string;
  names: string[];
}

/** The Find index's tier-1 functions (app/src/find/_gen/find-index.json, `npm run index`). */
export function tier1(repo: string): Entry[] {
  const index = join(repo, "app/src/find/_gen/find-index.json");
  if (!existsSync(index)) throw new Error("no Find index: run `npm run index` in app/ first");
  const items = JSON.parse(readFileSync(index, "utf8")) as { id: string; kind: string; tier?: number; names: string[] }[];
  return items.filter((i) => i.kind === "fn" && i.tier === 1).map((i) => ({ name: i.id.slice(3), names: i.names }));
}

/** Giac's help text from the pinned tarball (tools/find-index/state.mjs; PASCALINE_DL_DIR, default the main checkout's cache). */
export async function aideCas(mainCheckout: string): Promise<string> {
  process.env["PASCALINE_DL_DIR"] ??= join(mainCheckout, "engine/giac/_downloads");
  const st = (await import("../../find-index/state.mjs")) as unknown as {
    SOURCES: { giac: unknown };
    tarball: (s: unknown) => string;
    member: (p: string, n: string) => string;
  };
  return st.member(st.tarball(st.SOURCES.giac), "giac-2.1.0/doc/aide_cas");
}

export interface Plan {
  samples: Sample[];
  /** Entries without a sample, with the reason. */
  none: { name: string; why: string }[];
}

export function plan(entries: readonly Entry[], aide: string, only?: ReadonlySet<string>): Plan {
  const ex = helpExamples(aide);
  const samples: Sample[] = [];
  const none: Plan["none"] = [];
  for (const e of entries) {
    if (only && !only.has(e.name)) continue;
    const s = samplesOf(e.name, e.names, ex.get(e.name) ?? []);
    if ("none" in s) none.push({ name: e.name, why: s.none });
    else samples.push(...s);
  }
  return { samples, none };
}

export function pythonFor(repo: string, mainCheckout: string): string {
  for (const root of [repo, mainCheckout]) {
    const p = resolve(root, "tests/golden/.venv/bin/python");
    if (existsSync(p)) return p;
  }
  return "python3";
}

export function oracleFor(samples: readonly Sample[], python: string, oraclePy: string): Oracle[] {
  const r = spawnSync(python, ["-I", oraclePy], { input: JSON.stringify(samples.map((s) => ({ name: s.name, args: s.py }))), encoding: "utf8", maxBuffer: 64 << 20, timeout: 5 * 60_000 });
  if (r.status !== 0) throw new Error(`findcensus oracle.py failed (${python}, mpmath needed): ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" | ")}`);
  return JSON.parse(r.stdout) as Oracle[];
}

/** How long bridge-3's second evaluation (the kind) may take. */
const KIND_MS = 3000;

/** One engine worker with a deadline per job; a hang or a crash ends it, and the next job starts a new one. */
class Runner {
  private w: Worker | null = null;
  private id = 0;
  restarts = 0;
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

  private drop(): void {
    const w = this.w;
    this.w = null;
    this.restarts++;
    void w?.terminate();
  }

  /** The view's answer, and bridge-3's kind of the same text (a second message, KIND_MS later at most; "slow" past it). */
  async run(view: View, giac: string): Promise<{ a: Answer | { hang: true }; kind?: string }> {
    const w = this.w ?? (await this.start());
    const job: Job = { id: ++this.id, view, giac };
    return new Promise((res) => {
      let answer: Answer | null = null;
      let t = setTimeout(() => finish({ hang: true }, undefined, true), this.deadlineMs);
      const finish = (a: Answer | { hang: true }, kind: string | undefined, drop: boolean): void => {
        clearTimeout(t);
        w.off("message", on);
        w.off("error", onErr);
        if (drop) this.drop();
        res(kind === undefined ? { a } : { a, kind });
      };
      const on = (m: { id: number; answer?: Answer; kind?: string; dirty?: boolean }): void => {
        if (m.id !== job.id) return;
        if (m.answer) {
          answer = m.answer;
          // a state change or a crash: no kind follows, and the next input gets a fresh engine
          if (m.answer.crash !== undefined || m.answer.left.length) return finish(m.answer, undefined, true);
          clearTimeout(t);
          t = setTimeout(() => finish(answer!, "slow", true), KIND_MS);
          return;
        }
        if (answer) finish(answer, m.kind, m.dirty === true);
      };
      const onErr = (e: Error): void => finish(answer ?? { ok: false, text: "", left: [], crash: `worker error: ${e.message}`.slice(0, 120) }, answer ? "error" : undefined, true);
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

export interface CensusResult {
  rows: Row[];
  restarts: number;
}

/** Every sample in Home and in CAS, on `workers` engines. Rows come back in input order. */
export async function census(samples: readonly Sample[], oracles: readonly Oracle[], deadlineMs: number, workers: number): Promise<CensusResult> {
  const jobs = samples.flatMap((s, i) => (["home", "cas"] as const).map((view) => ({ s, oracle: oracles[i] ?? null, view })));
  const rows: Row[] = new Array<Row>(jobs.length);
  const per = Math.ceil(jobs.length / workers);
  let restarts = 0;
  await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      const runner = new Runner(deadlineMs);
      try {
        for (let j = w * per; j < Math.min(jobs.length, (w + 1) * per); j++) {
          const { s, oracle, view } = jobs[j]!;
          const id = `${view} ${s.name}/${s.k}`;
          let giac: string;
          try {
            giac = giacOfEntry(s.latex, view).giac;
          } catch (e) {
            const v = classify(s.name, view, "", { parserError: (e as Error).message }, oracle);
            rows[j] = { id, name: s.name, view, latex: s.latex, cls: v.cls, detail: v.detail, ms: 0 };
            continue;
          }
          const t0 = performance.now();
          const { a, kind } = await runner.run(view, giac);
          const ms = performance.now() - t0;
          const v = classify(s.name, view, giac, a, oracle);
          rows[j] = { id, name: s.name, view, latex: s.latex, giac, cls: v.cls, detail: v.detail, ...(kind ? { kind } : {}), ms };
        }
      } finally {
        restarts += runner.restarts;
        await runner.close();
      }
    }),
  );
  return { rows, restarts };
}
