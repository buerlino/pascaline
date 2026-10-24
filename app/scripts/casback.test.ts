// SPDX-License-Identifier: GPL-3.0-or-later
// G64: the check-back kinds on fixed answers, with a small JS evaluator standing in for Giac (no engine: the stage itself is scripts/casback.ts).
import { describe, expect, it } from "vitest";
import { checkAntiderivative, checkFactorisation, checkSimplification, checkSolutions, fromCorpus, generated, type At, type Entries } from "../../tools/probes/casback/check.ts";

/** Rewrites diff(F,x) into D(x=>F) (balanced parentheses), the rest into JS. */
function js(e: string): string {
  let out = "";
  for (let i = 0; i < e.length; ) {
    if (e.startsWith("diff(", i)) {
      let depth = 1;
      let j = i + 5;
      while (depth > 0) depth += e[j] === "(" ? 1 : e[j] === ")" ? -1 : 0, j++;
      out += `D(x=>${js(e.slice(i + 5, j - 1).replace(/,x$/, ""))})(x)`;
      i = j;
    } else out += e[i++];
  }
  return out.replace(/\^/g, "**").replace(/\bln\b/g, "log");
}

/** Evaluates a Giac-spelled expression with x replaced by the point; diff by a central difference. */
const at: At = (expr, x) => {
  const D = (f: (x: number) => number) => (x0: number) => (f(x0 + 1e-5) - f(x0 - 1e-5)) / 2e-5;
  const point = Function("with(Math){return (" + js(x) + ")}")() as number;
  const v = Function("D", "x", "with(Math){return (" + js(expr) + ")}")(D, point) as number;
  return Number.isFinite(v) ? v : null;
};

/** Stands in for the bridge's list reader: a flat list of simple entries. */
const entries: Entries = (t) => (t.startsWith("[") && t.endsWith("]") ? (t.slice(1, -1).trim() === "" ? [] : t.slice(1, -1).split(",").map((e) => e.trim())) : null);

describe("check back", () => {
  it("accepts a right antiderivative and rejects a wrong one", () => {
    expect(checkAntiderivative("x^2", "x^3/3", at).status).toBe("ok");
    expect(checkAntiderivative("x^2", "x^3/2", at).status).toBe("wrong");
    expect(checkAntiderivative("sin(x)", "-cos(x)", at).status).toBe("ok");
    expect(checkAntiderivative("sin(x)", "cos(x)", at).status).toBe("wrong");
  });
  it("skips an unresolved integral", () => {
    expect(checkAntiderivative("exp(-x^2)", "int(exp(-x^2),x)", at).status).toBe("skip");
  });
  it("accepts solutions that substitute to 0 and rejects one that does not", () => {
    expect(checkSolutions("x^2-1=0", "[-1,1]", at, entries).status).toBe("ok");
    expect(checkSolutions("x^2=2", "[-sqrt(2),sqrt(2)]", at, entries).status).toBe("ok");
    expect(checkSolutions("x^2-1=0", "[-1,2]", at, entries).status).toBe("wrong");
    expect(checkSolutions("x^2+1=0", "[]", at, entries).status).toBe("skip");
  });
  it("accepts a factorisation that expands back and rejects one that does not", () => {
    expect(checkFactorisation("x^2-1", "(x-1)*(x+1)", at).status).toBe("ok");
    expect(checkFactorisation("x^2-1", "(x-1)*(x+2)", at).status).toBe("wrong");
  });
  it("accepts a simplification that agrees at three points and rejects one that does not", () => {
    expect(checkSimplification("sin(x)^2+cos(x)^2", "1", at).status).toBe("ok");
    expect(checkSimplification("sin(x)^2+cos(x)^2", "x", at).status).toBe("wrong");
  });
  it("rejects sqrt(x^2) -> x, which agrees at every positive point", () => {
    expect(checkSimplification("sqrt(x^2)", "x", at).status).toBe("wrong");
    expect(checkSimplification("sqrt(x^2)", "abs(x)", at).status).toBe("ok");
  });
  it("skips only the points without a real value", () => {
    expect(checkSimplification("ln(x^2)", "2*ln(x)", at).status).toBe("ok");
    expect(checkSimplification("ln(x)", "ln(x)+1", at).status).toBe("wrong");  });
});

describe("helpers", () => {
  it("generates the same questions for a seed, all four kinds", () => {
    const a = generated(5, 40);
    expect(generated(5, 40)).toEqual(a);
    expect(new Set(a.map((q) => q.kind)).size).toBe(4);
  });
  it("takes the checkable corpus inputs and counts the rest", () => {
    const r = fromCorpus(["factor(x^4-1)", "int(x^2,x,0,1)", "solve(x^2-2=0,x)", "sin(30)"]);
    expect(r.questions.map((q) => q.kind)).toEqual(["factorisation", "solution"]);
    expect(r.skipped).toBe(2);
  });
});
