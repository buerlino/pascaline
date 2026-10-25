// SPDX-License-Identifier: GPL-3.0-or-later
// G100 (F57, structure audit 1.3): whether an input stores, from Giac's tree (bridge-2, giac_parse) instead of five
// readings of its text. An input stores when its tree has a target that is not one of our helpers' (ourNames.ts), a head
// of the state family (STATE_HEADS), a head that evaluates a string (STRING_HEADS: what the string holds is not in the
// tree, so the input keeps the full read after it), or when it reads a stored program whose kept stores (`programStores`,
// read once when the program is defined, restored or imported), walked through the programs it reads, are not empty.
// An over-read is allowed (a weaker mark, one more state read), an under-read never.
// Pure functions over the parse; only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacParse } from "./bridge.ts";
import { FLAG_WORDS } from "./flags.ts";
import { isOurStore } from "./ourNames.ts";

/**
 * Heads that change the engine's state with no target in the tree, or whose target the tree may miss (giac 2.1.0,
 * read in the pinned tarball): purge and its aliases (DelVar, del, unassign; their names are targets too), assume,
 * additionally, assign (`assign(q,5)` stores q), restart, rm_all_vars, restart_vars, restart_modes, rm_a_z (G93: purges
 * the one-letter names, usual.cc:231), the file readers read, ramene and unarchive, the writers write and archive, and
 * every Giac setting (flags.ts; the check after the call puts them back, the input still runs once).
 */
export const STATE_HEADS: ReadonlySet<string> = new Set([
  "purge", "DelVar", "del", "assume", "additionally", "assign", "restart", "rm_all_vars", "restart_vars", "restart_modes", "rm_a_z",
  "reset", "read", "ramene", "unarchive", "write", "archive", ...FLAG_WORDS,
]);

/**
 * Heads that parse a string and evaluate (or return) what it holds (giac 2.1.0, every function that builds a gen from a
 * string: prog.cc _expr (expr, execute), _quest (quest, entry), _mupad2xcas, _python, _hash (make_symbol); misc.cc
 * _float (float), _build_complex (complex)). Probed: `expr("q:=5")`, `execute(…)` and `float(…)` store q; complex and
 * make_symbol return `q:=5` unevaluated, which a later evaluation of the result would run.
 */
export const STRING_HEADS: ReadonlySet<string> = new Set([
  "expr", "execute", "quest", "entry", "mupad2xcas", "python", "make_symbol", "float", "complex",
]);

/** The heads of the tree's store nodes (api.cc STORE_HEADS), written as calls. */
const STORE_CALLS = ["sto", "array_sto", "increment", "decrement", "multcrement", "divcrement"];

/** The tokens of Giac's lexer (input_lexer.ll, giac 2.1.0) that make a store node from text without a word: `:=`, `=>`,
 *  `=%`, `▶`, `►`, `→` (sto), `=<` (array_sto), `++`, `+=`, `--`, `-=`, `*=`, `/=` (the increments). */
const STORE_TOKENS = [":=", "=>", "=%", "▶", "►", "→", "=<", "=&lt;", "++", "+=", "--", "-=", "*=", "/="];

/** The words of Giac's lexer that make a store node or a loop that stores its variable (input_lexer.ll: _assign,
 *  augmente_de, diminue_de, est_multiplie_par, est_divise_par, unassign, PURGE; the loops for, pour, repeat, while). */
const STORE_WORDS: ReadonlySet<string> = new Set([
  ...STORE_CALLS, ...STATE_HEADS, ...STRING_HEADS, "_assign", "augmente_de", "diminue_de", "est_multiplie_par", "est_divise_par",
  "unassign", "PURGE", "for", "FOR", "For", "pour", "repeat", "repeter", "REPEAT", "while", "WHILE", "While", "tantque", "Loop",
]);

/** The words of a text (names, keywords), each once. */
export function wordsOf(text: string): string[] {
  return [...new Set(text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])];
}

/** Whether the tree of `text` can hold a store at all: a store node needs one of Giac's store tokens or words in the
 *  text, so a text with neither needs no parse (it costs a bridge call per Enter). Over-reads only. */
export function mayStore(text: string): boolean {
  return STORE_TOKENS.some((t) => text.includes(t)) || wordsOf(text).some((w) => STORE_WORDS.has(w));
}

/** What a stored program changes when it runs, read once from its tree. `writes`: the global names its body stores
 *  (its own name and its parameters and locals left out) and the state or string heads it calls, written `head(`;
 *  `calls`: the names it reads, through which the walk goes on (only those that are programs count). */
export interface ProgramStores {
  writes: string[];
  calls: string[];
}

/** The heads of a tree that store without a target, or evaluate a string (a library body or test with one is refused). */
export function stateHeads(tree: GiacParse): string[] {
  return tree.heads.filter((h) => STATE_HEADS.has(h) || STRING_HEADS.has(h));
}

/** The targets of what runs when the stored value runs: for one top-level store (`f(x):=…`, `f:=x->…`, `a:=…`) its
 *  value's own targets (the bridge walks the value alone, so a body that stores into its own name, `f(x):={f:=0;…}`,
 *  keeps f: an under-read never), else every target of the tree (a printed value `(x)->…`). */
