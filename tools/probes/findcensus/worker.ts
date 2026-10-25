// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census's host in a worker thread, as the app keeps one engine worker. A job is one input in Home or CAS; the answer is
// what the view shows (its text, its number and mark) and what the input left behind: the names and settings Giac holds after it
// (VARS() through bridge-3 and the context through bridge-1, Digits left out: the host sets it before every call, G102) against before it, and the definitions the
// host logged (the app stores and replays them). An exception thrown out of the engine is answered as a crash; the main thread
// then starts a new worker, as it does after a missed deadline.
import { parentPort } from "node:worker_threads";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand, precisionFacts, type HomeResult } from "../../../app/src/engine/homeEval.ts";
import { markOf, ZERO_VALUE, type ComplexValue } from "../../../app/src/engine/format.ts";
import { rationalValue } from "../../../app/src/engine/numeric.ts";
import { EXACT_DIGITS, EXACT_HI, exactReading } from "./exact.ts";
import { casMark } from "../../../app/src/goldenRun.ts";
import { onNumbers } from "./classify.ts";
import { defaultCasSettings } from "../../../app/src/engine/types.ts";
import type { DefChange } from "../../../app/src/engine/defs.ts";
import type { GiacContext } from "../../../app/src/engine/bridge.ts";
import { contextDiff } from "../../../app/src/engine/flags.ts";

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
  /** A list or matrix of numbers (Home items, or a CAS numeric list), item by item: each item's text, value and the mark the view
   *  draws for it from the item's own precision facts (markOf, STD, the setting's digits), or, for a CAS exact list on numbers, each
   *  element's own exact claim (exact.ts). Judged item by item (classify.ts). */
  items?: Item[];
  /** CAS: an exact form on numbers (`21/10*exp(21/5)`), no mark drawn. An exact form claims every digit: `value` is its value read
   *  at EXACT_DIGITS, and `mark` is `=` when the reading at EXACT_DIGITS + 20 agrees on 50 digits or more; when Giac's routine gives
   *  fewer (Airy_Ai has no MPFR path), `≈` checks the setting's digits, or `⚠ n` the n it gives. Judged where there is an oracle,
   *  symbolic where there is none. */
  exact?: true;
  /** Names and settings left behind: `name x`, `setting 3: 0 -> 1`, `logged x` (a definitions-log entry). */
  left: string[];
  crash?: string;
}

/** One item of a list answer: its shown text, its number and its own mark (absent for an item that is no number). */
export interface Item {
  text: string;
  value?: ComplexValue;
  mark?: "=" | "≈" | "⚠";
  n?: number;
  /** CAS: the item is an element of an exact form, its claim read as for a scalar exact form (exact.ts). */
  exact?: true;
}

/** A list answer's items, each with the mark markOf gives its own precision facts (STD, `digits`), as for a scalar answer. */
export function itemsOf(items: readonly HomeResult[], digits: number): Item[] {
  return items.map((it) => {
    const m = it.value ? markOf(precisionFacts(it), { format: "STD", digits }) : null;
    return { text: it.display, ...(it.value ? { value: it.value } : {}), ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}) };
  });
}

/** The host's own names, defined when first needed (pasans, pcasans, paserf…): not the input's. One the input purges still counts. */
const OURS = /^p(as|cas)[A-Za-z0-9_]*$/;

const { giac, bridge } = await loadNodeGiac();
giac.eval(pasdegCommand("rad"));
const host = new EngineHost(giac, bridge);
// The host sets its own context on its first call (flags.ts hostContext): made here, so the first input's snapshot starts from it.
host.home("1", defaultHomeSettings);
// A program of ours, called after every input: Giac's debug() leaves no name and no setting, but the next program call goes into the
// step-by-step debugger, which asks the page for input (`prompt is not defined`): the host's own helpers are programs too.
giac.eval("pascensus(x):={return x+1;}");

/** Null when a program call still answers, else what it did. */
function programCall(): string | null {
  try {
    const t = giac.eval("pascensus(1)").trim();
    return t === "2" ? null : `a program call answers ${t.slice(0, 40)}`;
  } catch (e) {
    return `a program call throws ${String((e as Error).message ?? e).slice(0, 40)}`;
  }
}

/** What the engine holds: the stored names (VARS() through bridge-3, its elements) and the settings (bridge-1, giac_ctx_get). */
function snapshot(): { names: string[]; ctx: GiacContext } {
  return { names: [...(bridge.value("VARS()", []).elements ?? [])], ctx: bridge.ctxGet() };
}

/** A name as the census prints it: Giac's ilaplace leaves one with no text in VARS(). */
const shownName = (n: string): string => (n.trim() === "" ? "(a name with no text)" : n);

