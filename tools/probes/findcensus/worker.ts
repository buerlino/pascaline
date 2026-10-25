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
import { confirmedDigits, markOf, ZERO_VALUE, type ComplexValue } from "../../../app/src/engine/format.ts";
import { numbersAt, rationalValue, shapeOfValue } from "../../../app/src/engine/numeric.ts";
import { casMark } from "../../../app/src/goldenRun.ts";
import { onNumbers } from "./classify.ts";
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
  /** CAS: an exact form on numbers (`21/10*exp(21/5)`), no mark drawn. An exact form claims every digit: `value` is its value read
   *  at EXACT_DIGITS, and `mark` is `=` when the reading at EXACT_DIGITS + 20 agrees on 50 digits or more; when Giac's routine gives
   *  fewer (Airy_Ai has no MPFR path), `≈` checks the setting's digits, or `⚠ n` the n it gives. Judged where there is an oracle,
   *  symbolic where there is none. */
  exact?: true;
  /** Names and settings left behind: `name x`, `setting 3: 0 -> 1`, `logged x` (a definitions-log entry). */
  left: string[];
  crash?: string;
}

const DIGITS_FIELD = 6; // cas_setup()[6] is Digits
/** The host's own names, defined when first needed (pasans, pcasans, paserf…): not the input's. One the input purges still counts. */
const OURS = /^p(as|cas)[A-Za-z0-9_]*$/;

/** The digits an exact CAS form is read at: more than the 50 the judge's `=` checks. */
const EXACT_DIGITS = 60;
/** The digits the judge's `=` checks (judge.ts: equal to 1e-50). */
const EQUAL_DIGITS = 50;

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

function snapshot(): { names: string[]; setup: string[] } {
  const v = giac.eval("VARS()").trim();
  return { names: v === "[]" ? [] : topLevel(v), setup: topLevel(giac.eval("cas_setup()")) };
}

/** A name as the census prints it: Giac's ilaplace leaves one with no text (or bytes that are no name) in VARS(). */
const shownName = (n: string): string => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : "(a name with no text)");

function leftBehind(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>, defs: readonly DefChange[]): string[] {
  const left: string[] = [];
  const rest = [...before.names];
  for (const n of after.names) {
    const k = rest.indexOf(n);
    if (k >= 0) rest.splice(k, 1);
    else if (!OURS.test(n)) left.push(`name ${shownName(n)}`);
  }
  for (const n of rest) if (!after.names.includes(n)) left.push(`purged ${shownName(n)}`);
  after.setup.forEach((v, k) => {
    if (k !== DIGITS_FIELD && v !== before.setup[k]) left.push(`setting ${k}: ${before.setup[k] ?? "?"} -> ${v}`);
  });
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
      ...(r.items ? { list: true as const } : {}),
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
    if (n.items) return { ...base, list: true, ...(m ? { mark: m.mark } : {}) };
    return { ...base, ...(n.value ? { value: n.value } : {}), ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}) };
  }
  if (m?.mark === "=") {
    const q = rationalValue(r.text, EXACT_DIGITS);
    return q ? { ...base, value: { re: q.v, im: ZERO_VALUE }, mark: "=" } : { ...base, mark: "=" };
  }
  if (m) return { ...base, mark: m.mark };
  const v = onNumbers(job.giac) ? exactValue(r.text) : null;
  if (!v) return base;
  const claim = v.n >= EQUAL_DIGITS ? { mark: "=" as const } : v.n >= defaultCasSettings.digits ? { mark: "≈" as const } : { mark: "⚠" as const, n: v.n };
  return { ...base, value: v.value, ...claim, exact: true };
}

/** The value of an exact CAS form on numbers, read through bridge-3 at EXACT_DIGITS and EXACT_DIGITS + 20, with the digits the two
 *  readings agree on (format.ts confirmedDigits; a double's no more than it prints), less one; null for one that is no scalar number or agrees on no digit. */
function exactValue(text: string): { value: ComplexValue; n: number } | null {
  try {
    const hi = EXACT_DIGITS + 20;
    const v = bridge.value(text, [EXACT_DIGITS, hi]);
    if (shapeOfValue(v)?.kind !== "scalar") return null;
    const a = numbersAt(v, EXACT_DIGITS, EXACT_DIGITS, 1)?.[0];
    const b = numbersAt(v, hi, hi, 1)?.[0];
    if (!a || !b) return null;
    let agree = Math.min(confirmedDigits(a.re, b.re, EXACT_DIGITS, EXACT_DIGITS), confirmedDigits(a.im, b.im, EXACT_DIGITS, EXACT_DIGITS), a.short ?? EXACT_DIGITS);
    // A part Giac computed in a C double (Airy_Ai, BesselJ: no MPFR path) prints the same digits at every precision: it confirms
    // no more than it prints.
    if (v.doubles?.[String(EXACT_DIGITS)]?.[0]) agree = Math.min(agree, ...[a.re, a.im].filter((p) => p.digits !== "").map((p) => p.digits.length));
    const n = agree - 1;
    return n >= 1 ? { value: { re: a.re, im: a.im }, n } : null;
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
