// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { Kv } from "./storage.ts";
import { TAPS_KEY, TapCounter } from "./taps.svelte.ts";

function memoryKv(init: [string, unknown][] = []): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(init);
  return {
    data,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k: string, v: unknown) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}
const day = (iso: string) => () => new Date(`${iso}T12:00:00Z`);

describe("Shift/Alpha tap counter (R9, P7 point 4)", () => {
  it("counts taps per key, from the day of the first tap, and stores them", async () => {
    const kv = memoryKv();
    const c = new TapCounter(kv, day("2026-10-13"));
    await c.ready;
    c.tap("shift");
    c.tap("shift");
    c.tap("alpha");
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 2, alpha: 1, presses: 0, presets: 0, since: "2026-10-13" });
  });
  it("continues from the stored counts after a relaunch, and adds taps made before they loaded", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-13"));
    c.tap("alpha"); // before the store answered
    await c.ready;
    expect(c.counts).toEqual({ shift: 5, alpha: 8, presses: 0, presets: 0, since: "2026-10-10" });
  });
  it("reset starts again from zero today, also before the stored counts arrived", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-14"));
    c.reset();
    await c.ready;
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 0, alpha: 0, presses: 0, presets: 0, since: "2026-10-14" });
  });
  it("ignores a stored value that is not a count", async () => {
    const c = new TapCounter(memoryKv([[TAPS_KEY, { shift: -1, alpha: "x", since: 3 }]]));
    await c.ready;
    expect([c.counts.shift, c.counts.alpha]).toEqual([0, 0]);
  });
});

describe("the press counter (R70; docs/04 5.2)", () => {
  it("press() counts every press and leaves the Shift and Alpha counts as they are", async () => {
    const kv = memoryKv();
    const c = new TapCounter(kv, day("2026-10-30"));
    await c.ready;
    c.press();
    c.press();
    c.tap("shift"); // a Shift tap is also a press: the caller counts both
    c.press();
    expect(c.counts).toEqual({ shift: 1, alpha: 0, presses: 3, presets: 0, since: "2026-10-30" });
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 1, alpha: 0, presses: 3, presets: 0, since: "2026-10-30" });
  });
  it("continues from stored counts (also those stored before presses existed), and reset zeroes it", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-30"));
    c.press(); // before the store answered
    await c.ready;
    expect(c.counts).toEqual({ shift: 5, alpha: 7, presses: 1, presets: 0, since: "2026-10-10" });
    c.reset();
    expect(c.counts).toEqual({ shift: 0, alpha: 0, presses: 0, presets: 0, since: "2026-10-30" });
  });
});
