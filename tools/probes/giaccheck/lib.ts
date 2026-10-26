// SPDX-License-Identifier: GPL-3.0-or-later
// A19: the pure part of the runner of Giac's own `check/` suite (tools/probes/giac-check.mjs). Only erasable TypeScript syntax.
// check/test<name> holds the inputs, check/<name>.out the answers Giac 2.1.0 gave them (one per input, each ending in ",").

/** The inputs of a test file: `\` + newline joins lines first, then the text splits on `;` + newline (and a final `;`). */
export function splitInputs(text: string): string[] {
  const joined = text.replace(/\\\r?\n/g, "");
  return joined
    .split(/;[ \t]*\r?\n/)
    .map((s) => s.trim().replace(/;$/, "").trim().replace(/:$/, "").trim())
    .filter((s) => s !== "");
}

/** The answers of an .out file: one per line, each closed by a comma (the last one may lack it). */
export function splitOutputs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.replace(/,$/, ""));
}

/** An assignment at top level (`a := …`, `a:=…`): the expected answer is "Done" (the .out writes it quoted). */
export function isAssignment(input: string): boolean {
  return /^[A-Za-z_][\w]*(\([^)]*\))?\s*:=/.test(input);
}

/** The number of statements in one input: `;` outside brackets and strings separates them (`b:=G(a); factor(x,b)` answers twice). */
export function statementCount(input: string): number {
  let depth = 0;
  let str = false;
  let n = 1;
  const t = input.trim().replace(/;$/, "");
  for (const c of t) {
    if (c === '"') str = !str;
    else if (!str && "([{".includes(c)) depth++;
    else if (!str && ")]}".includes(c)) depth--;
    else if (!str && depth === 0 && c === ";") n++;
  }
  return n;
}

const NUM = /-?\d+\.\d*(?:e[+-]?\d+)?|-?\.\d+(?:e[+-]?\d+)?/gi;
/** Two texts that are the same but for the last digits of their decimals (relative 1e-9): a regression's rounding. */
export function sameWithinRounding(a: string, b: string): boolean {
  if (a.replace(NUM, "#") !== b.replace(NUM, "#")) return false;
  const x = a.match(NUM) ?? [];
  const y = b.match(NUM) ?? [];
  return x.length === y.length && x.every((v, i) => Math.abs(Number(v) - Number(y[i])) <= 1e-9 * Math.max(1, Math.abs(Number(y[i]))));
}

/** Giac's error answers: ours print `GIAC_ERROR: msg`, the .out holds `"msg"`. */
export function errorText(s: string): string {
  return s.replace(/^GIAC_ERROR: /, "").replace(/^"(.*)"$/s, "$1");
}

export type Outcome = "equal" | "equivalent" | "different";

/** Decides one pair. `equivalent(got, expected)` says whether the two texts are the same value (simplify to 0, numeric check). */
export function compare(input: string, got: string, expected: string, equivalent: (got: string, expected: string) => boolean): Outcome {
  const g = got.trim();
  const e = expected.trim();
  if (g === e) return "equal";
  if (isAssignment(input) && e.replace(/"/g, "") === "Done") return "equal";
  if (g.startsWith("GIAC_ERROR: ") && errorText(g) === errorText(e)) return "equal";
  if (sameWithinRounding(g, e)) return "equivalent";
  return equivalent(g, e) ? "equivalent" : "different";
}

/** The command that asks Giac whether `a` and `b` are the same value: simplify of the difference is 0; for an integral
 *  (`integrate` in the input) the derivative of the difference in x is taken first. */
export function diffCommand(input: string, a: string, b: string): string {
  const d = `(${a})-(${b})`;
  return /integrate|int\(/.test(input) ? `simplify(diff(${d},x))` : `simplify(${d})`;
}

/** A numeric check at x = 0.37, 1.73, 2.9: the commands whose answers must all be near 0. */
export const NUMERIC_POINTS: readonly string[] = ["0.37", "1.73", "2.9"];
export function numericCommand(a: string, b: string, x: string): string {
  return `evalf(subst((${a})-(${b}),x=${x}))`;
}
export function nearZero(text: string, tol = 1e-8): boolean {
  const v = Number(text.trim());
  return Number.isFinite(v) && Math.abs(v) <= tol;
}
