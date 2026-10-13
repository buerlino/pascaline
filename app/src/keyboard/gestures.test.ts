// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANCEL_PX, FLICK_PX, FlickTracker, REPEAT_DELAY_MS, REPEAT_MS, Repeat, STEP_PX, Stepper } from "./gestures.ts";

describe("key flicks (R9, P7 points 2 and 3)", () => {
  it("a slide up or down of FLICK_PX arms the flick once (one tick); less is a tap", () => {
    const f = new FlickTracker();
    expect(f.move(0, -(FLICK_PX - 1))).toBe(false);
    expect(f.state).toBe("tap");
    expect(f.move(0, -FLICK_PX)).toBe(true);
    expect(f.state).toBe("up");
    expect(f.move(3, -40)).toBe(false); // further out: still up, no second tick
    expect(f.state).toBe("up");
    const d = new FlickTracker();
    expect(d.move(2, FLICK_PX + 5)).toBe(true);
    expect(d.state).toBe("down");
  });
  it("distance alone decides: the first move event may already be past the threshold (no hold, no dwell)", () => {
    const f = new FlickTracker();
    expect(f.move(0, 60)).toBe(true);
    expect(f.state).toBe("down");
  });
  it("a mostly sideways slide never arms a flick: it stays a tap (no left/right flicks)", () => {
    const f = new FlickTracker();
    f.move(30, -25);
    f.move(-40, 22);
    expect(f.state).toBe("tap");
  });
  it("sliding back to the middle cancels; sliding out again re-arms", () => {
    const f = new FlickTracker();
    f.move(0, -30);
    f.move(0, -(CANCEL_PX + 1)); // between the two radii: still armed (no flutter at the edge)
    expect(f.state).toBe("up");
    f.move(0, -(CANCEL_PX - 1));
    expect(f.state).toBe("cancelled");
    expect(f.move(0, FLICK_PX)).toBe(true);
    expect(f.state).toBe("down");
  });
  it("a jump through the middle in one move event switches direction, with a tick", () => {
    const f = new FlickTracker();
    f.move(0, -30);
    expect(f.move(0, 30)).toBe(true);
    expect(f.state).toBe("down");
  });
});

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
