// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { STEP_PX, Stepper } from "./gestures.ts";

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
