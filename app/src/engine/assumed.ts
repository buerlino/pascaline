// SPDX-License-Identifier: GPL-3.0-or-later
// G92 (F64): an assumption Giac leaves is put back. Giac's `simplify` sets assume(x>0) for a fractional power and puts it
// back after its work; when that work throws, `_simplify` catches it and the assumption stays (pinned tarball,
// subst.cc:2419, 2425–2428, 2802). `fourier_an` and its kin leave assume(n,integer) on purpose. Either changes every
// later result on that name (solve(x^2=4,x) gave [2]). The host reads the user names and the logged assumptions in the
// call after an input (host.ts after: folded into the state part when it is read, its own call only after an input whose
// Giac texts named a word below), and puts back silently what the input left: a new name that holds only itself is
// purged, a logged assumption whose about() changed is purged and set again from its entry. As flags.ts does for Giac's
// settings; nothing is logged. Plain data and pure functions; only erasable TypeScript syntax, so Node runs this file.

/** Giac's commands that leave an assumption after they return (probe 2026-10-25: 60 commands, each in a fresh engine, on
 *  integrate(tanh(sqrt(x)),x), tanh(sqrt(x)) and sqrt(x)*exp(sqrt(x))+x^(1/3); VARS() after each). The simplify family,
 *  solve and zeros on the first leave assume(x>0); laplace and ilaplace leave x assumed too (and names that are not
 *  names, F-finding in G92's report); fourier_an and fourier_bn leave assume(n,integer), fourier_cn does not.
 *  tests/engine/assume-canary.ts checks that simplify and fourier_an still do. */
export const ASSUMING_WORDS: readonly string[] = [
  "simplify", "simplifier", "trigsimplify", "solve", "csolve", "zeros", "cZeros", "laplace", "ilaplace", "fourier_an", "fourier_bn",
];

const ASSUMING_RE = new RegExp(`(?<![A-Za-z0-9_])(?:${ASSUMING_WORDS.join("|")})(?![A-Za-z0-9_])`);
const SETS_RE = /(?<![A-Za-z0-9_])(?:assume|additionally)(?![A-Za-z0-9_])/;
const noStrings = (s: string): string => s.replace(/"[^"]*"/g, '""');

/** The text names a command that may leave an assumption (outside strings). */
export function namesAssuming(text: string): boolean {
  return ASSUMING_RE.test(noStrings(text));
}

/** The text sets an assumption itself (`assume`, `additionally`, outside strings): its change is kept (G67's reset rule). */
export function setsAssumption(text: string): boolean {
  return SETS_RE.test(noStrings(text));
}

/** The names the text assumes (`assume(x>0)`, `additionally(x<3)`, `assume([a,b],integer)`'s first), outside strings. */
export function assumeTargets(text: string): string[] {
  return [...noStrings(text).matchAll(/(?<![A-Za-z0-9_])(?:assume|additionally)\s*\(\s*\[?\s*([A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
}

/** The about() of each name, as the 3rd of a state part's 4 elements (stateRead.ts statePart, changedPart). */
export function aboutsPart(names: readonly string[]): string {
  return `[${names.map((n) => `about(${n})`).join(",")}]`;
}

/** The read after an input that may have left an assumption but stores nothing: the shape of a state part (VARS() as
 *  its 2nd element, a name of `known` bare, any other with its text), the about() of `logged` as its 3rd. One call. */
export function leakPart(known: readonly string[], logged: readonly string[]): string {
  const quoted = `[${known.map((n) => `'${n}'`).join(",")}]`;
  return `[0,map(VARS(),k->when(member(k,${quoted}),k,[k,string(eval(k))])),${aboutsPart(logged)},0]`;
}

/** A node of Giac's printed list (stateRead.ts parsePrinted). */
interface Node {
  raw: string;
  items?: Node[];
  str?: string;
}

/** The names a state part's print lists with an entry whose text is the name itself (an assumed or a bare name). */
export function selfHolding(n: Node): string[] {
  return (n.items?.[1]?.items ?? []).flatMap((e) => {
    const k = e.items?.[0]?.raw;
    return k !== undefined && e.items?.[1]?.str === k ? [k] : [];
  });
}

/** The about() texts of a state part's 3rd element (of 4), in the order asked; null when it has none. */
export function aboutsOf(n: Node, count: number): string[] | null {
  const list = n.items?.length === 4 ? n.items[2]?.items : undefined;
  return list && list.length === count ? list.map((x) => x.raw) : null;
}

/** The commands that put back what an input left: `purge(n)` for each leaked name, and a purge and the entry's own
 *  commands for each logged assumption that changed. One call (joined with `;`). */
export function putBack(leaked: readonly string[], changed: readonly { name: string; cmds: readonly string[] }[]): string {
  return [...leaked.map((n) => `purge(${n})`), ...changed.flatMap((e) => [`purge(${e.name})`, ...e.cmds])].join(";");
}
