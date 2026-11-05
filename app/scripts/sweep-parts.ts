// SPDX-License-Identifier: GPL-3.0-or-later
// G167: the nightly sweep in pieces. One host-cpu hold lasts at most 10 minutes (rules section 4), and G138's run took 448 s to sweep and 163 s
// to shrink, so `scripts/sweep.ts --nightly` can run as `--part i/n` (the i-th of n slices of the seeded run list, its failures saved as JSON in
// .tasks/) and `--shrink <seed>` (reads every part, shrinks the failures not in the known files, writes the report), each piece under
// `tools/devlock.sh slice`. The pieces together give the failures and findings of the one-piece run: the slices are contiguous ranges of the one
// run list of a seed and count, whatever n is.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Oracle } from "../../tools/probes/sweep/judge.ts";
import type { Finding } from "../../tools/probes/sweep/nightly.ts";
import { oracleFor, sweep, type Judged, type Run } from "../../tools/probes/sweep/run.ts";
import { FAILING_KINDS } from "./sweep-known.ts";

export interface Part {
  i: number;
  n: number;
}

/** "i/n" with 1 <= i <= n, or null. */
export function parsePart(text: string | undefined): Part | null {
  const m = /^(\d+)\/(\d+)$/.exec(text ?? "");
  if (!m) return null;
  const i = Number(m[1]);
  const n = Number(m[2]);
  return i >= 1 && i <= n ? { i, n } : null;
}

/** The i-th of n contiguous slices of a list: together they are the list, whatever n is. */
export function sliceOf<T>(items: readonly T[], p: Part): T[] {
  return items.slice(Math.floor(((p.i - 1) * items.length) / p.n), Math.floor((p.i * items.length) / p.n));
}

/** A failing run with the oracle's value (the shrink needs both). */
export interface Failed {
  run: Judged;
  oracle: Oracle;
  id: string;
  check: string;
}

export const idOf = (j: { angle: string; digits: number; latex: string }): string => `${j.angle} ${j.digits} ${j.latex}`;

/** A saved run without its parsed value (the report and the shrink read only the verdict and the display). */
const slim = (j: Judged): Judged => {
  if (!j.shown?.value) return j;
  const { value: _value, ...shown } = j.shown;
  return { ...j, shown };
};

export function failedOf(judged: readonly Judged[], oracles: readonly Oracle[]): Failed[] {
  return judged
    .map((j, i) => ({ run: slim(j), oracle: oracles[i]!, id: idOf(j), check: j.verdict.check ?? j.verdict.kind }))
    .filter(({ run }) => FAILING_KINDS.includes(run.verdict.kind));
}

/** What the stats line counts. */
export interface Stats {
  runs: number;
  kinds: Record<string, number>;
  bareWarn: number;
  parserRefused: number;
  restarts: number;
  oracleSecs: number;
  secs: number;
}

export function statsOf(judged: readonly Judged[], parserRefused: number, restarts: number, oracleSecs: number, secs: number): Stats {
  const kinds: Record<string, number> = {};
  for (const j of judged) kinds[j.verdict.kind] = (kinds[j.verdict.kind] ?? 0) + 1;
  const bareWarn = judged.filter((j) => j.verdict.kind === "ok" && j.verdict.detail === "⚠ without a count").length;
  return { runs: judged.length, kinds, bareWarn, parserRefused, restarts, oracleSecs, secs };
}

export function addStats(a: readonly Stats[]): Stats {
  const kinds: Record<string, number> = {};
  for (const s of a) for (const [k, v] of Object.entries(s.kinds)) kinds[k] = (kinds[k] ?? 0) + v;
  const sum = (f: (s: Stats) => number): number => a.reduce((t, s) => t + f(s), 0);
  return { runs: sum((s) => s.runs), kinds, bareWarn: sum((s) => s.bareWarn), parserRefused: sum((s) => s.parserRefused), restarts: sum((s) => s.restarts), oracleSecs: sum((s) => s.oracleSecs), secs: sum((s) => s.secs) };
}

/** The run's stats line (sweep.ts prints it for the gate and the nightly report). */
export function statsLine(s: Stats, count: number, seed: number): string {
  const k = (name: string): number => s.kinds[name] ?? 0;
  const numbers = k("ok") + k("wrong");
  const crashes = k("crash");
  return `${s.runs} runs of ${count} trees (seed ${seed}): ${numbers} numbers judged, ${k("refused")} refused by Home,${crashes ? ` ${crashes} engine crashes,` : ""} ${k("nonnumber")} not numbers, ${k("skip")} skipped (${s.parserRefused} parser), ${s.bareWarn} bare ⚠ (${numbers ? ((100 * s.bareWarn) / numbers).toFixed(1) : "0"} %), ${s.restarts} worker restarts; oracle ${s.oracleSecs.toFixed(1)} s, total ${s.secs.toFixed(1)} s`;
}

