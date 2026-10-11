// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrate } from "./haptics.ts";

describe("vibrate (web build)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls navigator.vibrate with the duration only; strength is ignored", () => {
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate(0.5, 15);
    expect(spy).toHaveBeenCalledWith(15);
    vibrate(1, 40.4);
    expect(spy).toHaveBeenLastCalledWith(40);
  });

  it("does nothing, and does not throw, without a vibrator", () => {
    vi.stubGlobal("navigator", {});
    expect(() => vibrate(0.5, 15)).not.toThrow();
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(() => vibrate(0.5, 15)).not.toThrow();
  });
});
