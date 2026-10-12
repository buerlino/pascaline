// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, HOLD_SLOP_PX, KeyHold, REPEAT_DELAY_MS, REPEAT_MS, Repeat, STEP_PX, Stepper, type PadDir } from "./gestures.ts";

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

describe("hold and drag on a key (K2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const watch = (): { hold: KeyHold; log: string[] } => {
    const log: string[] = [];
    const hold = new KeyHold({
      cursor: () => log.push("cursor"),
      step: (d: PadDir) => log.push(d),
      tap: () => log.push("tap"),
      end: () => log.push("end"),
    });
    return { hold, log };
  };

  it("a touch released before the hold time is a tap, even with a small slip", () => {
    const { hold, log } = watch();
    hold.move(HOLD_SLOP_PX - 1, 2);
    vi.advanceTimersByTime(HOLD_MS - 1);
    hold.release();
    vi.advanceTimersByTime(HOLD_MS);
    expect(log).toEqual(["tap"]);
    expect(hold.phase).toBe("done");
  });
  it("a sloppy fast tap that slides off still fires the key, and never turns into the cursor", () => {
    const { hold, log } = watch();
    hold.move(HOLD_SLOP_PX + 5, 0);
    vi.advanceTimersByTime(2 * HOLD_MS);
    expect(log).toEqual([]);
    hold.move(5 * STEP_PX, 0);
    hold.release();
    expect(log).toEqual(["tap"]);
  });
  it("holding still turns the touch into the cursor: a drag steps from where the hold began, lifting ends it", () => {
    const { hold, log } = watch();
    hold.move(4, 0);
    vi.advanceTimersByTime(HOLD_MS);
    expect(log).toEqual(["cursor"]);
    expect(hold.phase).toBe("cursor");
    hold.move(4 + STEP_PX - 1, 0); // measured from the position at the hold: no step yet
    hold.move(4 - 2 * STEP_PX, STEP_PX);
    hold.release();
    expect(log).toEqual(["cursor", "left", "left", "down", "end"]);
  });
  it("a hold released without moving types nothing and leaves nothing behind", () => {
    const { hold, log } = watch();
    vi.advanceTimersByTime(HOLD_MS);
    hold.release();
    hold.release();
    hold.cancel();
    vi.advanceTimersByTime(10 * HOLD_MS);
    expect(log).toEqual(["cursor", "end"]);
  });
  it("a cancel (scroll, system gesture) fires nothing, and ends the cursor once", () => {
    const a = watch();
    a.hold.cancel();
    vi.advanceTimersByTime(2 * HOLD_MS);
    expect(a.log).toEqual([]);
    const b = watch();
    vi.advanceTimersByTime(HOLD_MS);
    b.hold.cancel();
    b.hold.move(5 * STEP_PX, 0);
    b.hold.release();
    expect(b.log).toEqual(["cursor", "end"]);
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
