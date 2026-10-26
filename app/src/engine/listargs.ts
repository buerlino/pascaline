// SPDX-License-Identifier: GPL-3.0-or-later
// G111 (backlog F98, principle 3): some of Giac's functions read one list argument as their argument list, because a call
// f(a,b) reaches them as the same vector [a,b] (only its subtype differs, and they do not look at it): LambertW([1,2]) is
// LambertW(1,2), the branch-2 value of W(1), one complex number where a list of two values was meant; hermite([1,2]) is
// H₁(2) = 4. That is Giac's meaning (usual.cc _LambertW, permu.cc _hermite …), so the refusal is ours, as G97 did for F69:
// a call of one of LIST_AS_ARGUMENTS whose one argument is a list, typed (`[…]`, Giac's `list[…]`) or held by what the
// argument evaluates to (a stored list, Ans). Two arguments typed as two keep Giac's answer.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { type Giac } from "./numeric.ts";
import { callsOf, closing, functionsIn, namesIn, splitList, topLevelArgs } from "./giacPrint.ts";
import { changesState } from "./novalue.ts";

/** The functions the G110 census's unchecked class shows reading a one-list argument as their arguments (probed on the
 *  pinned giac_2.1.0-1, 2026-10-26: f([1,2]) = f(1,2)). Each of them answers a list with one value. */
export const LIST_AS_ARGUMENTS: readonly string[] = [
  "LambertW", "hermite", "legendre", "tchebyshev1", "tchebyshev2", "cyclotomic", "range", "randvector",
];
const LIST_AS = new Set(LIST_AS_ARGUMENTS);

/** Cheap text test: `input` calls one of LIST_AS_ARGUMENTS. */
export function mayListAsArguments(input: string): boolean {
  return callsOf(input, LIST_AS, "typed").length > 0;
}

/** The argument text is one typed list, `[…]` or `list[…]`, as a whole (not `[1,2][0]`). */
function typedList(a: string): boolean {
  const open = a.startsWith("[") ? 0 : a.startsWith("list[") ? 4 : -1;
  return open >= 0 && closing(a, open, "typed") === a.length - 1;
}

/**
 * `input` (decimals exact) calls one of LIST_AS_ARGUMENTS with one argument that is a list. A typed list needs no engine
 * call; an argument that reads a name or holds a bracket is evaluated once more for its type, in one engine call for all
 * of them, unless it changes state (changesState) or calls a function `userFn` names (a program may change globals).
 */
export function listAsArguments(giac: Giac, input: string, userFn: (name: string) => boolean): boolean {
  const calls = callsOf(input, LIST_AS, "typed");
  if (!calls.length) return false;
  const ask: string[] = [];
  for (const c of calls) {
    if (c.close < 0) continue;
    const args = topLevelArgs(input.slice(c.open + 1, c.close), "typed");
    if (args.length !== 1) continue;
    const a = args[0]!.trim();
    if (typedList(a)) return true;
    if (!a.includes("[") && !namesIn(a, "typed").length) continue;
    if (changesState(a, "typed") || functionsIn(a, "typed").some(userFn)) continue;
    ask.push(`when(type(${a})==DOM_LIST,1,0)`);
  }
  if (!ask.length) return false;
  return (splitList(giac.eval(`[${ask.join(",")}]`).trim()) ?? []).some((t) => t.trim() === "1");
}
