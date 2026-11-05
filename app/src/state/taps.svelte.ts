// SPDX-License-Identifier: GPL-3.0-or-later
// The Shift and Alpha tap counter (R9; P11, P7 point 4): how often the one-shot taps are still used once flicks
// exist, for the owner's merge decision after a week. Counted on the device only, in IndexedDB; never sent anywhere.
// Flicks (and lock flicks) are not Shift or Alpha taps and are not counted there. Since R70 every press is counted too
// (`presses`, docs/04 section 5.2: key taps, flicks, screen taps; src/state/pressCount.ts), the measure of the task benchmark.
// Since R127 a press also says which one it was: `keys` maps "<key id>:<layer>" (layer: primary, shift, alpha for a tap in
// that layer; up, down for a flick; hw for a hardware key that ran the keypad key, Enter and Esc included), "trackpad:drag",
// "hw:<kind>" (a hardware key that is no keypad key: letter, symbol, dead, other), or "screen:<kind>"
// (a tap outside the keypad: row, button, or a row's own kind such as units-const) to its count; the total is the
// sum. A stored record without `keys` loads with an empty map. The export (state/countsFile.ts: Settings › Counters ›
// Export the counts, and R128's sync folder as counters.json) is one JSON object, `{ "format": "pascaline-counts/1",
// "since", "presses", "keys" }`, with the keys sorted by count, largest first, ties by name: counts only, no times, no content.
import type { Kv } from "./storage.ts";

export interface TapCounts {
  shift: number;
  alpha: number;
  /** Every press (R70). */
  presses: number;
  /** Presets applied (R88): the removal test of decisions.md "Settings in the Mode sheet, and presets". */
  presets: number;
  /** Presses per key and layer, or per kind of screen tap (R127). */
  keys: Record<string, number>;
  /** When counting started (ISO date, the first tap or the last reset). */
  since: string;
}

export const TAPS_KEY = "taps";
/** Writes wait this long, so a burst of taps is one IndexedDB write. */
const SAVE_MS = 1000;

const COUNTS = ["shift", "alpha", "presses", "presets"] as const;
const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export class TapCounter {
  counts = $state<TapCounts>({ shift: 0, alpha: 0, presses: 0, presets: 0, keys: {}, since: "" });
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
      const c = { ...this.counts, since: o["since"] || this.counts.since };
      for (const k of COUNTS) if (isCount(o[k])) c[k] += o[k]; // (presses absent before R70, presets before R88)
      const keys = { ...c.keys };
      for (const [k, n] of Object.entries(typeof o["keys"] === "object" && o["keys"] !== null ? o["keys"] : {})) if (isCount(n)) keys[k] = (keys[k] ?? 0) + n;
      c.keys = keys;
      this.counts = c;
    });
  }

  /** One Shift or Alpha tap, or one preset applied (R88). */
  tap(key: "shift" | "alpha" | "presets"): void {
    const c = this.counts;
    this.counts = { ...c, [key]: c[key] + 1, since: c.since || this.today() };
    this.schedule();
  }

  /** One press of any kind (docs/04 5.2); `key`: which one (R127), counted in `keys` too. */
  press(key?: string): void {
    const c = this.counts;
    const keys = key === undefined ? c.keys : { ...c.keys, [key]: (c.keys[key] ?? 0) + 1 };
    this.counts = { ...c, presses: c.presses + 1, keys, since: c.since || this.today() };
    this.schedule();
  }

  reset(): void {
    this.wasReset = true;
    this.counts = { shift: 0, alpha: 0, presses: 0, presets: 0, keys: {}, since: this.today() };
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
