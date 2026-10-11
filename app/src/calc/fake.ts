// SPDX-License-Identifier: GPL-3.0-or-later
// A stand-in engine for UI work and tests (dev server only: ?engine=fake[&delay=ms]). It echoes the
// Giac input as the result, so tests can see exactly what the entry line produced.
import {
  CalcCancelled,
  type AnalysisResult,
  type Calc,
  type CasOutcome,
  type HomeOutcome,
  type HomeResult,
  type SolveOutcome,
  type SolveRequest,
  type TableRequest,
} from "./port.ts";

/** An echo cell: the Giac text that would be evaluated. */
function echo(display: string): HomeResult {
  return { ok: true, display, path: "exact", approximate: false, tieRisk: false, exactMs: 0, totalMs: 0 };
}

export class FakeCalc implements Calc {
  private readonly delayMs: number;
  private reject: ((e: Error) => void) | undefined;
  constructor(delayMs = 0) {
    this.delayMs = delayMs;
  }
  ready(): Promise<void> {
    return Promise.resolve();
  }
  private run<T>(v: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.reject = reject;
      setTimeout(() => {
        this.reject = undefined;
        resolve(v);
      }, this.delayMs);
    });
  }
  home(giac: string): Promise<HomeOutcome> {
    return this.run({ ok: true, display: giac, approximate: false });
  }
  cas(giac: string): Promise<CasOutcome> {
    return this.run({ ok: true, text: giac, latex: giac });
  }
  /** Echoes each guess back as the "root", so UI tests see what was sent. */
  solve(req: SolveRequest): Promise<SolveOutcome> {
    const roots =
      req.kind === "poly"
        ? [{ result: echo(req.equation) }]
        : req.unknowns.map((name, i) => ({ name, result: echo(req.guesses[i] ?? "") }));
    return this.run({ ok: true, roots, method: "none", info: "fake engine", warn: false, ms: 0 });
  }
  unknowns(equations: string[]): Promise<string[]> {
    const names = equations.join(" ").match(/\b[A-Za-z]\b/g) ?? [];
    return this.run([...new Set(names)].filter((n) => n !== "e" && n !== "i"));
  }
  analyze(): Promise<AnalysisResult> {
    return this.run({ ok: false, warn: false, info: "fake engine", method: "none", error: "engine", ms: 0 });
  }
  table(req: TableRequest): Promise<HomeResult[][]> {
    return this.run(req.xs.map((x) => req.fns.map((f) => echo(`${f}|${req.variable ?? "x"}=${x}`))));
  }
  cancel(): Promise<void> {
    this.reject?.(new CalcCancelled());
    this.reject = undefined;
    return Promise.resolve();
  }
}
