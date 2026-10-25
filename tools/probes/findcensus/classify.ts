// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census's classes, pure (no engine). One input in one view falls in one class:
//   checked    a number with its mark, and the oracle (mpmath) agrees with the mark (the sweep's judge, tools/probes/sweep/judge.ts);
//              in CAS an exact form on numbers is judged as `=` (its value read at 60 and 80 digits; fewer agreeing digits claim
//              fewer, worker.ts)
//   unchecked  a number with its mark, and no oracle for this function or these arguments; a list answer some item of which has no
//              oracle (and none fails it)
//   symbolic   a result that is no number: an expression, a true or false, Giac's plain answer (never a list answer with items)
//   refused    a message instead of a result (the parser's or the engine's)
//   raw        Giac's raw text: the call came back unevaluated, or Giac's internal words, objects or strings reached the screen
//   wrong      the oracle disagrees with the shown number and its mark, or a number is shown where there is no value; for a list
//              answer, any item (each judged with its own mark against the oracle's element)
//   defined    a command that stores, assumes or purges on purpose (INTENDED_STATE) left only what the definitions log holds: the
//              app shows it in Vars and replays it at every start, as the command says (not a finding)
//   state      the input left a name or a setting behind in the engine, or a definitions-log entry the app replays at every start, or
//              a program call no longer answers after it (Giac's debug mode)
//   hang       no answer before the deadline
//   crash      an exception came out of the engine (the worker is started again)
// The findings are raw, wrong, state, hang and crash.
import { judge, type Oracle, type Shown } from "../sweep/judge.ts";
import type { Answer, Item } from "./worker.ts";

/** oracle.py's answer for one input: the sweep's shape, or one per element for a list argument. */
export type CensusOracle = Oracle | { kind: "items"; items: readonly Oracle[] };

export type CensusClass = "checked" | "unchecked" | "symbolic" | "refused" | "raw" | "wrong" | "defined" | "state" | "hang" | "crash";

export const FINDINGS: ReadonlySet<CensusClass> = new Set(["raw", "wrong", "state", "hang", "crash"]);

/** One letter per class, for the known file's compact class strings. */
export const LETTER: Readonly<Record<CensusClass, string>> = {
  checked: "c", unchecked: "u", symbolic: "s", refused: "r", raw: "t", wrong: "w", defined: "d", state: "x", hang: "h", crash: "k",
};
export const CLASS_OF_LETTER: Readonly<Record<string, CensusClass>> = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [v, k as CensusClass]));

/** The commands whose purpose is to change the engine's state (find/functions.yaml `notes`, and the two that store): their input
 *  is `defined`, not `state`, when everything it left is in the definitions log. */
export const INTENDED_STATE: ReadonlySet<string> = new Set(["sto", "assign", "assume", "additionally", "purge"]);

/** Everything `left` names is in the definitions log: each `name x` has its `logged x`, each `purged x` its `logged purge …x…`, and
 *  nothing else (no setting, no failing program call, no name the log does not hold). */
export function loggedOnly(left: readonly string[]): boolean {
  const logged = left.filter((l) => l.startsWith("logged "));
  if (!logged.length) return false;
  const purged = logged.filter((l) => l.startsWith("logged purge ")).flatMap((l) => l.slice(13).split(","));
  return left.every((l) => {
    if (l.startsWith("logged ")) return true;
    if (l.startsWith("name ")) return logged.includes(`logged ${l.slice(5)}`);
    if (l.startsWith("purged ")) return purged.includes(l.slice(7));
    return false;
  });
}

export interface Verdict {
  cls: CensusClass;
  detail: string;
}

/**
 * Giac's internal words and objects that are not an answer: a graphic (pnt, gl_ options), an unevaluated limit word, a string (Giac
 * prints strings in quotes), Giac's "Done", a sequence of objects, a rootof, an `undef`, Giac's `?` and its `[exact, numeric]` pair
 * marker, our helper names (pas…, pcas…) and Giac's negative zero print.
 */
