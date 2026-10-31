// SPDX-License-Identifier: GPL-3.0-or-later
// The Shift and Alpha tap counter (R9; P11, P7 point 4): how often the one-shot taps are still used once flicks
// exist, for the owner's merge decision after a week. Counted on the device only, in IndexedDB; never sent anywhere.
// Flicks (and lock flicks) are not Shift or Alpha taps and are not counted there. Since R70 every press is counted too
// (`presses`, docs/04 section 5.2: key taps, flicks, screen taps; src/state/pressCount.ts), the measure of the task benchmark.
import type { Kv } from "./storage.ts";

export interface TapCounts {
  shift: number;
  alpha: number;
  /** Every press (R70). */
  presses: number;
  /** When counting started (ISO date, the first tap or the last reset). */
  since: string;
}

export const TAPS_KEY = "taps";
/** Writes wait this long, so a burst of taps is one IndexedDB write. */
const SAVE_MS = 1000;

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export class TapCounter {
  counts = $state<TapCounts>({ shift: 0, alpha: 0, presses: 0, since: "" });
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** A reset before the stored counts arrived: they are dropped. */
  private wasReset = false;
  private readonly kv: Kv;
  private readonly now: () => Date;
  /** Loaded from the store; taps made before it arrive are added to what is stored. */
  readonly ready: Promise<void>;

  constructor(kv: Kv, now: () => Date = () => new Date()) {
    this.kv = kv;
    this.now = now;
    this.ready = kv.get<unknown>(TAPS_KEY).then((v) => {
      if (this.wasReset || typeof v !== "object" || v === null) return;
      const o = v as Record<string, unknown>;
      if (!isCount(o["shift"]) || !isCount(o["alpha"]) || typeof o["since"] !== "string") return;
      this.counts = {
        shift: o["shift"] + this.counts.shift,
        alpha: o["alpha"] + this.counts.alpha,
        presses: (isCount(o["presses"]) ? o["presses"] : 0) + this.counts.presses, // (absent before R70)
        since: o["since"] || this.counts.since,
      };
    });
  }

  tap(key: "shift" | "alpha"): void {
    const c = this.counts;
    this.counts = { ...c, [key]: c[key] + 1, since: c.since || this.today() };
    this.schedule();
  }

  /** One press of any kind (docs/04 5.2). */
  press(): void {
    const c = this.counts;
    this.counts = { ...c, presses: c.presses + 1, since: c.since || this.today() };
    this.schedule();
  }

  reset(): void {
    this.wasReset = true;
    this.counts = { shift: 0, alpha: 0, presses: 0, since: this.today() };
    this.schedule();
  }

  /** Write now (tests; the app writes after SAVE_MS). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.ready;
    await this.kv.set(TAPS_KEY, $state.snapshot(this.counts));
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_MS);
  }
}
