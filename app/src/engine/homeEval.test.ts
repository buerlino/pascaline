// SPDX-License-Identifier: GPL-3.0-or-later
// Pure parts of exact-first Home. Every expected value here is `derived` (exact arithmetic by hand).
import { describe, expect, it } from "vitest";
import { toExactLiterals } from "./homeEval.ts";

describe("toExactLiterals", () => {
  it.each([
    ["0.1", "(1/10^1)"],
    ["1-0.9-0.1", "1-(9/10^1)-(1/10^1)"],
    [".5", "(5/10^1)"],
    ["2.50", "(250/10^2)"],
    ["1e-3", "(1/10^3)"],
    ["1.5e300", "(15*10^299)"],
    ["1.2E5", "(12*10^4)"],
    ["12", "12"],
    ["x1+2.5", "x1+(25/10^1)"],
    ['"0.1"', '"0.1"'],
  ])("%s -> %s", (input, out) => {
    expect(toExactLiterals(input)).toBe(out);
  });
});
