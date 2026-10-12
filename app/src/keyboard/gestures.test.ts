// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { FLICK_PX, STEP_PX, Stepper, flickOf } from "./gestures.ts";

describe("key flicks (K2)", () => {
  const both = { up: true, down: true };
  it("up is the shift layer, down the letter, past FLICK_PX of vertical slide", () => {
    expect(flickOf(0, -FLICK_PX, both)).toBe("up");
    expect(flickOf(3, FLICK_PX + 10, both)).toBe("down");
    expect(flickOf(0, -(FLICK_PX - 1), both)).toBeNull();
  });
  it("a sideways or diagonal slide is a tap, not a flick", () => {
    expect(flickOf(-40, -30, both)).toBeNull();
    expect(flickOf(30, 30, both)).toBe("down"); // exactly diagonal still counts as vertical
    expect(flickOf(31, 30, both)).toBeNull();
  });
  it("a direction the key doesn't have is a tap", () => {
    expect(flickOf(0, -40, { up: false, down: true })).toBeNull();
    expect(flickOf(0, 40, { up: true, down: false })).toBeNull();
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
