// SPDX-License-Identifier: GPL-3.0-or-later
// R54: the list key, Shift + 8, inserts `\left\{#0\right\}`; its body is a comma-separated list, Giac's [ ]. Expected
// Giac text derived by hand (a list's elements in order). The same cases, run through Giac, are group
// "lists-matrices" of tests/golden/parser.yaml.
import { describe, expect, it } from "vitest";
import { SerializeError } from "./errors.ts";
import { latexToGiac, latexToGiacInfo } from "./latex-to-giac.ts";
import { mathJsonToGiac } from "./emit.ts";

describe("the list braces (R54)", () => {
  it("read as a Giac list, one element or many, nested", () => {
    expect(latexToGiac("\\left\\{1,2,3\\right\\}")).toBe("[1,2,3]");
    expect(latexToGiac("\\left\\{5\\right\\}")).toBe("[5]");
    expect(latexToGiac("\\left\\{1,\\left\\{2,3\\right\\}\\right\\}")).toBe("[1,[2,3]]");
    expect(latexToGiac("\\operatorname{mean}\\left(\\left\\{9.81,9.79\\right\\}\\right)")).toBe("mean([9.81,9.79])");
  });

  it("a chip is an element: its value, and an inexact one keeps the result from =", () => {
    const chips = { "res:1": { value: "1/4", exact: true }, "res:2": { value: "0.3333333333333333", exact: false } };
    const one = latexToGiac("\\res{1}{0.25}", { chips });
    expect(latexToGiac("\\left\\{\\res{1}{0.25},2\\right\\}", { chips })).toBe(`[${one},2]`);
    expect(latexToGiacInfo("\\left\\{\\res{2}{0.333333333333},1\\right\\}", { chips }).inexact).toBe(true);
  });

  it("an empty list is refused with a message from the table, never []", () => {
    let err: unknown;
    try {
      latexToGiac("\\left\\{\\right\\}");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SerializeError);
    expect((err as SerializeError).key).toBe("parse.emptyList");
  });
});

// R77 (backlog F76): x² and xʸ on a { } list go elementwise, Giac's `.^`; Giac's `^` on a list is the dot product
// ([1,2]^2 = 5). Derived: {1,2}² = {1,4}, {1,2}³ = {1,8}, {4,9}^0.5 = {2,3}. The values run through Giac in group
// "lists-matrices" of tests/golden/parser.yaml (lists-matrices-10 to -16).
describe("a list to a power (R77)", () => {
  it("goes elementwise: braces, the list key's form or typed, emit `.^`", () => {
    expect(latexToGiac("\\left\\{1,2\\right\\}^{2}")).toBe("[1,2].^2");
    expect(latexToGiac("\\left\\{1,2\\right\\}^{3}")).toBe("[1,2].^3");
    expect(latexToGiac("\\left\\{1,2\\right\\}^{4}")).toBe("[1,2].^4");
    expect(latexToGiac("\\left\\{4,9\\right\\}^{0.5}")).toBe("[4,9].^0.5");
    expect(latexToGiac("\\{1,2\\}^{2}")).toBe("[1,2].^2");
    expect(latexToGiac("\\left\\{1,2\\right\\}\\char\"5E 2")).toBe("[1,2].^2");
    expect(latexToGiac("\\left(\\left\\{1,2\\right\\}\\right)^{2}")).toBe("([1,2]).^2");
    expect(latexToGiac("-\\left\\{1,2\\right\\}^{2}")).toBe("-[1,2].^2");
    expect(mathJsonToGiac(["Square", ["List", 1, 2]])).toBe("[1,2].^2");
  });

  it("keeps `^` for a matrix and a name: G97 (nonsquare.ts) reads those in Giac", () => {
    expect(latexToGiac("\\begin{pmatrix}1&2\\end{pmatrix}^{2}")).toBe("[[1,2]]^2");
    expect(latexToGiac("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}^{2}")).toBe("[[1,2],[3,4]]^2");
    expect(mathJsonToGiac(["Power", "L", 2])).toBe("L^2");
    expect(mathJsonToGiac(["Power", ["Matrix", ["List", ["List", 1, 2]]], 2])).toBe("[[1,2]]^2");
  });
});