const RAW_WORDS: readonly [RegExp, string][] = [
  [/\bpnt\(|\bgl_[a-z]|\blegende\b|\bgraphe\b/, "a graphic object"],
  [/\bbounded_function\b/, "bounded_function"],
  [/\b(un)?directed (un)?weighted graph with\b/, "a graph object"],
  [/\brootof\(/, "rootof"],
  [/\bundef\b/, "undef"],
  [/"/, "a string"],
  [/^Done$/, "Done"],
  [/\bpas[a-z]+|\bpcas[a-z]*/, "a helper name"],
  [/0\.-0/, "a negative zero print"],
  [/\?/, "Giac's ?"],
  [/GIAC_ERROR|Error:|Bad Argument/i, "Giac's error text"],
];

/** The input names no free symbol: only numbers, lists, called functions and constants (an unevaluated call on it is no answer). */
export function onNumbers(giac: string): boolean {
  for (const m of giac.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (/^(pi|e_|i_|inf|pasdeg)$/.test(m[0])) continue;
    if (!/^\s*\(/.test(giac.slice(m.index + m[0].length))) return false;
  }
  return true;
}

/**
 * Giac's raw text in a shown result, or null: one of RAW_WORDS, or the called function still in it on numbers (unevaluated), where
 * Home owes a number; in CAS an unevaluated call on exact numbers is an exact form (`Si(1)`, as `sqrt(2)`), raw only with a float in it.
 */
export function rawText(name: string, text: string, view: "home" | "cas", giac: string): string | null {
  const t = text.trim();
  const called = new RegExp(`(^|[^A-Za-z0-9_])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\(`);
  if (called.test(t) && onNumbers(giac) && (view === "home" || /\d\.\d*/.test(t))) return `${name}( came back unevaluated`;
  for (const [re, what] of RAW_WORDS) if (re.test(t)) return what;
  return null;
}

/** The class of one input. `parserError` is set when our parser refused the LaTeX (the input never reached the engine). */
export function classify(name: string, view: "home" | "cas", giac: string, a: Answer | { hang: true } | { parserError: string }, oracle: CensusOracle | null): Verdict {
  if ("hang" in a) return { cls: "hang", detail: "no answer before the deadline" };
  if ("parserError" in a) return { cls: "refused", detail: `parser: ${a.parserError}`.slice(0, 100) };
  if (a.crash !== undefined) return { cls: "crash", detail: a.crash };
  if (a.left.length && INTENDED_STATE.has(name) && loggedOnly(a.left)) return { cls: "defined", detail: a.left.join("; ").slice(0, 160) };
  if (a.left.length) return { cls: "state", detail: a.left.join("; ").slice(0, 160) };
  if (!a.ok) return { cls: "refused", detail: `${a.error ?? "error"}: ${a.text}`.slice(0, 120) };
  const raw = rawText(name, a.text, view, giac);
  if (raw) return { cls: "raw", detail: `${raw}: ${a.text}`.slice(0, 120) };
  if (a.items) return classifyItems(a.items, a.text, oracle);
  // a scalar answer to a list argument: no element of the oracle is its value
  if (oracle?.kind === "items") oracle = { kind: "skip", reason: "a list argument, a scalar answer" };
  if (a.value && a.mark) {
    if (a.exact && (!oracle || oracle.kind === "skip")) return { cls: "symbolic", detail: a.text.slice(0, 100) };
    if (!oracle || oracle.kind === "skip") return { cls: "unchecked", detail: `${a.mark}${a.n ?? ""} ${a.text}${oracle ? ` (oracle: ${oracle.reason})` : ""}`.slice(0, 120) };
    const shown: Shown = { ok: true, display: a.text, value: a.value, mark: a.mark, ...(a.n !== undefined ? { n: a.n } : {}) };
    const v = judge(shown, oracle, 12);
    if (v.kind === "ok") return { cls: "checked", detail: `${a.mark}${a.n ?? ""} ${a.text}` };
    return { cls: "wrong", detail: `[${v.check ?? v.kind}] ${v.detail ?? ""}`.slice(0, 160) };
  }
  if (a.value || a.mark) return { cls: "unchecked", detail: `${a.mark ?? "no mark"} ${a.text}`.slice(0, 120) };
  return { cls: "symbolic", detail: a.text.slice(0, 100) };
}

/** A list answer, item by item: each item's value and own mark judged against the oracle's element (the sweep's judge). Wrong when
 *  any item fails (or the counts differ), checked when every item passes, unchecked when some item has no oracle; never symbolic. */
function classifyItems(items: readonly Item[], text: string, oracle: CensusOracle | null): Verdict {
  const marks = items.map((it) => `${it.mark ?? "-"}${it.n ?? ""}`).join(",");
  if (oracle?.kind !== "items") {
    const why = !oracle ? "" : oracle.kind === "skip" ? ` (oracle: ${oracle.reason})` : " (oracle: one value for a list)";
    return { cls: "unchecked", detail: `list [${marks}] ${text}${why}`.slice(0, 120) };
  }
  if (oracle.items.length !== items.length) return { cls: "wrong", detail: `[items] ${items.length} items shown, the oracle has ${oracle.items.length}: ${text}`.slice(0, 160) };
  let all = true;
  for (const [i, it] of items.entries()) {
    const o = oracle.items[i]!;
    if (o.kind === "skip") {
      all = false;
      continue;
    }
    const shown: Shown = { ok: true, display: it.text, ...(it.value ? { value: it.value } : {}), ...(it.mark ? { mark: it.mark } : {}), ...(it.n !== undefined ? { n: it.n } : {}) };
    const v = judge(shown, o, 12);
    if (v.kind === "skip") all = false;
    else if (v.kind !== "ok") return { cls: "wrong", detail: `[item ${i + 1} ${v.check ?? v.kind}] ${v.detail ?? ""}`.slice(0, 160) };
  }
  return all ? { cls: "checked", detail: `list [${marks}] ${text}`.slice(0, 120) } : { cls: "unchecked", detail: `list [${marks}] ${text} (oracle: an item without one)`.slice(0, 120) };
}
