// SPDX-License-Identifier: GPL-3.0-or-later
// Home's defaults (R103): what the app's start reads of engine/homeEval.ts, without its imports, so the start chunk
// does not hold homeEval's graph (engine/angles.ts, the numeric checks) for the lazy chunks. homeEval re-exports them.
import type { HomeResult, HomeSettings } from "./homeEval.ts";

/** G82: Home's step budget, the count of Giac's checks that equals today's 300 ms on the desktop (with a margin;
 *  tools/probes/step-budget.ts prints how it was found). */
export const HOME_BUDGET_STEPS = 518_000;

export const defaultHomeSettings: HomeSettings = {
  digits: 12,
  angle: "rad",
  budgetSteps: HOME_BUDGET_STEPS,
  maxExactDigits: 20,
  workDigits: 30,
  guardMode: "round-exact",
  powLimit: 1e5,
};

/** Placeholder precision facts until the engine fills them (docs/04 section 8.2): no claim of exactness, `full` = the display. */
export function safePrecision(display: string): Pick<HomeResult, "facts" | "full"> {
  return { facts: { exact: false, reliableDigits: null }, full: display };
}
