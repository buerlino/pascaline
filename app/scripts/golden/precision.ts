// SPDX-License-Identifier: GPL-3.0-or-later
// stage precision
import { runPrecisionCase, markText } from "../../src/goldenRun.ts";
import { retryTimeMiss, tookProblem } from "./retry.ts";
import { cases, freshHost, report, expectAt, lostAnswer } from "./lib.ts";

export async function stagePrecision(): Promise<void> {
  const cs = cases("precision.yaml");
  let shared = await freshHost();
  let active = 0;
  let activePass = 0;
  const pending: string[] = [];
  const nowPassing: string[] = [];
  let marksChecked = 0;
  for (const c of cs) {
    const attempt = async (): Promise<{ problems: string[] }> => {
      const t0 = performance.now();
      let run: Awaited<ReturnType<typeof runPrecisionCase>>;
      try {
        run = await runPrecisionCase(c, shared, freshHost);
      } catch (e) {
        // G113: a case that stops the engine (stock Giac's binomial(5,0.5R,3/2) overflows the stack) fails here, and
        // the next case gets a fresh engine: before, the throw ended the whole gate without GOLDEN GATE FAILED.
        shared = await freshHost();
        return { problems: [`the engine stopped: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`] };
      }
      const ms = performance.now() - t0;
      const { shown, mark, input, digits, problems } = run;
      // G58: `budgetMs`, the wall time of the case (its Enter): it answers or is refused within it.
      if (c.budgetMs !== undefined && ms > c.budgetMs) problems.push(tookProblem(ms, c.budgetMs));
      if (c.expect !== undefined) {
        // ⚠ n: the result shows only its n confirmed digits; those must be the oracle's.
        const want = mark?.mark === "⚠" && mark.n !== undefined && mark.n < digits ? expectAt(String(c.expect), Math.max(1, mark.n)) : String(c.expect);
        if (want === null) problems.push(`expect ${String(c.expect)} cannot be rounded to ${mark?.n} digits safely: give more digits`);
        else if (shown !== want) problems.push(`got ${shown}, expect ${want}${want !== c.expect ? ` (${c.expect} at ${mark?.n} digits)` : ""}`);
      }
      // A mark-only case still needs an answer: the input echoed back (BesselJ(1,2) at 30 digits) is a lost result.
      // G58: a time-only case (budgetMs, no expect and no mark) may also be refused.
      const timeOnly = c.budgetMs !== undefined && c.mark === undefined;
      if (c.expect === undefined && !(timeOnly && shown.startsWith("error: ")) && lostAnswer(shown, input)) problems.push(`answer is not a number: ${shown}`);
      if (c.mark) {
        if (!mark || mark.mark !== c.mark) problems.push(`mark ${markText(mark) ?? "none"}, expect ${c.mark}`);
      }
      return { problems };
    };
    // a time-only miss runs once more on the same engine (decisions.md "g58 timing"); the rerun stands
    const { problems } = await retryTimeMiss(c.id, attempt);
    if (c.mark) marksChecked++;
    if (c.status === "pending") {
      if (problems.length === 0) nowPassing.push(c.id);
      else pending.push(c.id);
      console.log(`  precision ${c.id}: pending${problems.length ? ` (${problems.join("; ")})` : ""}`);
    } else {
      active++;
      if (problems.length === 0) activePass++;
      else console.log(`  precision ${c.id}: ${problems.join("; ")}`);
    }
  }
  const pendingNote = `${pending.length} pending${nowPassing.length ? `, ${nowPassing.length} NOW PASSING (remove status: ${nowPassing.join(", ")})` : ""}`;
  report(
    "precision",
    activePass === active,
    `${activePass}/${active} active match; ${pendingNote}; ${marksChecked} marks checked`,
  );
}
