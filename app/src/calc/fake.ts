// SPDX-License-Identifier: GPL-3.0-or-later
// A stand-in engine for UI work and tests (dev server only: ?engine=fake[&delay=ms]). It echoes the
// Giac input as the result, so tests can see exactly what the entry line produced.
import { CalcCancelled, type Calc, type CasOutcome, type HomeOutcome } from "./port.ts";

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
  cancel(): Promise<void> {
    this.reject?.(new CalcCancelled());
    this.reject = undefined;
    return Promise.resolve();
  }
}
