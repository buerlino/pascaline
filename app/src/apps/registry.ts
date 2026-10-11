// SPDX-License-Identifier: GPL-3.0-or-later
// The app library. Only names live here; each app's code is a separate chunk loaded on first use, so the
// start-up bundle does not grow with the number of apps.
import type { MessageKey } from "../i18n/index.ts";
import { instantiate, type AppHost, type AppId, type LoadedApp } from "./types.ts";

export interface AppEntry {
  readonly id: AppId;
  readonly name: MessageKey;
  load(host: AppHost): Promise<LoadedApp>;
}

export const APPS: readonly AppEntry[] = [
  { id: "function", name: "app.function", load: async (h) => instantiate((await import("./function/index.ts")).default, h) },
  { id: "solve", name: "app.solve", load: async (h) => instantiate((await import("./solve/index.ts")).default, h) },
];

export const isAppId = (v: unknown): v is AppId => APPS.some((a) => a.id === v);
export const appEntry = (id: AppId): AppEntry => APPS.find((a) => a.id === id) as AppEntry;
