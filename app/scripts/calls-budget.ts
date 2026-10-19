// SPDX-License-Identifier: GPL-3.0-or-later
// G52: the Giac calls per Enter budget. A run fails when a set's calls per input are more than 10 % above tests/golden/calls-baseline.yaml.
export const CALLS_TOLERANCE = 0.1;

export interface CallsBaseline {
  commit: string;
  bench: number;
  benchInputs: number;
  home: number;
  homeInputs: number;
}

/** Totals for one set of inputs: the sum, and the largest per-input counts. */
export function topCalls(counts: Map<string, number>, n = 5): { total: number; top: [string, number][] } {
  let total = 0;
  for (const c of counts.values()) total += c;
  return { total, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, n) };
}

/** Whether calls per input are within the budget: at most 10 % above the baseline's calls per input. */
export function withinBudget(total: number, inputs: number, baseline: number, baselineInputs: number): boolean {
  return total * baselineInputs <= baseline * inputs * (1 + CALLS_TOLERANCE);
}

/** The stage's verdict and its printed line for one set (bench or home). */
export function callsStage(set: string, counts: Map<string, number>, baseline: number, baselineInputs: number): { ok: boolean; line: string } {
  const { total, top } = topCalls(counts);
  const inputs = counts.size;
  const ok = withinBudget(total, inputs, baseline, baselineInputs);
  const per = (t: number, n: number): string => (t / n).toFixed(2);
  const big = top.map(([id, n]) => `${id} ${n}`).join(", ");
  return {
    ok,
    line: `${set} ${total} Giac calls over ${inputs} inputs = ${per(total, inputs)} per input (baseline ${baseline} over ${baselineInputs} = ${per(baseline, baselineInputs)}, limit ${((baseline / baselineInputs) * (1 + CALLS_TOLERANCE)).toFixed(2)}); largest: ${big}${ok ? "" : ". Raise tests/golden/calls-baseline.yaml only with the reason in the report"}`,
  };
}
