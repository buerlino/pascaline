// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census run. Every Find tier-1 function's samples (samples.ts) through our parser and the host, in Home and in CAS, each
// in a worker thread with a deadline; the numbers judged against oracle.py; each input classed (classify.ts). The inputs are cut into
// `workers` fixed runs of consecutive inputs, one worker each, so the order on each engine (and what one input leaves for the next,
// until a state change, a hang or a crash starts a new engine) is the same on every run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { giacOfEntry } from "../../../app/src/input/entry.ts";
import { classify, type CensusClass, type CensusOracle } from "./classify.ts";
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
  /** G111: the find/functions.yaml exclude group that leaves it out of Find's index (the census still runs it). */
  leftOut?: string;
}

/** The Find index's tier-1 functions (app/src/find/_gen/find-index.json, `npm run index`). */
export function tier1(repo: string): Entry[] {
  const index = join(repo, "app/src/find/_gen/find-index.json");
  if (!existsSync(index)) throw new Error("no Find index: run `npm run index` in app/ first");
  const items = JSON.parse(readFileSync(index, "utf8")) as { id: string; kind: string; tier?: number; names: string[] }[];
  return items.filter((i) => i.kind === "fn" && i.tier === 1).map((i) => ({ name: i.id.slice(3), names: i.names }));
}

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
/** Giac's help entries in order, each with its names as the index generator keeps them (tools/find-index/generate.mjs: typeable
 *  names, an all-capital spelling of another one dropped); the first is the Find id's name. */
function helpEntries(aide: string): string[][] {
  const out: string[][] = [];
  for (const line of aide.split("\n")) {
    if (!line.startsWith("# ")) continue;
    const names = line.slice(2).trim().split(/\s+/).filter((n) => IDENT.test(n));
    out.push(names.filter((n) => !(n === n.toUpperCase() && /[A-Z]/.test(n) && names.some((m) => m !== n && m.toUpperCase() === n))));
  }
  return out;
}

/**
 * G111: the census's functions: Find's tier-1 ones (tier1) and those of the exclude groups find/functions.yaml's `census` names
 * (left out of the index, run all the same, so an upstream fix shows), in the order of Giac's help, as the index holds them: the
 * order decides what one input leaves for the next on an engine (run.ts census).
 */
export function censusEntries(repo: string, aide: string): Entry[] {
  const YAML = createRequire(join(repo, "app/package.json"))("yaml") as { parse: (s: string) => unknown };
  const fns = (YAML.parse(readFileSync(join(repo, "find/functions.yaml"), "utf8")) ?? {}) as { exclude?: Record<string, string[]>; census?: string[] };
  const help = helpEntries(aide);
  // an entry's place: the first help entry whose first name it is (the Find id's name)
  const at = new Map<string, number>();
  help.forEach((names, k) => {
    if (names[0] !== undefined && !at.has(names[0])) at.set(names[0], k);
  });
  const left: Entry[] = [];
  for (const group of fns.census ?? []) {
    for (const n of fns.exclude?.[group] ?? []) {
      const k = at.get(n);
      if (k === undefined) throw new Error(`find/functions.yaml census group ${group}: no Giac help entry named first ${n}`);
      left.push({ name: n, names: help[k]!, leftOut: group });
    }
  }
  const index = tier1(repo);
  const pos = (e: Entry): number => at.get(e.name) ?? Number.MAX_SAFE_INTEGER;
  const out = [...index, ...left].map((e, i) => ({ e, i })).sort((a, b) => pos(a.e) - pos(b.e) || a.i - b.i).map((x) => x.e);
  // the index's own entries keep their order
  const kept = out.filter((e) => !e.leftOut);
  if (kept.some((e, i) => e !== index[i])) throw new Error("census entries: the left-out functions moved the index's order");
  return out;
}

/** Giac's help text from the pinned tarball (tools/find-index/state.mjs; PASCALINE_DL_DIR, default the main checkout's cache). */
export async function aideCas(mainCheckout: string): Promise<string> {
  process.env["PASCALINE_DL_DIR"] ??= join(mainCheckout, "engine/giac/_downloads");
  // a URL, not a literal specifier: state.mjs is plain JavaScript without types
  const st = (await import(new URL("../../find-index/state.mjs", import.meta.url).href)) as {
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
  /** G111: the functions left out of Find's index that the census runs, with their exclude group. */
  leftOut: { name: string; group: string }[];
}

export function plan(entries: readonly Entry[], aide: string, only?: ReadonlySet<string>): Plan {
  const ex = helpExamples(aide);
  const samples: Sample[] = [];
  const none: Plan["none"] = [];
  const leftOut: Plan["leftOut"] = [];
  for (const e of entries) {
    if (only && !only.has(e.name)) continue;
    if (e.leftOut) leftOut.push({ name: e.name, group: e.leftOut });
    const s = samplesOf(e.name, e.names, ex.get(e.name) ?? []);
    if ("none" in s) none.push({ name: e.name, why: s.none });
    else samples.push(...s);
  }
  return { samples, none, leftOut };
}

/** G111: the census line of the functions left out of Find, by exclude group (`167 left out of Find: graphics 103, …`). */
export function leftOutLine(left: Plan["leftOut"]): string {
  const by = new Map<string, number>();
  for (const l of left) by.set(l.group, (by.get(l.group) ?? 0) + 1);
  return `${left.length} left out of Find${left.length ? `: ${[...by].map(([g, n]) => `${g} ${n}`).join(", ")}` : ""}`;
}

export function pythonFor(repo: string, mainCheckout: string): string {
  for (const root of [repo, mainCheckout]) {
    const p = resolve(root, "tests/golden/.venv/bin/python");
    if (existsSync(p)) return p;
  }
  return "python3";
}

export function oracleFor(samples: readonly Sample[], python: string, oraclePy: string): CensusOracle[] {
  const r = spawnSync(python, ["-I", oraclePy], { input: JSON.stringify(samples.map((s) => ({ name: s.name, args: s.py }))), encoding: "utf8", maxBuffer: 64 << 20, timeout: 5 * 60_000 });
  if (r.status !== 0) throw new Error(`findcensus oracle.py failed (${python}, mpmath needed): ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" | ")}`);
  return JSON.parse(r.stdout) as CensusOracle[];
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
export async function census(samples: readonly Sample[], oracles: readonly CensusOracle[], deadlineMs: number, workers: number): Promise<CensusResult> {
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
