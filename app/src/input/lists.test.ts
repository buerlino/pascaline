// SPDX-License-Identifier: GPL-3.0-or-later
// R54: the list key, Shift + 8, inserts `\left\{#0\right\}`; its body is a comma-separated list, Giac's [ ]. Expected
// Giac text derived by hand (a list's elements in order). The same cases, run through Giac, are group
// "lists-matrices" of tests/golden/parser.yaml.
import { describe, expect, it } from "vitest";
import { SerializeError } from "./errors.ts";
import { latexToGiac, latexToGiacInfo } from "./latex-to-giac.ts";

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
