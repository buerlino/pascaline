// SPDX-License-Identifier: GPL-3.0-or-later
// G64: CAS answers checked back (r16 section 3). Each check takes an answer and asks `at(expr, x)` for the number an
// expression has at x (null: not a plain real number there). A claim holds when the difference is 0 at every point.
// No expected values: the answer is checked against the question it answers. Only erasable TypeScript syntax.

/** The value of a Giac expression with x replaced by the text `x`, or null when it is not a plain real number. */
export type At = (expr: string, x: string) => number | null;

export type Kind = "antiderivative" | "solution" | "factorisation" | "simplification";

/** Three points in (0, 1), inside the domain of ln, sqrt and 1/(x+a) for the generated forms, and one negative point,
 *  where a lost sign shows (sqrt(x^2) -> x agrees at all three positive ones). */
export const POINTS: readonly string[] = ["0.3", "0.55", "0.8", "-0.7"];
const TOL = 1e-7;

export interface Verdict {
  /** "ok": holds; "wrong": differs at a point; "skip": not checkable (the reason says why). */
  status: "ok" | "wrong" | "skip";
  detail: string;
}

const ok: Verdict = { status: "ok", detail: "" };
const skip = (detail: string): Verdict => ({ status: "skip", detail });

/** What the bridge says of a printed answer (P20: its kind and tree, not its spelling). */
export interface Info {
  /** Giac's kind of the value ("undef", "error", "symbolic", "list", …). */
  kind: string;
  /** The tree holds an unevaluated `int`, `integrate`, `solve`, `undef` or an equation. */
  unresolved: boolean;
}
export type Probe = (text: string) => Info;

/** Kinds that are no expression to check back. */
const NO_EXPRESSION: ReadonlySet<string> = new Set(["undef", "error", "other", "string", "function", "boolean", "infinity", "list", "matrix", "sequence", "set"]);

/** The claim `answer = original` at every point, each evaluated alone. A point where exactly one has a real value is wrong
 *  (a lost sign: ln(x^2) -> 2*ln(x) is not real at x<0); only a point where neither has one is not checked. */
function sameAt(answer: string, original: string, at: At, points: readonly string[] = POINTS): Verdict {
  let seen = 0;
  for (const p of points) {
    const a = at(answer, p);
    const o = at(original, p);
    if (a === null && o === null) continue;
    seen++;
    if (a === null || o === null) return { status: "wrong", detail: `${a === null ? answer : original} is not real at x=${p}, ${a === null ? original : answer} = ${a ?? o}` };
    if (!(Math.abs(a - o) <= TOL)) return { status: "wrong", detail: `${answer} = ${a}, ${original} = ${o} at x=${p}` };
  }
  return seen > 0 ? ok : skip("no real number at any point");
}

function notAnswer(answer: string, probe: Probe): string | null {
  const i = probe(answer);
  if (i.unresolved) return "unevaluated in the answer";
  return NO_EXPRESSION.has(i.kind) ? `answer is ${i.kind}` : null;
}

/** An antiderivative differentiates to the integrand. */
export function checkAntiderivative(integrand: string, answer: string, at: At, probe: Probe): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(`diff(${answer},x)`, integrand, at);
}

/** A factorisation expands back to the original. */
export function checkFactorisation(original: string, answer: string, at: At, probe: Probe): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(answer, original, at);
}

/** A simplification agrees with the original at the points. */
export function checkSimplification(original: string, answer: string, at: At, probe: Probe): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(answer, original, at);
}

/** The entries of a printed list, read by Giac's bridge (P20: no bracket loop here); null when the text is not a list. */
export type Entries = (text: string) => string[] | null;

/** Every solution of `lhs=rhs` substitutes to 0 (one check per entry, so a missing solution is not noticed: only wrong ones). */
export function checkSolutions(equation: string, answer: string, at: At, entries: Entries, probe: Probe): Verdict {
  const sols = entries(answer);
  if (!sols || sols.length === 0) return skip("no list of solutions");
  const sides = equation.split("=");
  if (sides.length !== 2) return skip("not an equation");
  const diff = `(${sides[0]})-(${sides[1]})`;
  for (const s of sols) {
    const why = notAnswer(s, probe);
    if (why) return skip(`solution ${s}: ${why}`);
    const v = at(diff, s);
    if (v === null) return skip(`solution ${s} gives no real number`);
    if (!(Math.abs(v) <= TOL)) return { status: "wrong", detail: `${diff} = ${v} at x=${s}` };
  }
  return ok;
}