function leftBehind(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>, defs: readonly DefChange[]): string[] {
  const left: string[] = [];
  const rest = [...before.names];
  for (const n of after.names) {
    const k = rest.indexOf(n);
    if (k >= 0) rest.splice(k, 1);
    else if (!OURS.test(n)) left.push(`name ${shownName(n)}`);
  }
  for (const n of rest) if (!after.names.includes(n)) left.push(`purged ${shownName(n)}`);
  // Every field bridge-1 reads but Digits (the host sets it before every call, G102); floats compared as the host does (flags.ts)
  for (const k of contextDiff(after.ctx, before.ctx)) if (k !== "decimal_digits") left.push(`setting ${k}: ${String(before.ctx[k])} -> ${String(after.ctx[k])}`);
  for (const d of defs) left.push("set" in d ? `logged ${d.set.name || d.set.cmds.join(";")}` : `logged purge ${d.purge.join(",")}`);
  return left;
}

/** Bridge-3's kind (`giac_value`, G103) of Giac's answer to the input's Giac text; "error" when it threw. Not judged: the census
 *  counts it per class. */
function kindOf(giacText: string): string {
  try {
    return bridge.value(giacText, []).kind;
  } catch {
    return "error";
  }
}

function view(job: Job): Omit<Answer, "left"> & { defs: DefChange[] } {
  if (job.view === "home") {
    const { result: r, defs } = host.home(job.giac, defaultHomeSettings);
    const m = r.ok && r.value && !r.items ? markOf(precisionFacts(r), { format: "STD", digits: defaultHomeSettings.digits }) : null;
    return {
      ok: r.ok,
      text: r.display,
      ...(r.error ? { error: r.error } : {}),
      ...(r.value && !r.items ? { value: r.value } : {}),
      ...(r.items ? { items: itemsOf(r.items, defaultHomeSettings.digits) } : {}),
      ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}),
      defs,
    };
  }
  const { result: r, defs } = host.cas(job.giac, defaultCasSettings);
  const base = { ok: r.ok, text: r.text, ...(r.error ? { error: r.error } : {}), defs };
  if (!r.ok) return base;
  // The golden runner's CAS mark (goldenRun.ts casMark): a float result's facts, a true or false resting on a float, an exact rational
  // (=); any other exact result has no mark.
  const m = casMark(r, defaultCasSettings.digits);
  if (r.numeric) {
    const n = r.numeric;
    if (n.items) return { ...base, items: itemsOf(n.items, defaultCasSettings.digits) };
    return { ...base, ...(n.value ? { value: n.value } : {}), ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}) };
  }
  if (m?.mark === "=") {
    const q = rationalValue(r.text, EXACT_DIGITS);
    return q ? { ...base, value: { re: q.v, im: ZERO_VALUE }, mark: "=" } : { ...base, mark: "=" };
  }
  if (m) return { ...base, mark: m.mark };
  const v = onNumbers(job.giac) ? exactOf(r.text) : null;
  if (!v) return base;
  if ("items" in v) return { ...base, items: v.items };
  return { ...base, ...v.scalar };
}

/** An exact CAS form on numbers read through bridge-3 (exact.ts): a scalar's claim, or a list's items each with its own; null when
 *  it is neither or Giac throws. */
function exactOf(text: string): ReturnType<typeof exactReading> {
  try {
    return exactReading(bridge.value(text, [EXACT_DIGITS, EXACT_HI]), defaultCasSettings.digits);
  } catch {
    return null;
  }
}

parentPort!.postMessage({ ready: true });
// Two messages per job: the view's answer (what it showed and left behind), then bridge-3's kind of the same text, evaluated a second
// time after it. The main thread gives the second its own deadline, so reading the kind never changes a class; `dirty` says the
// second evaluation changed the engine (the main thread then starts a new one).
parentPort!.on("message", (job: Job) => {
  let a: Answer;
  let mid: ReturnType<typeof snapshot> | null = null;
  try {
    const before = snapshot();
    const v = view(job);
    mid = snapshot();
    const { defs, ...shown } = v;
    const call = programCall();
    a = { ...shown, left: [...leftBehind(before, mid, defs), ...(call ? [call] : [])] };
  } catch (e) {
    a = { ok: false, text: "", left: [], crash: String((e as Error).message ?? e).slice(0, 120) };
  }
  parentPort!.postMessage({ id: job.id, answer: a });
  if (a.crash !== undefined || a.left.length || !mid) return;
  let kind: string;
  let dirty: boolean;
  try {
    kind = kindOf(job.giac);
    dirty = leftBehind(mid, snapshot(), []).length > 0;
  } catch (e) {
    kind = "error";
    dirty = true;
  }
  parentPort!.postMessage({ id: job.id, kind, dirty });
});