export function valueTargets(tree: GiacParse): string[] {
  return tree.form ? tree.value : tree.targets;
}

/** A program's kept stores from the tree of its definition (`f(x):=…`, `f:=x->…`, or its printed value `(x)->…`). */
export function programStores(tree: GiacParse): ProgramStores {
  return {
    writes: [...valueTargets(tree).filter((t) => !isOurStore(t)), ...stateHeads(tree).map((h) => `${h}(`)],
    calls: tree.reads,
  };
}

/** The targets stores (one of the user's), or the tree has a state or string head. */
function storesIn(tree: GiacParse, targets: readonly string[]): boolean {
  return targets.some((t) => !isOurStore(t)) || stateHeads(tree).length > 0;
}

/** The tree stores by itself (a target of the user's, a state or string head). */
export function treeStores(tree: GiacParse): boolean {
  return storesIn(tree, tree.targets);
}


/** Walks `names` through the programs `kept` knows: true when one of them, or a program it reads, writes. A name being
 *  visited counts as not writing (recursion ends). */
export function writesThrough(names: readonly string[], kept: (name: string) => ProgramStores | null): boolean {
  const seen = new Set<string>();
  const visit = (list: readonly string[]): boolean =>
    list.some((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      const k = kept(n);
      return k !== null && (k.writes.length > 0 || visit(k.calls));
    });
  return visit(names);
}

/** How an input stores, for Home and CAS. `once`: it must not run twice (it stores, or calls a program that does);
 *  for a plain assignment, its right side stores. `assignment`: `name:=value` (a program written with an arrow too,
 *  G49f4), evaluated as the value, then stored. `defined`: what it defines, for the live Find items (docs/04 3.4).
 *  `noValue`: it stores no value (a function definition, a purge, an assumption). */
export interface InputForm {
  stores: boolean;
  once: boolean;
  assignment: { name: string; rhs: string } | null;
  defined?: { name: string; kind: "var" | "fn" };
  noValue: boolean;
}

/** Root heads of an input that stores no value: a purge or an assumption. */
const NO_VALUE_HEADS: ReadonlySet<string> = new Set(["purge", "DelVar", "del", "assume", "additionally"]);

/** An input that stores nothing. */
export const PLAIN_FORM: InputForm = { stores: false, once: false, assignment: null, noValue: false };

/** `name:=value` in `text` when the tree says the text is one store into that name (top), not a function definition by
 *  `f(x):=`: the value is the text after the `:=`. The tree decides; the text gives only the place to cut. */
export function assignmentIn(text: string, tree: GiacParse): { name: string; rhs: string } | null {
  if (tree.top.length !== 1 || tree.form !== "name") return null;
  const name = tree.top[0]!;
  const rhs = valueAfter(text, name);
  return rhs === null ? null : { name, rhs };
}

/** The text after `name:=` at the start of `text`, or null. The tree says the text is one store into `name`; only the
 *  place to cut its value is read from the text (the tree has no text positions), and it tells `name:=…` from
 *  `name(args):=…`, which Giac's tree holds alike (`f:=(x)->…`). */
function valueAfter(text: string, name: string): string | null {
  return new RegExp(`^\\s*${name}\\s*:=([\\s\\S]+)$`).exec(text)?.[1] ?? null;
}

/** `form` for `text`, the same input with values put in for names (a chip, a constant): its assignment's value is cut
 *  from `text`. */
export function formIn(form: InputForm, text: string): InputForm {
  if (!form.assignment) return form;
  const rhs = valueAfter(text, form.assignment.name);
  return rhs === null ? form : { ...form, assignment: { name: form.assignment.name, rhs } };
}

/** The form of `input` from its tree (null: a text that cannot store, never parsed) and from the walk through the
 *  stored programs its words name (`writes`). */
export function formOf(input: string, tree: GiacParse | null, writes: (names: readonly string[]) => boolean): InputForm {
  if (!tree) {
    const calls = writes(wordsOf(input));
    return calls ? { ...PLAIN_FORM, stores: true, once: true } : PLAIN_FORM;
  }
  const assignment = assignmentIn(input, tree);
  if (assignment) {
    // a program's body stores when it runs, not when it is defined
    const rhsStores = !tree.program && (storesIn(tree, tree.value) || writes(wordsOf(assignment.rhs)));
    return { stores: true, once: rhsStores, assignment, defined: { name: assignment.name, kind: "var" }, noValue: false };
  }
  const stores = treeStores(tree) || writes(wordsOf(input));
  const top = tree.top.length === 1 ? tree.top[0]! : undefined;
  // L[k]:=… changes an element of L: no definition for the Find items (as before G100)
  const defined = top === undefined || tree.form === "indexed" ? undefined : { name: top, kind: tree.program ? ("fn" as const) : ("var" as const) };
  const noValue = defined?.kind === "fn" || NO_VALUE_HEADS.has(tree.heads[0] ?? "");
  return { stores, once: stores, assignment: null, ...(defined ? { defined } : {}), noValue };
}
