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

describe("vibrate (native build, R35)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/core");
    vi.resetModules();
  });

  it("uses navigator.vibrate and reports no strength until loadNative has run, then the plugin with an amplitude", async () => {
    const plugin = { vibrate: vi.fn(() => Promise.resolve()) };
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
      registerPlugin: () => plugin,
    }));
    const web = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: web });
    vi.resetModules();
    const h = await import("./haptics.ts");
    expect(h.hasStrength()).toBe(false);
    h.vibrate(0.5, 15);
    expect(web).toHaveBeenCalledWith(15);
    expect(plugin.vibrate).not.toHaveBeenCalled();
    await h.loadNative();
    expect(h.hasStrength()).toBe(true);
    h.vibrate(0.5, 15);
    expect(plugin.vibrate).toHaveBeenCalledWith({ ms: 15, amplitude: 128 });
  });

  it("stays on the web call when the plugin is not there", async () => {
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => false, isPluginAvailable: () => false },
      registerPlugin: () => ({}),
    }));
    vi.resetModules();
    const h = await import("./haptics.ts");
    await h.loadNative();
    expect(h.hasStrength()).toBe(false);
  });
});
