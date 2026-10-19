// SPDX-License-Identifier: GPL-3.0-or-later
// G52: the Giac calls per Enter budget. A run fails when a total is more than 10 % above tests/golden/calls-baseline.yaml.
export const CALLS_TOLERANCE = 0.1;

export interface CallsBaseline {
  commit: string;
  bench: number;
  home: number;
}

/** Totals for one set of inputs: the sum, and the largest per-input counts. */
export function topCalls(counts: Map<string, number>, n = 5): { total: number; top: [string, number][] } {
  let total = 0;
  for (const c of counts.values()) total += c;
  return { total, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, n) };
}

/** Whether `total` is within the budget: at most 10 % above the baseline. */
export function withinBudget(total: number, baseline: number): boolean {
  return total <= baseline * (1 + CALLS_TOLERANCE);
}

/** The stage's verdict and its printed line for one set (bench or home). */
export function callsStage(set: string, counts: Map<string, number>, baseline: number): { ok: boolean; line: string } {
  const { total, top } = topCalls(counts);
  const ok = withinBudget(total, baseline);
  const big = top.map(([id, n]) => `${id} ${n}`).join(", ");
  return {
    ok,
    line: `${set} ${total} Giac calls over ${counts.size} inputs (baseline ${baseline}, limit ${Math.floor(baseline * (1 + CALLS_TOLERANCE))}); largest: ${big}${ok ? "" : ". Raise tests/golden/calls-baseline.yaml only with the reason in the report"}`,
  };
}
