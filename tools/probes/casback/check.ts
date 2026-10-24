// SPDX-License-Identifier: GPL-3.0-or-later
// G64: CAS answers checked back (r16 section 3). Each check takes an answer and asks `at(expr, x)` for the number an
// expression has at x (null: not a plain real number there). A claim holds when the difference is 0 at every point.
// No expected values: the answer is checked against the question it answers. Only erasable TypeScript syntax.

/** The value of a Giac expression with x replaced by the text `x`, or null when it is not a plain real number. */
export type At = (expr: string, x: string) => number | null;

export type Kind = "antiderivative" | "solution" | "factorisation" | "simplification";

/** Three points in (0, 1): inside the domain of ln, sqrt and 1/(x+a) for the generated forms. */
export const POINTS: readonly string[] = ["0.3", "0.55", "0.8"];
const TOL = 1e-7;

export interface Verdict {
  /** "ok": holds; "wrong": differs at a point; "skip": not checkable (the reason says why). */
  status: "ok" | "wrong" | "skip";
  detail: string;
}

const ok: Verdict = { status: "ok", detail: "" };
const skip = (detail: string): Verdict => ({ status: "skip", detail });

/** diff is 0 at every point: `diff` is an expression in x. */
function zeroAt(diff: string, at: At, points: readonly string[] = POINTS): Verdict {
  for (const p of points) {
    const v = at(diff, p);
    if (v === null) return skip(`no real number at x=${p}`);
    if (!(Math.abs(v) <= TOL)) return { status: "wrong", detail: `${diff} = ${v} at x=${p}` };
  }
  return ok;
}

const unresolved = (answer: string): boolean => /(^|[^A-Za-z_])(int|integrate|solve|undef|infinity|inf|GIAC_ERROR)\b|\bi\b|@|\?/.test(answer) || answer.trim() === "";

/** An antiderivative differentiates to the integrand. */
export function checkAntiderivative(integrand: string, answer: string, at: At): Verdict {
  if (unresolved(answer)) return skip("no closed form");
  return zeroAt(`diff(${answer},x)-(${integrand})`, at);
}

/** A factorisation expands back to the original. */
export function checkFactorisation(original: string, answer: string, at: At): Verdict {
  if (unresolved(answer)) return skip("no factorisation");
  return zeroAt(`(${answer})-(${original})`, at);
}

/** A simplification agrees with the original at three points. */
export function checkSimplification(original: string, answer: string, at: At): Verdict {
  if (unresolved(answer)) return skip("no simplification");
  return zeroAt(`(${answer})-(${original})`, at);
}

/** The top-level entries of a printed list `[a,b,c]`; null when the text is not one. */
export function listEntries(text: string): string[] | null {
  const t = text.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of t.slice(1, -1)) {
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.map((s) => s.trim());
}

/** Every solution of `lhs=rhs` substitutes to 0 (one check per entry, so a missing solution is not noticed: only wrong ones). */
export function checkSolutions(equation: string, answer: string, at: At): Verdict {
  const sols = listEntries(answer);
  if (!sols || sols.length === 0) return skip("no list of solutions");
  const sides = equation.split("=");
  if (sides.length !== 2) return skip("not an equation");
  const diff = `(${sides[0]})-(${sides[1]})`;
  for (const s of sols) {
    if (/=|\bi\b|[A-Za-z_]\w*\(\s*[^)]*\b[a-z]\b/.test(s) && !/^[\w+\-*/^().\s]+$/.test(s)) return skip(`solution ${s} is not a plain value`);
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

export function checkBack(q: Question, answer: string, at: At): Verdict {
  switch (q.kind) {
    case "antiderivative": return checkAntiderivative(q.subject, answer, at);
    case "solution": return checkSolutions(q.subject, answer, at);
    case "factorisation": return checkFactorisation(q.subject, answer, at);
    case "simplification": return checkSimplification(q.subject, answer, at);
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

/** Generated questions, deterministic for a seed: integrals, factorisations, equations and simplifications in x. */
export function generated(seed: number, count: number): Question[] {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const n = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const a = n(2, 5);
    const b = n(1, 4);
    const k = i % 4;
    if (k === 0) {
      const f = pick([`x^${a}`, `sin(${a}*x)`, `exp(${a}*x)`, `1/(x+${b})`, `x*exp(x)`, `x^${a}+${b}*x`, `cos(${a}*x)*${b}`, `x*sin(x)`, `sqrt(x+${b})`]);
      out.push({ id: `antiderivative: ${f}`, kind: "antiderivative", input: `int(${f},x)`, subject: f });
    } else if (k === 1) {
      const p = n(-4, 4) || 1;
      const q = n(-4, 4) || 2;
      const f = pick([`x^2${sgn(p + q)}*x${sgn(p * q)}`, `x^3${sgn(-p)}*x^2${sgn(-q)}*x${sgn(p * q)}`, `${a * a}*x^2-${b * b}`, `x^4-${a * a}`]);
      out.push({ id: `factorisation: ${f}`, kind: "factorisation", input: `factor(${f})`, subject: f });
    } else if (k === 2) {
      const p = n(-5, 5);
      const q = n(-5, 5);
      const eq = pick([`x^2${sgn(-(p + q))}*x${sgn(p * q)}=0`, `${a}*x${sgn(b)}=${n(-6, 6)}`, `x^2=${a}`, `x^3-${a}*x=0`, `x^2+${b}*x=${a}`]);
      out.push({ id: `solution: ${eq}`, kind: "solution", input: `solve(${eq},x)`, subject: eq });
    } else {
      const f = pick([`sin(x)^2+cos(x)^2+${b}*x`, `(x^2-${a * a})/(x-${a})`, `exp(x)*exp(${b}*x)`, `sin(2*x)/cos(x)`, `ln(x^${a})`, `(x+${b})^2-x^2`, `sqrt(x^2)`, `tan(x)*cos(x)`]);
      out.push({ id: `simplification: ${f}`, kind: "simplification", input: `simplify(${f})`, subject: f });
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
