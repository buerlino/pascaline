// SPDX-License-Identifier: GPL-3.0-or-later
// The four Appearance values (R50e): family, brightness, High contrast, Plain keys. Types, defaults and validation only,
// so the session (the start chunk) can hold them; the family names and colours are in lookView.ts and the mapping to
// applyTheme in lookApply.ts (both lazy). The inline script of index.html reads the same values from a localStorage
// mirror before the first paint.
import type { Family } from "./apply.ts";

export type BrightnessPref = "system" | "light" | "dark";
export interface Look {
  family: Family;
  brightness: BrightnessPref;
  /** High contrast: on at the first start when the system asks for more contrast (`prefers-contrast: more`). */
  contrast: boolean;
  /** Plain keys. */
  plain: boolean;
}

export const BRIGHTNESS: readonly BrightnessPref[] = ["system", "light", "dark"];
export const FAMILY_IDS: readonly Family[] = ["pascaline", "graphite", "solarized", "gruvbox", "nord"];

/** The look of a first start: Dark in the Android app, System in the PWA (docs/05 3.10); High contrast when the system asks. */
export function defaultLook(native = false, moreContrast = false): Look {
  return { family: "pascaline", brightness: native ? "dark" : "system", contrast: moreContrast, plain: false };
}

/** A stored look, field by field: a wrong or missing field keeps `fallback`'s. */
export function validLook(x: unknown, fallback: Look): Look {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Look, unknown>>;
  const family = FAMILY_IDS.find((f) => f === o.family) ?? fallback.family;
  const brightness = BRIGHTNESS.find((b) => b === o.brightness) ?? fallback.brightness;
  return {
    family,
    brightness,
    contrast: typeof o.contrast === "boolean" ? o.contrast : fallback.contrast,
    plain: typeof o.plain === "boolean" ? o.plain : fallback.plain,
  };
}
