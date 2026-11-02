// SPDX-License-Identifier: GPL-3.0-or-later
// vvr: vr-9's check, run through vitest (backup.ts needs the yaml plugin). Prints whether a settings part without one
// nested field (look.plain, haptics.ms) passes the restore check, and what the start reader makes of it.
import { checkBackup, VALIDATORS } from "../../../app/src/state/backup.ts";
import { migrateSettings, SETTINGS_SCHEMA } from "../../../app/src/state/session.svelte.ts";
import { DATA_VERSION } from "../../../app/src/state/storage.ts";

declare const it: (name: string, fn: () => void) => void;

it("vr-9 probe", () => {
  const full = { schema: SETTINGS_SCHEMA, ...migrateSettings({}).settings } as Record<string, unknown>;
  const noPlain = { ...full, look: { ...(full["look"] as Record<string, unknown>) } };
  delete (noPlain.look as Record<string, unknown>)["plain"];
  const noMs = { ...full, haptics: { ...(full["haptics"] as Record<string, unknown>) } };
  delete (noMs.haptics as Record<string, unknown>)["ms"];
  const noLook = { ...full };
  delete noLook["look"];
  const file = (settings: unknown): Uint8Array =>
    new TextEncoder().encode(JSON.stringify({ "pascaline-backup": 1, dataVersion: DATA_VERSION, made: "x", parts: { settings: { "@pascaline": DATA_VERSION, value: settings } } }));
  for (const [name, s] of [["full", full], ["no look.plain", noPlain], ["no haptics.ms", noMs], ["no look at all", noLook]] as const) {
    const r = checkBackup(file(s));
    console.log(`VVR ${name}: ${r.ok ? "ok" : `refused (${r.message})`}; validator ${VALIDATORS["settings"]?.(s)}; start reads look ${JSON.stringify(migrateSettings(s).settings["look"])} haptics ${JSON.stringify(migrateSettings(s).settings["haptics"])}`);
  }
});
