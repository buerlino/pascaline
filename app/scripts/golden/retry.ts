// SPDX-License-Identifier: GPL-3.0-or-later
// A time-only miss runs once more (owner, 2026-10-22; decisions.md "g58 timing"): a case whose only problem is
// `took … ms > budgetMs` is run again on the same engine; it fails only if the rerun misses too. The budgets stay.

/** The problem text a missed `budgetMs` gives (stage precision). */
export const tookProblem = (ms: number, budgetMs: number): string => `took ${ms.toFixed(0)} ms > budgetMs ${budgetMs}`;

/** True when there are problems and every one is a missed time budget. */
export const timeOnlyMiss = (problems: readonly string[]): boolean => problems.length > 0 && problems.every((p) => /^took \d+ ms > budgetMs /.test(p));

/** Runs `attempt`; when its only problem is a missed time budget, prints `  retried <id>` and runs it once more, whose result stands. */
export async function retryTimeMiss<T extends { problems: string[] }>(id: string, attempt: () => Promise<T>, log: (line: string) => void = console.log): Promise<T> {
  const first = await attempt();
  if (!timeOnlyMiss(first.problems)) return first;
  log(`  retried ${id}`);
  return attempt();
}