/** One question for the stage: what is asked of the CAS and how its answer is checked back. */
export interface Question {
  id: string;
  kind: Kind;
  /** The CAS input. */
  input: string;
  /** The expression the answer is checked against (integrand, original, equation). */
  subject: string;
}

export function checkBack(q: Question, answer: string, at: At, entries: Entries, probe: Probe): Verdict {
  switch (q.kind) {
    case "antiderivative": return checkAntiderivative(q.subject, answer, at, probe);
    case "solution": return checkSolutions(q.subject, answer, at, entries, probe);
    case "factorisation": return checkFactorisation(q.subject, answer, at, probe);
    case "simplification": return checkSimplification(q.subject, answer, at, probe);
  }
}

/** mulberry32: a fixed-seed generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sgn = (n: number, first = false): string => (n < 0 ? `-${-n}` : first ? `${n}` : `+${n}`);

/** Generated questions, deterministic for a seed: integrals, factorisations and equations in x (simplifications come from G61's generator, in the stage). */
export function generated(seed: number, count: number): Question[] {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const n = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const a = n(2, 5);
    const b = n(1, 4);
    const k = i % 3;
    if (k === 0) {
      const f = pick([`x^${a}`, `sin(${a}*x)`, `exp(${a}*x)`, `1/(x+${b})`, `x*exp(x)`, `x^${a}+${b}*x`, `cos(${a}*x)*${b}`, `x*sin(x)`, `sqrt(x+${b})`]);
      out.push({ id: `antiderivative: ${f}`, kind: "antiderivative", input: `int(${f},x)`, subject: f });
    } else if (k === 1) {
      const p = n(-4, 4) || 1;
      const q = n(-4, 4) || 2;
      const f = pick([`x^2${sgn(p + q)}*x${sgn(p * q)}`, `x^3${sgn(-p)}*x^2${sgn(-q)}*x${sgn(p * q)}`, `${a * a}*x^2-${b * b}`, `x^4-${a * a}`]);
      out.push({ id: `factorisation: ${f}`, kind: "factorisation", input: `factor(${f})`, subject: f });
    } else {
      const p = n(-5, 5);
      const q = n(-5, 5);
      const eq = pick([`x^2${sgn(-(p + q))}*x${sgn(p * q)}=0`, `${a}*x${sgn(b)}=${n(-6, 6)}`, `x^2=${a}`, `x^3-${a}*x=0`, `x^2+${b}*x=${a}`]);
      out.push({ id: `solution: ${eq}`, kind: "solution", input: `solve(${eq},x)`, subject: eq });
    }
  }
  return out;
}

/** The questions G55's corpus holds in a checkable form (indefinite int, factor, solve with one equation, simplify, all in x); the rest is counted as skipped. */
export function fromCorpus(inputs: readonly string[]): { questions: Question[]; skipped: number } {
  const questions: Question[] = [];
  let skipped = 0;
  for (const input of inputs) {
    let m: RegExpExecArray | null;
    if ((m = /^int\((.+),x\)$/.exec(input))) questions.push({ id: `corpus antiderivative: ${m[1]}`, kind: "antiderivative", input, subject: m[1]! });
    else if ((m = /^factor\((.+)\)$/.exec(input))) questions.push({ id: `corpus factorisation: ${m[1]}`, kind: "factorisation", input, subject: m[1]! });
    else if ((m = /^solve\((.+=.+),x\)$/.exec(input))) questions.push({ id: `corpus solution: ${m[1]}`, kind: "solution", input, subject: m[1]! });
    else if ((m = /^simplify\((.+)\)$/.exec(input))) questions.push({ id: `corpus simplification: ${m[1]}`, kind: "simplification", input, subject: m[1]! });
    else skipped++;
  }
  return { questions, skipped };
}
