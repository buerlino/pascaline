// SPDX-License-Identifier: GPL-3.0-or-later
// G111 (backlog F98, principle 3): some of Giac's functions read one list argument as their argument list, because a call
// f(a,b) reaches them as the same vector [a,b] (only its subtype differs, and they do not look at it): LambertW([1,2]) is
// LambertW(1,2), the branch-2 value of W(1), one complex number where a list of two values was meant; hermite([1,2]) is
// H₁(2) = 4. That is Giac's meaning (usual.cc _LambertW, permu.cc _hermite …), so the refusal is ours, as G97 did for F69:
// a call of one of LIST_AS_ARGUMENTS whose one argument is a list, typed (`[…]`, Giac's `list[…]`) or held by what the
// argument evaluates to (a stored list, Ans). Two arguments typed as two keep Giac's answer. R80f1: Giac's densities, cdfs
// and inverse cdfs do the same (normald_cdf([0.5,1.5]) = normald_cdf(0.5,1.5), P(0.5 ≤ X ≤ 1.5)); a list as their x after
// the parameters is one value per element since G111's patch 0007, except negbinomial_icdf; it and mlr_beta, mlr_predict
// answer a list among their arguments wrongly (LIST_IN_ARGUMENTS).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { type Giac } from "./numeric.ts";
import { callsOf, closing, functionsIn, namesIn, splitList, topLevelArgs } from "./giacPrint.ts";
import { changesState } from "./novalue.ts";

/** The functions the G110 census's unchecked class shows reading a one-list argument as their arguments (probed on the
 *  pinned giac_2.1.0-1, 2026-10-26: f([1,2]) = f(1,2)). Each of them answers a list with one value. */
export const LIST_AS_ARGUMENTS: readonly string[] = [
  "LambertW", "hermite", "legendre", "tchebyshev1", "tchebyshev2", "cyclotomic", "range", "randvector",
  // R80f1, probed on the shared engine with patch 0007 (2026-10-26): f(list[0.3,0.6]) = f(0.3,0.6), or f(list[2,0.3,0.6]) =
  // f(2,0.3,0.6), one number; kolmogorovd, logistic and randgeometric map the list per element and are not here
  "normald", "normald_cdf", "normald_icdf", "binomial", "binomial_cdf", "binomial_icdf", "poisson", "poisson_cdf",
  "poisson_icdf", "student", "student_cdf", "student_icdf", "chisquare", "chisquare_cdf", "chisquare_icdf", "fisher",
  "fisher_cdf", "fisher_icdf", "snedecor", "snedecor_cdf", "snedecor_icdf", "exponential", "exponential_cdf",
  "exponential_icdf", "uniform", "uniform_cdf", "uniform_icdf", "geometric", "geometric_cdf", "geometric_icdf", "cauchy",
  "cauchy_cdf", "cauchy_icdf", "weibull", "weibull_cdf", "weibull_icdf", "gammad", "gammad_cdf", "gammad_icdf", "betad",
  "betad_cdf", "betad_icdf", "negbinomial", "negbinomial_cdf", "negbinomial_icdf", "UTPC", "UTPF", "UTPT", "igamma", "ugamma",
];
const LIST_AS = new Set(LIST_AS_ARGUMENTS);

/** R80f1: functions that answer a list among their arguments wrongly (probed on the shared engine with patch 0007,
 *  2026-10-26), refused when one argument is a list: "any" for a `[ ]` vector or Giac's list type in any argument, a number
 *  k for the list type only (subtype 23, typed braces since R80) as argument k (from 0; a list-type X is answered right). negbinomial_icdf(3,0.5,[0.2,0.7]) = 0 for both (right {1,4}), the one
 *  distribution patch 0007 left; mlr_beta(X,list[2.1,…]) is a 2×5 matrix and mlr_predict(X,list[0.05,1.99]) a matrix,
 *  where the vector gives the betas [0.05,1.99] and the five predictions (mlr and its other forms give an error). */
export const LIST_IN_ARGUMENTS: Readonly<Record<string, "any" | number>> = {
  negbinomial_icdf: "any", mlr_beta: 1, mlr_predict: 1,
};
const EITHER = new Set([...LIST_AS, ...Object.keys(LIST_IN_ARGUMENTS)]);

/** Which refusal a call earns: one list as its only argument, or (LIST_IN_ARGUMENTS) a list among its arguments. */
export type ListRefusal = "listAsArguments" | "listInArgument";

/** Cheap text test: `input` calls one of LIST_AS_ARGUMENTS. */
export function mayListAsArguments(input: string): boolean {
  return callsOf(input, EITHER, "typed").length > 0;
}

/** The argument text is one typed list, `[…]` or `list[…]` (only the latter when `listType`), as a whole (not `[1,2][0]`). */
function typedList(a: string, listType = false): boolean {
  const open = a.startsWith("[") && !listType ? 0 : a.startsWith("list[") ? 4 : -1;
  return open >= 0 && closing(a, open, "typed") === a.length - 1;
}

/**
 * `input` (decimals exact) calls one of LIST_AS_ARGUMENTS with one argument that is a list ("listAsArguments"), or one of
 * LIST_IN_ARGUMENTS with a list among its arguments ("listInArgument"); else null. A typed list needs no engine call; an
 * argument that reads a name or holds a bracket is evaluated once more for its type, in one engine call for all of them,
 * unless it changes state (changesState) or calls a function `userFn` names (a program may change globals). `table`
 * stands in for LIST_IN_ARGUMENTS (tests: an entry for argument 0).
 */
export function listAsArguments(
  giac: Giac,
  input: string,
  userFn: (name: string) => boolean,
  table: Readonly<Record<string, "any" | number>> = LIST_IN_ARGUMENTS,
): ListRefusal | null {
  const calls = callsOf(input, table === LIST_IN_ARGUMENTS ? EITHER : new Set([...LIST_AS, ...Object.keys(table)]), "typed");
  if (!calls.length) return null;
  const ask: { text: string; why: ListRefusal }[] = [];
  for (const c of calls) {
    if (c.close < 0) continue;
    const args = topLevelArgs(input.slice(c.open + 1, c.close), "typed");
    const mode = Object.hasOwn(table, c.name) ? table[c.name] : undefined;
    const why: ListRefusal = mode !== undefined ? "listInArgument" : "listAsArguments";
    if (mode === undefined && args.length !== 1) continue;
    const listType = typeof mode === "number";
    for (const [k, raw] of args.entries()) {
      if (listType && k !== mode) continue;
      const a = raw.trim();
      if (typedList(a, listType)) return why;
      if (!a.includes("[") && !namesIn(a, "typed").length) continue;
      if (changesState(a, "typed") || functionsIn(a, "typed").some(userFn)) continue;
      ask.push({ text: listType ? `when(subtype(${a})==23,1,0)` : `when(type(${a})==DOM_LIST,1,0)`, why });
    }
  }
  if (!ask.length) return null;
  const types = splitList(giac.eval(`[${ask.map((q) => q.text).join(",")}]`).trim()) ?? [];
  const hit = types.findIndex((t) => t.trim() === "1");
  return hit < 0 ? null : ask[hit]!.why;
}
