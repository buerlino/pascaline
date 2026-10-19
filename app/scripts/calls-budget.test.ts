// SPDX-License-Identifier: GPL-3.0-or-later
// G52: a total 11 % over its baseline fails the stage; 10 % over still passes.
import { describe, expect, it } from "vitest";
import { callsStage } from "./calls-budget.ts";

const counts = (n: number) => new Map([["a", n]]);

describe("calls budget", () => {
  it("passes at the baseline and at +10 %", () => {
    expect(callsStage("bench", counts(100), 100).ok).toBe(true);
    expect(callsStage("bench", counts(110), 100).ok).toBe(true);
  });
  it("fails at +11 %", () => {
    const r = callsStage("bench", counts(111), 100);
    expect(r.ok).toBe(false);
    expect(r.line).toContain("111");
    expect(r.line).toContain("baseline 100");
  });
  it("names the five largest", () => {
    const m = new Map(Array.from({ length: 7 }, (_, i) => [`i${i}`, i + 1] as [string, number]));
    expect(callsStage("home", m, 1000).line).toContain("i6 7");
    expect(callsStage("home", m, 1000).line).not.toContain("i0 1");
  });
});
