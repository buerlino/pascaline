// SPDX-License-Identifier: GPL-3.0-or-later
// G52: calls per input 11 % over the baseline's fail the stage; 10 % over still passes. G52f1: more inputs do not fail it.
import { describe, expect, it } from "vitest";
import { callsStage } from "./calls-budget.ts";

/** n inputs of `each` calls apiece. */
const inputs = (n: number, each: number) => new Map(Array.from({ length: n }, (_, i) => [`i${i}`, each] as [string, number]));
/** A set of n inputs with the given total (the first input takes the remainder). */
const totalOf = (n: number, total: number) => {
  const m = inputs(n, Math.floor(total / n));
  m.set("i0", Math.floor(total / n) + (total % n));
  return m;
};

describe("calls budget", () => {
  it("passes at the baseline and at +10 % per input", () => {
    expect(callsStage("bench", totalOf(100, 1000), 1000, 100).ok).toBe(true);
    expect(callsStage("bench", totalOf(100, 1100), 1000, 100).ok).toBe(true);
  });
  it("fails at +11 % with the same input count", () => {
    const r = callsStage("bench", totalOf(100, 1110), 1000, 100);
    expect(r.ok).toBe(false);
    expect(r.line).toContain("1110");
    expect(r.line).toContain("baseline 1000 over 100");
  });
  it("10 more inputs at the baseline average pass", () => {
    expect(callsStage("home", inputs(110, 10), 1000, 100).ok).toBe(true);
  });
  it("10 more inputs with 11 % more calls per input fail", () => {
    expect(callsStage("home", inputs(110, 11.1), 1000, 100).ok).toBe(false);
  });
  it("names the five largest", () => {
    const m = new Map(Array.from({ length: 7 }, (_, i) => [`i${i}`, i + 1] as [string, number]));
    expect(callsStage("home", m, 1000, 7).line).toContain("i6 7");
    expect(callsStage("home", m, 1000, 7).line).not.toContain("i0 1");
  });
});
