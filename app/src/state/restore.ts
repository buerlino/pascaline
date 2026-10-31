// SPDX-License-Identifier: GPL-3.0-or-later
// R38b (archive/r11-files.md section 3.5): a restore replaces the ticked keys in one IndexedDB transaction, after it kept
// their records as stored under `backup.undo` for one Undo; the app then reloads and starts from the restored records
// through its usual paths. Loaded only when the user restores (never in the start chunk).
import { DATA_VERSION, idbKv } from "./storage.ts";
import { kvGetRaw, kvSetMany } from "./storageRaw.ts";

/** The restore's safety copy (backup.ts LEFT_OUT: never exported, kept until the next restore). */
export const UNDO_KEY = "backup.undo";

/** What `backup.undo` holds: when, each replaced key's record exactly as it was stored, and the keys that had none. */
export interface UndoRecord {
  readonly time: number;
  readonly records: Readonly<Record<string, unknown>>;
  readonly absent: readonly string[];
}

const stamped = (value: unknown): unknown => ({ "@pascaline": DATA_VERSION, value });

/** Replace the keys of `parts` (values brought up to DATA_VERSION by the check) and keep what they replace for Undo.
 *  `defsStarts` goes to 0: the next start replays the restored log in full (G19). */
export function restoreParts(parts: Readonly<Record<string, unknown>>, time: number): Promise<void> {
  const keys = Object.keys(parts);
  return kvSetMany(keys, (stored) => {
    const records: Record<string, unknown> = {};
    const absent: string[] = [];
    for (const k of keys) {
      if (stored[k] === undefined) absent.push(k);
      else records[k] = stored[k];
    }
    const out: Record<string, unknown> = { [UNDO_KEY]: stamped({ time, records, absent } satisfies UndoRecord), defsStarts: stamped(0) };
    for (const k of keys) out[k] = stamped(parts[k]);
    return out;
  });
}

/** The kept copy, or undefined when there is none (or it cannot be read: then there is nothing to offer). */
export async function readUndo(): Promise<UndoRecord | undefined> {
  try {
    const v = (await kvGetRaw(UNDO_KEY))?.value;
    if (typeof v !== "object" || v === null) return undefined;
    const u = v as Partial<UndoRecord>;
    return typeof u.time === "number" && typeof u.records === "object" && u.records !== null && Array.isArray(u.absent) ? (u as UndoRecord) : undefined;
  } catch {
    return undefined;
  }
}

/** Undo the restore: the kept records go back as they were stored, the keys that had none are deleted again, and
 *  `backup.undo` goes, all in one transaction. Throws when there is no kept copy. */
export function undoRestore(): Promise<void> {
  return kvSetMany([UNDO_KEY], (stored) => {
    const v = (stored[UNDO_KEY] as { value?: Partial<UndoRecord> } | undefined)?.value;
    if (!v || typeof v.records !== "object" || v.records === null || !Array.isArray(v.absent)) throw new Error("no restore to undo");
    const out: Record<string, unknown> = { ...v.records, [UNDO_KEY]: undefined, defsStarts: stamped(0) };
    for (const k of v.absent) out[k] = undefined;
    return out;
  });
}

/**
 * Stop the session's own writes until the reload: the page's `pagehide` flush (main.ts) and every debounced save would
 * otherwise write the old history, settings and line back over the restored records. Every store user goes through
 * `idbKv.set` (main.ts, calc/index.ts, units/userCells). Returns the release, for a write that failed (no reload).
 */
export function holdWrites(): () => void {
  const set = idbKv.set;
  idbKv.set = async () => {};
  return () => void (idbKv.set = set);
}
