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
import { CalcCancelled, type Calc, type CalcSettings, type CasOutcome, type HomeOutcome } from "./port.ts";

export class EngineCalc implements Calc {
  private readonly engine: MathEngine;
  constructor(engine: MathEngine = new WorkerEngine()) {
    this.engine = engine;
  }

  async ready(): Promise<void> {
    await this.engine.ready();
  }

  async home(giac: string, s: CalcSettings): Promise<HomeOutcome> {
    try {
      const r = await this.engine.home(giac, { ...defaultHomeSettings, digits: s.digits, angle: s.angle });
      return { ok: r.ok, display: r.display, approximate: r.approximate, ...(r.value ? { value: r.value } : {}), ...(r.error ? { error: r.error } : {}) };
    } catch (e) {
      throw e instanceof EngineCancelled ? new CalcCancelled() : e;
    }
  }

  async cas(giac: string, s: CalcSettings): Promise<CasOutcome> {
    try {
      const r = await this.engine.cas(giac, { ...defaultCasSettings, digits: s.digits, angle: s.angle });
      return { ok: r.ok, text: r.text, latex: r.latex, ...(r.error ? { error: r.error } : {}) };
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
