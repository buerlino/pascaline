// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census's classes, pure (no engine). One input in one view falls in one class:
//   checked    a number with its mark, and the oracle (mpmath) agrees with the mark (the sweep's judge, tools/probes/sweep/judge.ts)
//   unchecked  a number (or a list of numbers) with its mark, and no oracle for this function or these arguments
//   symbolic   a result that is no number: an expression, a list, a true or false, Giac's plain answer
//   refused    a message instead of a result (the parser's or the engine's)
//   raw        Giac's raw text: the call came back unevaluated, or Giac's internal words, objects or strings reached the screen
//   wrong      the oracle disagrees with the shown number and its mark, or a number is shown where there is no value
//   state      the input left a name or a setting behind in the engine, or a definitions-log entry the app replays at every start
//   hang       no answer before the deadline
//   crash      an exception came out of the engine (the worker is started again)
// The findings are raw, wrong, state, hang and crash.
import { judge, type Oracle, type Shown } from "../sweep/judge.ts";
import type { Answer } from "./worker.ts";

export type CensusClass = "checked" | "unchecked" | "symbolic" | "refused" | "raw" | "wrong" | "state" | "hang" | "crash";

export const FINDINGS: ReadonlySet<CensusClass> = new Set(["raw", "wrong", "state", "hang", "crash"]);

/** One letter per class, for the known file's compact class strings. */
export const LETTER: Readonly<Record<CensusClass, string>> = {
  checked: "c", unchecked: "u", symbolic: "s", refused: "r", raw: "t", wrong: "w", state: "x", hang: "h", crash: "k",
};
export const CLASS_OF_LETTER: Readonly<Record<string, CensusClass>> = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [v, k as CensusClass]));

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
export function classify(name: string, view: "home" | "cas", giac: string, a: Answer | { hang: true } | { parserError: string }, oracle: Oracle | null): Verdict {
  if ("hang" in a) return { cls: "hang", detail: "no answer before the deadline" };
  if ("parserError" in a) return { cls: "refused", detail: `parser: ${a.parserError}`.slice(0, 100) };
  if (a.crash !== undefined) return { cls: "crash", detail: a.crash };
  if (a.left.length) return { cls: "state", detail: a.left.join("; ").slice(0, 160) };
  if (!a.ok) return { cls: "refused", detail: `${a.error ?? "error"}: ${a.text}`.slice(0, 120) };
  const raw = rawText(name, a.text, view, giac);
  if (raw) return { cls: "raw", detail: `${raw}: ${a.text}`.slice(0, 120) };
  if (a.value && a.mark) {
    if (!oracle || oracle.kind === "skip") return { cls: "unchecked", detail: `${a.mark}${a.n ?? ""} ${a.text}${oracle ? ` (oracle: ${oracle.reason})` : ""}`.slice(0, 120) };
    const shown: Shown = { ok: true, display: a.text, value: a.value, mark: a.mark, ...(a.n !== undefined ? { n: a.n } : {}) };
    const v = judge(shown, oracle, 12);
    if (v.kind === "ok") return { cls: "checked", detail: `${a.mark}${a.n ?? ""} ${a.text}` };
    return { cls: "wrong", detail: `[${v.check ?? v.kind}] ${v.detail ?? ""}`.slice(0, 160) };
  }
  if (a.list && a.mark) return { cls: "unchecked", detail: `list ${a.mark} ${a.text}`.slice(0, 120) };
  if (a.value || a.mark) return { cls: "unchecked", detail: `${a.mark ?? "no mark"} ${a.text}`.slice(0, 120) };
  return { cls: "symbolic", detail: a.text.slice(0, 100) };
}
