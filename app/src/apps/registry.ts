// SPDX-License-Identifier: GPL-3.0-or-later
// The app library. Only names live here; each app's code is a separate chunk loaded on first use, so the
// start-up bundle does not grow with the number of apps.
import type { MessageKey } from "../i18n/index.ts";
import { instantiate, type AppHost, type AppId, type Glyph, type LoadedApp } from "./types.ts";

export type { Glyph };

export interface AppEntry {
  readonly id: AppId;
  readonly name: MessageKey;
  readonly glyph: Glyph;
  load(host: AppHost): Promise<LoadedApp>;
}

/** Home and CAS have no app entry; their glyphs stand beside the apps' so all places are in one table. */
export const HOME_GLYPHS: Readonly<Record<"home" | "cas", Glyph>> = { home: { icon: "home" }, cas: { text: "∫" } };

export const APPS: readonly AppEntry[] = [
  { id: "function", name: "app.function", glyph: { text: "ƒ" }, load: async (h) => instantiate((await import("./function/index.ts")).default, h) },
  { id: "solve", name: "app.solve", glyph: { text: "x=?" }, load: async (h) => instantiate((await import("./solve/index.ts")).default, h) },
];

export const isAppId = (v: unknown): v is AppId => APPS.some((a) => a.id === v);
export const appEntry = (id: AppId): AppEntry => APPS.find((a) => a.id === id) as AppEntry;
/** The glyph of a place: Home, CAS or an app. */
export const placeGlyph = (place: AppId | "home" | "cas"): Glyph => (place === "home" || place === "cas" ? HOME_GLYPHS[place] : appEntry(place).glyph);
