// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { retryTimeMiss, timeOnlyMiss, tookProblem } from "./retry.ts";

/** A stub case: slow on the first `slowRuns` runs. */
const stub = (slowRuns: number) => {
  let n = 0;
  return async () => ({ problems: n++ < slowRuns ? [tookProblem(2500, 2000)] : [] });
};

describe("a time-only miss runs once more", () => {
  it("slow on the first run only: passes with one retried line", async () => {
    const lines: string[] = [];
    const r = await retryTimeMiss("g58-x", stub(1), (l) => lines.push(l));
    expect(r.problems).toEqual([]);
    expect(lines).toEqual(["  retried g58-x"]);
  });
  it("slow twice: fails, and says it retried", async () => {
    const lines: string[] = [];
    const r = await retryTimeMiss("g58-x", stub(2), (l) => lines.push(l));
    expect(r.problems).toHaveLength(1);
    expect(lines).toEqual(["  retried g58-x"]);
  });
  it("fast: no retry; a wrong answer is not retried even when slow too", async () => {
    const lines: string[] = [];
    expect((await retryTimeMiss("a", stub(0), (l) => lines.push(l))).problems).toEqual([]);
    let runs = 0;
    const wrong = async () => (runs++, { problems: ["got 1, expect 2", tookProblem(3000, 2000)] });
    expect((await retryTimeMiss("b", wrong, (l) => lines.push(l))).problems).toHaveLength(2);
    expect(runs).toBe(1);
    expect(lines).toEqual([]);
  });
  it("timeOnlyMiss", () => {
    expect(timeOnlyMiss([])).toBe(false);
    expect(timeOnlyMiss([tookProblem(1, 0)])).toBe(true);
    expect(timeOnlyMiss([tookProblem(1, 0), "x"])).toBe(false);
  });
});
