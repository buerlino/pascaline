// SPDX-License-Identifier: GPL-3.0-or-later
// The Calc port on top of gorge's MathEngine (app/src/engine). The only place the views meet it.
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { defaultCasSettings, EngineCancelled, type MathEngine } from "../engine/types.ts";
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
      return { ok: r.ok, display: r.display, approximate: r.approximate, ...(r.error ? { error: r.error } : {}) };
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

  async cancel(): Promise<void> {
    await this.engine.cancel();
  }
}