/** The oracle and the judged runs of one list of runs (the whole run list or one slice). */
export async function sweepRuns(runs: readonly Run[], python: string, oraclePy: string, deadlineMs: number): Promise<{ judged: Judged[]; oracles: Oracle[]; stats: Stats }> {
  const t0 = performance.now();
  const oracles = oracleFor(runs, python, oraclePy);
  const tOracle = performance.now();
  const { judged, refused, restarts } = await sweep(runs, oracles, deadlineMs);
  return { judged, oracles, stats: statsOf(judged, refused, restarts, (tOracle - t0) / 1000, (performance.now() - t0) / 1000) };
}

/** What every saved file says about its run. */
export interface Header {
  seed: number;
  count: number;
  edges: boolean;
  part: number;
  of: number;
}
/** One sweep part: its failures (before the known files), the ids of all its runs (for "now passing") and its stats. */
export interface PartFile extends Header {
  /** The length of the whole run list and this part's range in it. */
  total: number;
  from: number;
  to: number;
  ran: string[];
  failed: Failed[];
  stats: Stats;
}
/** One shrink part: the findings of its slice of the failures not in the known files. */
export interface ShrinkFile extends Header {
  /** The number of failures the slices were cut from (a part set must agree). */
  failedCount: number;
  findings: Finding[];
}

export type Kind = "part" | "shrink";
const nameOf = (kind: Kind, h: Header): string => `sweep-${kind}-${h.seed}-${h.count}${h.edges ? "-edges" : ""}-${h.part}of${h.of}.json`;

export function writeSaved(dir: string, kind: Kind, file: PartFile | ShrinkFile): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nameOf(kind, file));
  writeFileSync(path, JSON.stringify(file));
  return path;
}

export type Loaded<T> = { ok: true; files: T[]; count: number; edges: boolean; of: number } | { ok: false; message: string };

/** Every file of a kind for a seed. They must be one complete set (the same count, edges and n, parts 1..n): otherwise the message names what is missing. */
export function readSet<T extends Header>(dir: string, kind: Kind, seed: number, only: { count?: number | null; edges?: boolean } = {}): Loaded<T> {
  const re = new RegExp(`^sweep-${kind}-${seed}-(\\d+)(-edges)?-(\\d+)of(\\d+)\\.json$`);
  const sets = new Map<string, { count: number; edges: boolean; of: number; parts: Map<number, string> }>();
  for (const f of existsSync(dir) ? readdirSync(dir).sort() : []) {
    const m = re.exec(f);
    if (!m) continue;
    const count = Number(m[1]);
    const edges = m[2] !== undefined;
    if ((only.count ?? count) !== count || (only.edges ?? edges) !== edges) continue;
    const key = `${count} ${edges} ${m[4]}`;
    const set = sets.get(key) ?? { count, edges, of: Number(m[4]), parts: new Map<number, string>() };
    set.parts.set(Number(m[3]), f);
    sets.set(key, set);
  }
  const label = (s: { count: number; edges: boolean; of: number }): string => `${s.count} trees${s.edges ? " --edges" : ""} in ${s.of} parts`;
  const missing = (s: { of: number; parts: Map<number, string> }): number[] => Array.from({ length: s.of }, (_, k) => k + 1).filter((p) => !s.parts.has(p));
  const all = [...sets.values()];
  if (all.length === 0) return { ok: false, message: `no ${kind} files for seed ${seed} in ${dir}` };
  const complete = all.filter((s) => missing(s).length === 0);
  if (complete.length > 1) return { ok: false, message: `several complete ${kind} sets for seed ${seed} (${complete.map(label).join("; ")}): narrow with --count or --edges, or remove the stale files` };
  const set = complete[0] ?? (all.length === 1 ? all[0]! : null);
  if (!set) return { ok: false, message: `no complete ${kind} set for seed ${seed}; sets found: ${all.map((s) => `${label(s)} (missing ${missing(s).join(", ")})`).join("; ")}` };
  const gone = missing(set);
  if (gone.length > 0) return { ok: false, message: `${kind} files of seed ${seed} (${label(set)}) are missing: ${gone.map((p) => `${p}/${set.of}`).join(", ")}` };
  const files = [...set.parts.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
  const bad = files.find((f) => f.seed !== seed || f.count !== set.count || f.edges !== set.edges || f.of !== set.of);
  if (bad) return { ok: false, message: `${kind} file ${nameOf(kind, bad)} says another run than its name` };
  return { ok: true, files, count: set.count, edges: set.edges, of: set.of };
}

/** The sweep parts of a seed as one run: their failures in run order, the ids of every run, the added stats. */
export function mergeParts(files: readonly PartFile[]): { failed: Failed[]; ran: Set<string>; stats: Stats } {
  return { failed: files.flatMap((f) => f.failed), ran: new Set(files.flatMap((f) => f.ran)), stats: addStats(files.map((f) => f.stats)) };
}
