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
  it("is registered before super.onCreate and the manifest has VIBRATE", () => {
    const main = read("java/io/github/buerlino/pascaline/MainActivity.java");
    expect(main.indexOf("registerPlugin(PascalineHapticsPlugin.class)")).toBeGreaterThan(0);
    expect(main.indexOf("registerPlugin(")).toBeLessThan(main.indexOf("super.onCreate"));
    expect(read("AndroidManifest.xml")).toContain("android.permission.VIBRATE");
  });
});
