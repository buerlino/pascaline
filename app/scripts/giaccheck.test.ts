// SPDX-License-Identifier: GPL-3.0-or-later
// A19: the runner of Giac's check/ suite: input splitting, output splitting, the comparison.
import { describe, expect, test } from "vitest";
import { compare, sameWithinRounding, statementCount, diffCommand, isAssignment, nearZero, splitInputs, splitOutputs } from "../../tools/probes/giaccheck/lib.ts";

// a snippet of check/testnormalize: a backslash continuation, an assignment, `;` + newline
const SNIPPET = "res := p11*p22*q1^2-\\\np12*p21*q1^2;\nnon_recursive_normal(((x+y)^2-(z+1)^2)^4/(x+y+z+1)^8);\nf(x):=x^2;\nint(x,x);\n";
describe("giac check runner", () => {
  test("a continuation joins, ; + newline splits", () => {
    expect(splitInputs(SNIPPET)).toEqual(["res := p11*p22*q1^2-p12*p21*q1^2", "non_recursive_normal(((x+y)^2-(z+1)^2)^4/(x+y+z+1)^8)", "f(x):=x^2", "int(x,x)"]);
  });
  test("a ; inside a line does not split", () => {
    expect(splitInputs("a:=1;b:=2;\nc;\n")).toEqual(["a:=1;b:=2", "c"]);
  });
  test("outputs: one per line, the closing comma dropped", () => {
    expect(splitOutputs('"Done",\n(x+1)/2,\n0\n')).toEqual(['"Done"', "(x+1)/2", "0"]);
  });
  test("assignments", () => {
    expect(isAssignment("res := 3")).toBe(true);
    expect(isAssignment("f(x):=x^2")).toBe(true);
    expect(isAssignment("a==b")).toBe(false);
  });
  const never = () => false;
  test("equal, Done for an assignment, equivalent, different", () => {
    expect(compare("1+1", "2", "2", never)).toBe("equal");
    expect(compare("res:=1", "1", '"Done"', never)).toBe("equal");
    expect(compare("1+1", "x+1", "1+x", () => true)).toBe("equivalent");
    expect(compare("1+1", "3", "2", never)).toBe("different");
  });
  test("integrals compare by the derivative of the difference", () => {
    expect(diffCommand("integrate(x,x)", "x^2/2", "x^2/2+1")).toBe("simplify(diff((x^2/2)-(x^2/2+1),x))");
    expect(diffCommand("factor(x)", "a", "b")).toBe("simplify((a)-(b))");
  });
  test("statements per input, rounding, error text", () => {
    expect(statementCount("b:=G(a); factor(x^7-x+1,b)")).toBe(2);
    expect(statementCount('f(a;b)+"x;y"')).toBe(1);
    expect(sameWithinRounding("[0.216666666667,1]", "[0.216666666668,1]")).toBe(true);
    expect(sameWithinRounding("[0.2,1]", "[0.3,1]")).toBe(false);
    expect(compare("egv(m)", "GIAC_ERROR: Bad", '"Bad"', never)).toBe("equal");
  });
  test("near zero", () => {
    expect(nearZero("1e-12")).toBe(true);
    expect(nearZero("0.3")).toBe(false);
    expect(nearZero("undef")).toBe(false);
  });
});
