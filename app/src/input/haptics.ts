// SPDX-License-Identifier: GPL-3.0-or-later
// Key vibration. The web/PWA build can only set the duration (navigator.vibrate); the native Android build
// has a Capacitor plugin, `PascalineHaptics`, that also takes an amplitude (the strength slider). If the plugin
// is not there (an older shell, iOS, desktop) we fall back to navigator.vibrate.
import { Capacitor, registerPlugin } from "@capacitor/core";

/** The native side (Android, written separately): vibrate for `ms` milliseconds at `amplitude` 1..255. */
export interface PascalineHapticsPlugin {
  vibrate(options: { ms: number; amplitude: number }): Promise<void>;
}

/** Registered lazily by name: does nothing on the web, where Capacitor has no implementation for it. */
export const PascalineHaptics = registerPlugin<PascalineHapticsPlugin>("PascalineHaptics");

/** True when strength can be set (the native build with the plugin); the web build ignores it. */
export function hasStrength(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PascalineHaptics");
}

const webVibrate = (ms: number): void => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    // no vibrator, or the browser forbids it before a user gesture: nothing to do
  }
};

/** Fire one key-down pulse. `strength01` is 0..1, `ms` the duration. Never throws, never waits. */
export function vibrate(strength01: number, ms: number): void {
  const duration = Math.max(1, Math.round(ms));
  if (Capacitor.isNativePlatform()) {
    const amplitude = Math.min(255, Math.max(1, Math.round(strength01 * 255)));
    try {
      PascalineHaptics.vibrate({ ms: duration, amplitude }).catch(() => webVibrate(duration));
      return;
    } catch {
      // fall through to the web call
    }
  }
  webVibrate(duration);
}