// R78 (backlog F78): a { } list plus or minus a number goes elementwise, Giac's `.+` and `.-`; Giac's `+` on a list and
// a number is polynomial addition ([1,4]+1 = poly1[1,5]). Derived: {1,4}+1 = {2,5}, {1,4}-1 = {0,3}, 1-{1,4} = {0,-3};
// {1,2}+{3,4} = {4,6} keeps `+`. The signs carry spaces: `1.+2` reads as the float 1. plus 2 in Giac (probed
// 2026-10-23). The values run through Giac in group "lists-matrices" of tests/golden/parser.yaml (-17 to -24); -25 is
// the typed `[1,4]+1`, refused by the parser and not changed here (G106).
describe("a list plus or minus a number (R78)", () => {
  it("goes elementwise: braces, the list key's form or typed, emit `.+` and `.-`", () => {
    expect(latexToGiac("\\left\\{1,4\\right\\}+1")).toBe("[1,4] .+ 1");
    expect(latexToGiac("\\left\\{1,4\\right\\}-1")).toBe("[1,4] .- 1");
    expect(latexToGiac("1-\\left\\{1,4\\right\\}")).toBe("1 .- [1,4]");
    expect(latexToGiac("1+\\left\\{1,4\\right\\}")).toBe("1 .+ [1,4]");
    expect(latexToGiac("\\{1,4\\}+1")).toBe("[1,4] .+ 1");
    expect(latexToGiac("\\left(\\left\\{1,4\\right\\}\\right)+1")).toBe("([1,4]) .+ 1");
    expect(latexToGiac("-\\left\\{1,4\\right\\}+1")).toBe("-[1,4] .+ 1");
    expect(latexToGiac("\\left\\{1,4\\right\\}+1+2")).toBe("[1,4] .+ 1 .+ 2");
    expect(latexToGiac("\\left\\{1,2\\right\\}+\\left\\{3,4\\right\\}+1")).toBe("[1,2] .+ [3,4] .+ 1");
    expect(mathJsonToGiac(["Subtract", 1, ["List", 1, 4]])).toBe("1 .- [1,4]");
  });

  it("flattens the whole sum into one chain: Giac merges a `+` sum next to `.+` ((1+2) .+ [1,4] = poly1[1,7])", () => {
    expect(latexToGiac("\\left(1+2\\right)+\\left\\{1,4\\right\\}")).toBe("1 .+ 2 .+ [1,4]");
    expect(latexToGiac("\\left\\{1,4\\right\\}-\\left(1+2\\right)")).toBe("[1,4] .- 1 .- 2");
    expect(latexToGiac("\\left\\{1,4\\right\\}-\\left(1-x\\right)")).toBe("[1,4] .- 1 .+ x");
    expect(mathJsonToGiac(["Add", ["Add", ["List", 1, 4], 1], 2])).toBe("[1,4] .+ 1 .+ 2");
    expect(mathJsonToGiac(["Multiply", 2, ["Add", ["List", 1, 4], 1]])).toBe("2*([1,4] .+ 1)");
  });

  it("keeps `+` for a list plus a list, a matrix and a name", () => {
    expect(latexToGiac("\\left\\{1,2\\right\\}+\\left\\{3,4\\right\\}")).toBe("[1,2]+[3,4]");
    expect(latexToGiac("\\left\\{1,4\\right\\}-\\left\\{1,1\\right\\}")).toBe("[1,4]-[1,1]");
    expect(latexToGiac("\\begin{pmatrix}1&4\\end{pmatrix}+1")).toBe("[[1,4]]+1");
    expect(mathJsonToGiac(["Add", "L", 1])).toBe("L+1");
  });

  it("does not change a typed [1,4]+1: the parser refuses square brackets, so no `.+` is emitted (G106 refuses it)", () => {
    const key = (latex: string): string | undefined => {
      try {
        latexToGiac(latex);
      } catch (e) {
        return e instanceof SerializeError ? e.key : String(e);
      }
      return undefined;
    };
    expect(key("\\left[1,4\\right]+1")).toBe("parse.unsupportedDelimiter");
    expect(key("[1,4]+1")).toBe("parse.atToken");
  });
});

// R78f1 (backlog F79): a { } list times a { } list goes elementwise, Giac's `.*`; Giac's `*` on two lists is the dot
// product ([1,4]*[1,1] = 5, probed on c381b15). Derived: {1,4}×{1,1} = {1,4}, {1,2}×{3,4} = {3,8}; 2×{1,4} keeps `*`
// (= {2,8}). The values run through Giac in group "lists-matrices" of tests/golden/parser.yaml (-26 to -31).
describe("a list times a list (R78f1)", () => {
  it("goes elementwise: ×, · and side by side emit `.*` with spaces", () => {
    expect(latexToGiac("\\left\\{1,4\\right\\}\\times\\left\\{1,1\\right\\}")).toBe("[1,4] .* [1,1]");
    expect(latexToGiac("\\left\\{1,4\\right\\}\\cdot\\left\\{1,1\\right\\}")).toBe("[1,4] .* [1,1]");
    expect(latexToGiac("\\left\\{1,4\\right\\}\\left\\{1,1\\right\\}")).toBe("[1,4] .* [1,1]");
    expect(latexToGiac("\\{1,2\\}\\times\\{3,4\\}")).toBe("[1,2] .* [3,4]");
    expect(latexToGiac("\\left(\\left\\{1,4\\right\\}\\right)\\left\\{1,1\\right\\}")).toBe("([1,4]) .* [1,1]");
    expect(latexToGiac("2\\left\\{1,4\\right\\}\\left\\{1,1\\right\\}")).toBe("2 .* [1,4] .* [1,1]");
    expect(latexToGiac("-\\left\\{1,2\\right\\}\\times\\left\\{3,4\\right\\}")).toBe("-[1,2] .* [3,4]");
    expect(mathJsonToGiac(["Multiply", ["List", 1, 2], ["List", 3, 4], ["List", 5, 6]])).toBe("[1,2] .* [3,4] .* [5,6]");
  });

  it("keeps `*` for a number times a list, a matrix and a name", () => {
    expect(latexToGiac("2\\times\\left\\{1,4\\right\\}")).toBe("2*[1,4]");
    expect(latexToGiac("2\\left\\{1,4\\right\\}")).toBe("2*[1,4]");
    expect(latexToGiac("\\begin{pmatrix}1&2\\end{pmatrix}\\times\\begin{pmatrix}3\\\\4\\end{pmatrix}")).toBe("[[1,2]]*[[3],[4]]");
    expect(mathJsonToGiac(["Multiply", "L", ["List", 1, 4]])).toBe("L*[1,4]");
  });
});

