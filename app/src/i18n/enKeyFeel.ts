// SPDX-License-Identifier: GPL-3.0-or-later
// The texts of Settings › Key vibration and Settings › Counters (R127's press counts). A table of its own, loaded with
// the Mode sheet's chunk (views/modeSheet.ts), so the start chunk does not carry it (R91's pin, docs/04 8.3; moved out
// of en.ts by G183f1). English only so far.
export const enKeyFeel = {
  "settings.haptics": "Key vibration",
  "settings.haptics.strength": "Strength",
  "settings.haptics.ms": "Length",
  "settings.haptics.webNote": "The Android app only",
  "settings.haptics.off": "Switch key vibration on first",
  "settings.haptics.try": "Try it",
  "settings.counters": "Counters",
  "settings.counters.value": "{n} presses",
  "settings.taps.presses": "Key presses",
  "settings.taps.shift": "Shift taps",
  "settings.taps.alpha": "Alpha taps",
  "settings.taps.since": "Counted on this device since",
  "settings.taps.export": "Export the counts",
  "settings.taps.reset": "Reset the counter",
  "settings.on": "On",
  "settings.off": "Off",
} as const;

export type KeyFeelKey = keyof typeof enKeyFeel;

/** The text of `key`, each `{name}` replaced by its value. */
export const keyFeelText = (key: KeyFeelKey, vars: Readonly<Record<string, string>> = {}): string =>
  enKeyFeel[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
