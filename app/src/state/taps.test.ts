// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { Kv } from "./storage.ts";
import { COUNTS_FORMAT, TAPS_KEY, TapCounter } from "./taps.svelte.ts";

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
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 2, alpha: 1, presses: 0, presets: 0, keys: {}, since: "2026-10-13" });
  });
  it("continues from the stored counts after a relaunch, and adds taps made before they loaded", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-13"));
    c.tap("alpha"); // before the store answered
    await c.ready;
    expect(c.counts).toEqual({ shift: 5, alpha: 8, presses: 0, presets: 0, keys: {}, since: "2026-10-10" });
  });
  it("reset starts again from zero today, also before the stored counts arrived", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-14"));
    c.reset();
    await c.ready;
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 0, alpha: 0, presses: 0, presets: 0, keys: {}, since: "2026-10-14" });
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
    expect(c.counts).toEqual({ shift: 1, alpha: 0, presses: 3, presets: 0, keys: {}, since: "2026-10-30" });
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 1, alpha: 0, presses: 3, presets: 0, keys: {}, since: "2026-10-30" });
  });
  it("continues from stored counts (also those stored before presses existed), and reset zeroes it", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 5, alpha: 7, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-10-30"));
    c.press(); // before the store answered
    await c.ready;
    expect(c.counts).toEqual({ shift: 5, alpha: 7, presses: 1, presets: 0, keys: {}, since: "2026-10-10" });
    c.reset();
    expect(c.counts).toEqual({ shift: 0, alpha: 0, presses: 0, presets: 0, keys: {}, since: "2026-10-30" });
  });
});

describe("the press counter per key and layer (R127)", () => {
  it("press(key) adds one to that key and to the total; press() adds to the total only", async () => {
    const c = new TapCounter(memoryKv(), day("2026-11-05"));
    await c.ready;
    c.press("d7:primary"); // a key tap
    c.press("sin:shift"); // a tap in the Shift layer
    c.press("sin:up"); // a flick up
    c.press("sin:down"); // a flick down
    c.press("sin:alpha");
    c.press("d7:primary");
    c.press("screen:row"); // a tap on the screen
    c.press("screen:units-const"); // R92: a pick from the Constants rows
    c.press("screen:units-tools"); // R92: a pick from the Tools rows
    c.press("add:hw"); // R131: a hardware key that runs a keypad key
    c.press();
    expect(c.counts.keys).toEqual({
      "d7:primary": 2, "sin:shift": 1, "sin:up": 1, "sin:down": 1, "sin:alpha": 1,
      "screen:row": 1, "screen:units-const": 1, "screen:units-tools": 1, "add:hw": 1,
    });
    expect(c.counts.presses).toBe(11);
  });
  it("the total equals the sum of the keys when every press names its key", async () => {
    const c = new TapCounter(memoryKv(), day("2026-11-05"));
    await c.ready;
    for (const k of ["a:primary", "b:up", "a:primary", "screen:button"]) c.press(k);
    expect(Object.values(c.counts.keys).reduce((a, b) => a + b, 0)).toBe(c.counts.presses);
  });
  it("is stored with the batching, and a stored record without keys loads with an empty map", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 1, alpha: 2, presses: 9, since: "2026-10-10" }]]);
    const c = new TapCounter(kv, day("2026-11-05"));
    await c.ready;
    expect(c.counts.keys).toEqual({});
    c.press("d1:primary");
    await c.flush();
    expect(kv.data.get(TAPS_KEY)).toEqual({ shift: 1, alpha: 2, presses: 10, presets: 0, keys: { "d1:primary": 1 }, since: "2026-10-10" });
  });
  it("adds the stored keys to the ones counted before they arrived, and drops a bad entry", async () => {
    const kv = memoryKv([[TAPS_KEY, { shift: 0, alpha: 0, since: "2026-10-10", keys: { "d1:primary": 4, "x:up": -1, "y:up": "z" } }]]);
    const c = new TapCounter(kv, day("2026-11-05"));
    c.press("d1:primary"); // before the store answered
    await c.ready;
    expect(c.counts.keys).toEqual({ "d1:primary": 5 });
  });
  it("reset clears the map", async () => {
    const c = new TapCounter(memoryKv(), day("2026-11-05"));
    await c.ready;
    c.press("d1:primary");
    c.reset();
    expect(c.counts.keys).toEqual({});
  });
  it("exports { format, since, presses, keys } with the keys sorted by count (ties by name)", async () => {
    const c = new TapCounter(memoryKv(), day("2026-11-05"));
    await c.ready;
    for (const k of ["b:primary", "a:primary", "c:up", "c:up", "d:shift", "d:shift", "d:shift"]) c.press(k);
    const text = c.exportText();
    expect(text.endsWith("\n")).toBe(true);
    const o = JSON.parse(text) as { format: string; since: string; presses: number; keys: Record<string, number> };
    expect(o.format).toBe(COUNTS_FORMAT);
    expect(COUNTS_FORMAT).toBe("pascaline-counts/1");
    expect(Object.keys(o)).toEqual(["format", "since", "presses", "keys"]);
    expect(o.since).toBe("2026-11-05");
    expect(o.presses).toBe(7);
    expect(Object.entries(o.keys)).toEqual([["d:shift", 3], ["c:up", 2], ["a:primary", 1], ["b:primary", 1]]);
  });
});
