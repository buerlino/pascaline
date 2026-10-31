// SPDX-License-Identifier: GPL-3.0-or-later
// The backup (R11 section 3, docs/04 6.2): one JSON file with each stored key's record as stored, stamp included. Loaded
// only when the user saves one (never in the start chunk).
import { dataText } from "../i18n/enData.ts";
import { DATA_VERSION } from "./storage.ts";
import { kvGetRaw, type RawRecord } from "./storageRaw.ts";

/** The keys a backup holds (docs/04 6.2). A new key joins by being added here; the unit test fails until it is here or
 *  in LEFT_OUT. */
export const BACKUP_KEYS: readonly string[] = [
  "settings",
  "view",
  "place",
  "entry",
  "history",
  "defs",
  "userKeys",
  "taps",
  "app.function",
  "app.solve",
  "units.targets",
  "units.history",
];

/** Keys of docs/04 6.2 that stay out: `defsStarts` is per install (restored, it could make the engine skip the replay,
 *  G19); `backup.undo` (R38b) is the restore's own safety copy. */
export const LEFT_OUT: readonly string[] = ["defsStarts", "backup.undo"];

export interface Backup {
  "pascaline-backup": 1;
  dataVersion: number;
  made: string;
  parts: Record<string, RawRecord>;
}

/** The raw read the backup needs: the record as stored, or undefined. */
export type RawReader = (key: string) => Promise<RawRecord | undefined>;

/** The envelope with the parts that are present, in BACKUP_KEYS order. */
export async function makeBackup(read: RawReader, now: Date): Promise<Backup> {
  const parts: Record<string, RawRecord> = {};
  for (const key of BACKUP_KEYS) {
    const rec = await read(key);
    if (rec !== undefined) parts[key] = rec;
  }
  return { "pascaline-backup": 1, dataVersion: DATA_VERSION, made: now.toISOString(), parts };
}

/** `pascaline-backup-YYYY-MM-DD.json`, by the local date. */
export function backupName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `pascaline-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Settings › Data › Save a backup: makes the file, hands it to the file port, and returns the notice to show. */
export async function saveBackup(now: Date = new Date()): Promise<string> {
  try {
    const text = JSON.stringify(await makeBackup(kvGetRaw, now));
    const { saveFile } = await import("../clipboard/files.ts");
    const result = await saveFile(backupName(now), "application/json", text);
    return dataText(result === "saved" ? "backup.saved" : result === "cancelled" ? "backup.cancelled" : "backup.failed");
  } catch {
    return dataText("backup.failed");
  }
}
