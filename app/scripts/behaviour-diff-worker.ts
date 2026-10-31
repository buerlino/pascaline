// SPDX-License-Identifier: GPL-3.0-or-later
// One tree of behaviour-diff.ts (A53), in a worker thread: the parent kills it when a run gives no answer in time (some
// CAS inputs never reach Giac's own timeout check, so only a kill ends them, as the app's client does), then starts another.
// workerData: { dir: the tree's root, mjs: its engine's giac.mjs, casTimeoutS: the CAS view's hardTimeoutS }.
// Messages in: { op: "fresh" } (a fresh engine and host) or { op: "run", view, input, digits, angle }; out: { ok } or a Row.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mod = Record<string, any>;
type Angle = "rad" | "deg";
export interface Row {
  display: string;
  mark: string;
  warn: string;
  why: string;
}
export type Job = { op: "fresh" } | { op: "run"; view: "home" | "cas"; input: string; digits: number; angle: Angle };

const { dir, mjs, casTimeoutS } = workerData as { dir: string; mjs: string; casTimeoutS: number };
const src = resolve(dir, "app/src");
const imp = (f: string): Promise<Mod> => import(pathToFileURL(`${src}/${f}`).href) as Promise<Mod>;
const [hostM, home, fmt, types, node] = await Promise.all([imp("engine/host.ts"), imp("engine/homeEval.ts"), imp("engine/format.ts"), imp("engine/types.ts"), imp("engine/nodeGiac.ts")]);
const angles = existsSync(`${src}/input/angles.ts`) ? await imp("input/angles.ts") : null;

const markText = (f: unknown, digits: number): string => {
  try {
    // G76: a tree whose results carry `facts` gives markOf their precisionFacts; an older one, the result itself.
    const p = typeof home.precisionFacts === "function" ? home.precisionFacts(f) : f;
    const m = fmt.markOf(p, { format: "STD", digits }) as { mark: string; n?: number } | null;
    return m ? `${m.mark}${m.n ?? ""}` : "-";
  } catch {
    return "?";
  }
};
const json = (x: unknown): string => (x === undefined ? "" : JSON.stringify(x));
/** A result's warn and why, wherever its tree keeps them (G76: in `facts`; before, on the result). */
const factsOf = (r: Mod | undefined): Mod | undefined => (r === undefined ? undefined : (r["facts"] ?? r));

/** A fresh EngineHost on this tree's engine, built as its nodeGiac.ts builds one (G99: giac and bridge; the host without a
 *  bridge throws on every call, A53). */
async function freshHost(): Promise<Mod> {
  const L = await node.loadNodeGiac(mjs);
  if (typeof home.pasdegCommand === "function") L.giac.eval(home.pasdegCommand("rad"));
  return new hostM.EngineHost(L.giac, L.bridge);
}

function run(host: Mod, view: "home" | "cas", input: string, digits: number, angle: Angle): Row {
  try {
    const typed = angles?.rewriteAngles ? (angles.rewriteAngles(input) as string) : input;
    if (view === "home") {
      const s = { ...home.defaultHomeSettings, angle, digits, workDigits: Math.max(30, digits + 10) };
      const r = host.home(typed, s).result;
      return { display: r.ok ? r.display : `error: ${r.error ?? r.display}`, mark: markText(r, digits), warn: json(factsOf(r)?.["warn"]), why: json(factsOf(r)?.["why"]) };
    }
    const r = host.cas(typed, { ...types.defaultCasSettings, angle, digits, hardTimeoutS: casTimeoutS }).result;
    const f = factsOf(r);
    const n = factsOf(r.numeric);
    const mark = r.numeric ? markText(r.numeric, digits) : r.approximate ? (f?.["warn"] ? "⚠" : "≈") : "-";
    return { display: r.ok ? `${r.text}${r.full ? ` | ${r.full}` : ""}` : `error: ${r.error ?? r.text}`, mark, warn: json(f?.["warn"] ?? n?.["warn"]), why: json(f?.["why"] ?? n?.["why"]) };
  } catch (e) {
    return { display: `throws: ${(e as Error).message.split("\n")[0]}`, mark: "!", warn: "", why: "" };
  }
}

let host: Mod | null = null;
/** Why the last fresh host could not be built (its runs throw this). */
let failed = "no engine host";
parentPort!.on("message", (job: Job) => {
  void (async () => {
    if (job.op === "fresh") {
      try {
        host = await freshHost();
        parentPort!.postMessage({ ok: true });
      } catch (e) {
        host = null;
        failed = (e as Error).message.split("\n")[0] ?? "no engine host";
        parentPort!.postMessage({ ok: false, error: failed });
      }
      return;
    }
    const row: Row = host ? run(host, job.view, job.input, job.digits, job.angle) : { display: `throws: ${failed}`, mark: "!", warn: "", why: "" };
    parentPort!.postMessage(row);
  })();
});
