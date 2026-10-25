// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census's host in a worker thread, as the app keeps one engine worker. A job is one input in Home or CAS; the answer is
// what the view shows (its text, its number and mark) and what the input left behind: the names and settings Giac holds after it
// (VARS() and cas_setup(), Digits left out: the host sets it before every call, G102) against before it, and the definitions the
// host logged (the app stores and replays them). An exception thrown out of the engine is answered as a crash; the main thread
// then starts a new worker, as it does after a missed deadline.
import { parentPort } from "node:worker_threads";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand, precisionFacts } from "../../../app/src/engine/homeEval.ts";
import { markOf, ZERO_VALUE, type ComplexValue } from "../../../app/src/engine/format.ts";
import { rationalValue } from "../../../app/src/engine/numeric.ts";
import { defaultCasSettings } from "../../../app/src/engine/types.ts";
import type { DefChange } from "../../../app/src/engine/defs.ts";

export interface Job {
  id: number;
  view: "home" | "cas";
  giac: string;
}

/** What one input did. `text` is what the view shows (Home's display, CAS's text, or the error text). */
export interface Answer {
  ok: boolean;
  text: string;
  error?: string;
  /** The shown number (a scalar), with the mark the view draws for it; absent for a non-number and a list. */
  value?: ComplexValue;
  mark?: "=" | "≈" | "⚠";
  n?: number;
  /** A list or matrix of numbers (Home items, or a CAS numeric list): shown with marks, not judged here. */
  list?: true;
  /** Names and settings left behind: `name x`, `setting 3: 0 -> 1`, `logged x` (a definitions-log entry). */
  left: string[];
  crash?: string;
}

const DIGITS_FIELD = 6; // cas_setup()[6] is Digits
/** The host's own names, defined when first needed (pasans, pcasans, paserf…): not the input's. One the input purges still counts. */
const OURS = /^p(as|cas)[A-Za-z0-9]*$/;

const RATIONAL = /^-?\d+(\/\d+)?$/;

function topLevel(text: string): string[] {
  const t = text.trim().replace(/^\[/, "").replace(/\]$/, "");
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of t) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const { giac, bridge } = await loadNodeGiac();
giac.eval(pasdegCommand("rad"));
const host = new EngineHost(giac, bridge);

function snapshot(): { names: Set<string>; setup: string[] } {
  return { names: new Set(topLevel(giac.eval("VARS()")).filter((n) => n !== "")), setup: topLevel(giac.eval("cas_setup()")) };
}

function leftBehind(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>, defs: readonly DefChange[]): string[] {
  const left: string[] = [];
  for (const n of after.names) if (!before.names.has(n) && !OURS.test(n)) left.push(`name ${n}`);
  for (const n of before.names) if (!after.names.has(n)) left.push(`purged ${n}`);
  after.setup.forEach((v, k) => {
    if (k !== DIGITS_FIELD && v !== before.setup[k]) left.push(`setting ${k}: ${before.setup[k] ?? "?"} -> ${v}`);
  });
  for (const d of defs) left.push("set" in d ? `logged ${d.set.name || d.set.cmds.join(";")}` : `logged purge ${d.purge.join(",")}`);
  return left;
}

function run(job: Job): Answer {
  const before = snapshot();
  if (job.view === "home") {
    const { result: r, defs } = host.home(job.giac, defaultHomeSettings);
    const m = r.ok && r.value && !r.items ? markOf(precisionFacts(r), { format: "STD", digits: defaultHomeSettings.digits }) : null;
    return {
      ok: r.ok,
      text: r.display,
      ...(r.error ? { error: r.error } : {}),
      ...(r.value && !r.items ? { value: r.value } : {}),
      ...(r.items ? { list: true as const } : {}),
      ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}),
      left: leftBehind(before, snapshot(), defs),
    };
  }
  const { result: r, defs } = host.cas(job.giac, defaultCasSettings);
  const left = leftBehind(before, snapshot(), defs);
  const base = { ok: r.ok, text: r.text, ...(r.error ? { error: r.error } : {}), left };
  if (!r.ok) return base;
  // As the golden runner reads a CAS mark (goldenRun.ts runPrecisionCase): a float result's facts, a true or false resting on a
  // float, an exact rational (=); any other exact result has no mark.
  if (r.numeric) {
    const n = r.numeric;
    const m = markOf(precisionFacts(n), { format: "STD", digits: defaultCasSettings.digits });
    if (n.items) return { ...base, list: true, ...(m ? { mark: m.mark } : {}) };
    return { ...base, ...(n.value ? { value: n.value } : {}), ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}) };
  }
  if (r.approximate) return { ...base, mark: r.facts.warn ? "⚠" : "≈" };
  if (RATIONAL.test(r.text.trim())) {
    const q = rationalValue(r.text, 60);
    if (q) return { ...base, value: { re: q.v, im: ZERO_VALUE }, mark: "=" };
  }
  return base;
}

parentPort!.postMessage({ ready: true });
parentPort!.on("message", (job: Job) => {
  let a: Answer;
  try {
    a = run(job);
  } catch (e) {
    a = { ok: false, text: "", left: [], crash: String((e as Error).message ?? e).slice(0, 120) };
  }
  parentPort!.postMessage({ id: job.id, answer: a });
});
