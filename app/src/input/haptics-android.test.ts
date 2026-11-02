// SPDX-License-Identifier: GPL-3.0-or-later
// The native plugin and the TS side must agree: plugin name, method, permission, registration.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(new URL(`../../../android/app/src/main/${p}`, import.meta.url), "utf8");

describe("PascalineHaptics Android side", () => {
  const plugin = read("java/io/github/buerlino/pascaline/PascalineHapticsPlugin.java");
  it("is named and shaped as haptics.ts expects", () => {
    expect(plugin).toContain('name = "PascalineHaptics"');
    expect(plugin).toMatch(/@PluginMethod\s+public void vibrate\(/);
    expect(plugin).toContain('call.getInt("ms"');
    expect(plugin).toContain('call.getInt("amplitude"');
    expect(plugin).toContain("createOneShot");
    expect(plugin).toContain("hasAmplitudeControl");
  });
  // A9 (F41, Fairphone 6, Android 16): the system's vibration intensity for the usage UNKNOWN (what a one-shot without
  // attributes gets) and for TOUCH was OFF, so dumpsys listed every pulse as ignored_for_settings. The pulse names its usage.
  it("names a usage on API 33+, one the touch-feedback switch does not turn off", () => {
    expect(plugin).toContain("VibrationAttributes.createForUsage(VibrationAttributes.USAGE_PHYSICAL_EMULATION)");
    expect(plugin).toMatch(/SDK_INT >= 33[\s\S]*vibrator\.vibrate\(effect, attrs\)/);
    expect(plugin).not.toContain("USAGE_TOUCH");
  });
  it("is registered before super.onCreate and the manifest has VIBRATE", () => {
    const main = read("java/io/github/buerlino/pascaline/MainActivity.java");
    expect(main.indexOf("registerPlugin(PascalineHapticsPlugin.class)")).toBeGreaterThan(0);
    expect(main.indexOf("registerPlugin(")).toBeLessThan(main.indexOf("super.onCreate"));
    expect(read("AndroidManifest.xml")).toContain("android.permission.VIBRATE");
  });
});
