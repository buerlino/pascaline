// SPDX-License-Identifier: GPL-3.0-or-later
// The Calc port on top of gorge's MathEngine (app/src/engine). The only place the views meet it.
import { defaultHomeSettings } from "../engine/homeEval.ts";
import {
  defaultCasSettings,
  EngineCancelled,
  type AnalysisRequest,
  type AnalysisResult,
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
      return { ok: r.ok, display: r.display, approximate: r.approximate, exactRational: r.exactRational, reliableDigits: r.reliableDigits, full: r.full, ...(r.defined ? { defined: r.defined } : {}), ...(r.items ? { items: r.items } : {}), ...(r.shape ? { shape: r.shape } : {}), ...(r.warn ? { warn: r.warn } : {}), ...(r.digits !== undefined ? { digits: r.digits } : {}), ...(r.value ? { value: r.value } : {}), ...(r.exact && /^-?\d{1,200}(\/\d{1,200})?$/.test(r.exact) ? { exact: r.exact } : {}), ...(r.error ? { error: r.error } : {}), ...(r.latex !== undefined ? { latex: r.latex } : {}) };
    } catch (e) {
      throw e instanceof EngineCancelled ? new CalcCancelled() : e;
    }
  }

  async cas(giac: string, s: CalcSettings): Promise<CasOutcome> {
    try {
      const r = await this.engine.cas(giac, { ...defaultCasSettings, digits: s.digits, angle: s.angle });
      return { ok: r.ok, text: r.text, latex: r.latex, ...(r.full !== undefined ? { full: r.full } : {}), ...(r.numeric ? { numeric: r.numeric } : {}), ...(r.approximate ? { approximate: true } : {}), ...(r.warn ? { warn: r.warn } : {}), ...(r.uses ? { uses: r.uses } : {}), ...(r.error ? { error: r.error } : {}) };
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
