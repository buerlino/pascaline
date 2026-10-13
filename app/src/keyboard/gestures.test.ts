// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPEAT_DELAY_MS, REPEAT_MS, Repeat, STEP_PX, Stepper } from "./gestures.ts";

describe("trackpad stepper (K1)", () => {
  it("makes one step per STEP_PX in each direction, and steps back when dragged back", () => {
    const s = new Stepper();
    expect(s.move(STEP_PX - 1, 0)).toEqual([]);
    expect(s.move(STEP_PX, 0)).toEqual(["right"]);
    expect(s.move(3 * STEP_PX + 2, 0)).toEqual(["right", "right"]);
    expect(s.move(STEP_PX, 0)).toEqual(["left", "left"]);
    expect(s.move(-STEP_PX, 0)).toEqual(["left", "left"]);
    expect(s.count).toBe(7);
  });
  it("steps in two dimensions at once", () => {
    const s = new Stepper();
    expect(s.move(-2 * STEP_PX, -STEP_PX)).toEqual(["left", "left", "up"]);
    expect(s.move(-2 * STEP_PX, STEP_PX)).toEqual(["down", "down"]);
  });
  it("a touch that never moves a full step is a tap", () => {
    const s = new Stepper();
    s.move(5, -7);
    s.move(-3, 4);
    expect(s.count).toBe(0);
  });
});

describe("key auto-repeat (⌫)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("repeats after a delay until stopped", () => {
    let n = 0;
    const r = new Repeat(() => n++);
    vi.advanceTimersByTime(REPEAT_DELAY_MS - 1);
    expect(n).toBe(0);
    vi.advanceTimersByTime(1);
    expect(n).toBe(1);
    vi.advanceTimersByTime(3 * REPEAT_MS);
    expect(n).toBe(4);
    r.stop();
    vi.advanceTimersByTime(10 * REPEAT_MS);
    expect(n).toBe(4);
  });
  it("a short touch never repeats", () => {
    let n = 0;
    new Repeat(() => n++).stop();
    vi.advanceTimersByTime(10 * REPEAT_DELAY_MS);
    expect(n).toBe(0);
  });
});
