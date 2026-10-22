// SPDX-License-Identifier: GPL-3.0-or-later
// The Calc port on top of gorge's MathEngine (app/src/engine). The only place the views meet it.
import { defaultHomeSettings } from "../engine/homeEval.ts";
import {
  defaultCasSettings,
  EngineCancelled,
  type AnalysisRequest,
  type AnalysisResult,
  type CasResult,
  type HomeResult,
  type HomeSettings,
  type MathEngine,
  type SolveOutcome,
  type SolveRequest,
  type TableRequest,
} from "../engine/types.ts";
import { WorkerEngine } from "../engine/workerEngine.ts";
import { userNamesOf } from "../engine/defs.ts";
import { mark } from "../marks.ts";
import { CalcCancelled, type Calc, type CalcSettings, type ChipFactsTable, type CasOutcome, type HomeOutcome, type Quantity, type UnitError, type UnitRequest, type UserName } from "./port.ts";
import type { IndexItem } from "../find/types.ts";

/**
 * What the port does with each key of an engine result (G76): "pass" gives it to the view as it is (`facts` whole, so
 * every fact the engine adds reaches the views); any other text is the reason it is not given. A key added to
 * HomeResult or CasResult fails to compile here until it is listed.
 */
export type PortKeys<T> = { readonly [K in keyof Required<T>]: "pass" | (string & {}) };

export const HOME_KEYS = {
  ok: "pass",
  display: "pass",
  value: "pass",
  facts: "pass",
  approximate: "pass",
  error: "pass",
  full: "pass",
  defined: "pass",
  items: "pass",
  shape: "pass",
  digits: "pass",
  latex: "pass",
  settingReset: "pass",
  exact: "given only when `rational` says it is a plain integer or p/q: the Format key's fraction modes read it",
  rational: "read for `exact`",
  path: "the engine's route, for its tests and probes; no view reads it",
  tieRisk: "unused: no view reads it (docs/04 2.4 item 4)",
  exactMs: "a timing (measurement builds read the engine's own)",
  totalMs: "a timing (measurement builds read the engine's own)",
} as const satisfies PortKeys<HomeResult>;

export const CAS_KEYS = {
  ok: "pass",
  text: "pass",
  full: "pass",
  latex: "pass",
  error: "pass",
  uses: "pass",
  numeric: "pass",
  approximate: "pass",
  facts: "pass",
  settingReset: "pass",
  timedOut: "`error` is \"timeout\" then",
  engineMs: "a timing (measurement builds read the engine's own)",
} as const satisfies PortKeys<CasResult>;

/** The keys of T that `M` passes. */
export type Passed<T, M extends PortKeys<T>> = { [K in keyof M]: M[K] extends "pass" ? K : never }[keyof M] & keyof T;

/** The keys of `r` that `keys` passes, each as it is (absent ones stay absent). */
function passed<T extends object, M extends PortKeys<T>>(r: T, keys: M): Pick<T, Passed<T, M>> {
  const out: Partial<T> = {};
  for (const k of Object.keys(keys) as (keyof T & keyof M)[]) if (keys[k] === "pass" && r[k] !== undefined) out[k] = r[k];
  return out as Pick<T, Passed<T, M>>;
}

/** True when A and B are the same set of keys (both ways, so neither a passed key nor an outcome key goes unmapped). */
type SameKeys<A extends PropertyKey, B extends PropertyKey> = [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type Check<T extends true> = T;
/** Every passed key is an outcome key and every outcome key is passed (or, for `exact`, given by the port itself). */
export type PortChecks = [
  Check<SameKeys<Passed<HomeResult, typeof HOME_KEYS> | "exact", keyof HomeOutcome>>,
  Check<SameKeys<Passed<CasResult, typeof CAS_KEYS>, keyof CasOutcome>>,
];

export interface EngineCalcOptions {
  /** The Find index's items, for the unit view's factor table (docs/04 4.2); read on the first units() call. */
  findIndex?: () => Promise<readonly IndexItem[]>;
}

export class EngineCalc implements Calc {
  private readonly engine: MathEngine;
  private readonly findIndex: (() => Promise<readonly IndexItem[]>) | undefined;
  constructor(engine: MathEngine = new WorkerEngine(), o: EngineCalcOptions = {}) {
    this.engine = engine;
    this.findIndex = o.findIndex;
  }

  async ready(): Promise<{ safeStart?: { skipped: number } }> {
    const t = await this.engine.ready();
    // measurement builds only (marks.ts): what tools/device_run.py reads as instantiateMs, initMs and replayMs
    mark("engine-timings", { instantiateMs: t.instantiateMs, initMs: t.initMs, replayMs: t.replayMs, readyMs: t.readyMs });
    return t.safeStart ? { safeStart: t.safeStart } : {};
  }

  async home(giac: string, s: CalcSettings, chips?: ChipFactsTable): Promise<HomeOutcome> {
    try {
      const settings = { ...defaultHomeSettings, digits: s.digits, angle: s.angle };
      const r = await (chips && Object.keys(chips).length ? this.engine.home(giac, settings, undefined, chips) : this.engine.home(giac, settings));
      return { ...passed(r, HOME_KEYS), ...(r.rational && r.exact !== undefined ? { exact: r.exact } : {}) };
    } catch (e) {
      throw e instanceof EngineCancelled ? new CalcCancelled() : e;
    }
  }

  async cas(giac: string, s: CalcSettings): Promise<CasOutcome> {
    try {
      const r = await this.engine.cas(giac, { ...defaultCasSettings, digits: s.digits, angle: s.angle });
      return passed(r, CAS_KEYS);
    } catch (e) {
      throw e instanceof EngineCancelled ? new CalcCancelled() : e;
    }
  }

  solve(req: SolveRequest, s: CalcSettings): Promise<SolveOutcome> {
    return mapCancel(this.engine.solve(req, homeSettings(s)));
  }

  unknowns(equations: string[]): Promise<string[]> {
    return mapCancel(this.engine.unknowns(equations));
  }

  analyze(req: AnalysisRequest, s: CalcSettings): Promise<AnalysisResult> {
    return mapCancel(this.engine.analyze(req, homeSettings(s)));
  }

  table(req: TableRequest, s: CalcSettings): Promise<HomeResult[][]> {
    return mapCancel(this.engine.table(req, homeSettings(s)));
  }

  units(req: UnitRequest, s: CalcSettings): Promise<Quantity | UnitError> {
    // The builder and the factor table load with the unit view, never in the start chunk (docs/04 4.4).
    return mapCancel(import("../units/calc.ts").then((m) => m.evaluateUnits(this.engine, this.findIndex, req, homeSettings(s))));
  }

  async names(): Promise<UserName[]> {
    return userNamesOf(await this.engine.definitions());
  }

  async cancel(): Promise<void> {
    await this.engine.cancel();
  }
}

function homeSettings(s: CalcSettings): HomeSettings {
  return { ...defaultHomeSettings, digits: s.digits, angle: s.angle };
}

async function mapCancel<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw e instanceof EngineCancelled ? new CalcCancelled() : e;
  }
}