// R79 (backlog F79): a part that is a list expression (a list to a power, a bracketed sum or negative of a list, a
// product of lists) counts as a list for x², ×, + and −, so Giac's dot product and polynomial sum never see it.
// Derived: {1,2}²×{3,4} = {1·3, 4·4} = {3,16}; ({1,4}+1)×{1,1} = {2,5}; {1,2}×(−{3,4}) = {−3,−8}; ({1,2}+1)² =
// {4,9}; (−{1,2})² = {1,4}; ({1,2}×{3,4})+1 = {4,9}. The values run through Giac in group "lists-matrices" of
// tests/golden/parser.yaml (-32 to -37).
describe("a list expression as a part (R79)", () => {
  it("a list-valued factor joins the elementwise product", () => {
    expect(latexToGiac("\\left\\{1,2\\right\\}^{2}\\times\\left\\{3,4\\right\\}")).toBe("[1,2].^2 .* [3,4]");
    expect(latexToGiac("\\left(\\left\\{1,4\\right\\}+1\\right)\\times\\left\\{1,1\\right\\}")).toBe("([1,4] .+ 1) .* [1,1]");
    expect(latexToGiac("\\left(\\left\\{1,4\\right\\}+1\\right)\\left\\{1,1\\right\\}")).toBe("([1,4] .+ 1) .* [1,1]");
    expect(latexToGiac("\\left\\{1,2\\right\\}\\times\\left(-\\left\\{3,4\\right\\}\\right)")).toBe("[1,2] .* (-[3,4])");
    expect(mathJsonToGiac(["Multiply", ["Divide", ["List", 1, 2], 2], ["List", 3, 4]])).toBe("[1,2]/2 .* [3,4]");
  });

  it("a list-valued base goes elementwise", () => {
    expect(latexToGiac("\\left(\\left\\{1,2\\right\\}+1\\right)^{2}")).toBe("([1,2] .+ 1).^2");
    expect(latexToGiac("\\left(-\\left\\{1,2\\right\\}\\right)^{2}")).toBe("(-[1,2]).^2");
    expect(mathJsonToGiac(["Square", ["Delimiter", ["Negate", ["List", 1, 2]]]])).toBe("(-[1,2]).^2");
    expect(mathJsonToGiac(["Power", ["Multiply", 2, ["List", 1, 2]], 2])).toBe("(2*[1,2]).^2");
  });

  it("a list-valued term joins the elementwise sum", () => {
    expect(latexToGiac("\\left(\\left\\{1,2\\right\\}\\times\\left\\{3,4\\right\\}\\right)+1")).toBe("([1,2] .* [3,4]) .+ 1");
    expect(latexToGiac("\\left\\{1,2\\right\\}\\times\\left\\{3,4\\right\\}+1")).toBe("[1,2] .* [3,4] .+ 1");
    expect(latexToGiac("\\left\\{1,2\\right\\}^{2}+1")).toBe("[1,2].^2 .+ 1");
    expect(latexToGiac("\\left\\{1,2\\right\\}^{2}+\\left\\{3,4\\right\\}")).toBe("[1,2].^2+[3,4]");
  });

  it("keeps the plain operators for matrices, names and numbers", () => {
    expect(latexToGiac("\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}+1\\right)^{2}")).toBe("([[1,2],[3,4]]+1)^2");
    expect(mathJsonToGiac(["Power", ["Delimiter", ["Add", "L", 1]], 2])).toBe("(L+1)^2");
    expect(mathJsonToGiac(["Multiply", ["Power", "L", 2], ["List", 1, 2]])).toBe("L^2*[1,2]");
    expect(latexToGiac("\\left(1+2\\right)^{2}\\times3")).toBe("(1+2)^2*3");
  });
});
