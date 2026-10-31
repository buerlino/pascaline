// SPDX-License-Identifier: GPL-3.0-or-later
// The raw read of the backup (R38a). A module of its own so that the start chunk does not carry it: only the backup code
// imports it.
// It opens the database itself (the same name, store and stamp field as storage.ts, whose own copies are not exported:
// an export would cost the start chunk bytes).
const STORE = "kv";
const STAMP = "@pascaline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pascaline", 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

/** A record as stored, with its true stamp (R38a, the backup): no migration and no write-back. A record stored before
 *  versions has no stamp and comes back as `{ "@pascaline": 0, value }`; a newer one keeps its newer stamp. */
export interface RawRecord {
  "@pascaline": number;
  value: unknown;
}

export async function kvGetRaw(key: string): Promise<RawRecord | undefined> {
  try {
    const db = await open();
    return await new Promise<RawRecord | undefined>((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => {
        const stored: unknown = r.result;
        if (stored === undefined) return resolve(undefined);
        if (typeof stored === "object" && stored !== null && STAMP in stored) {
          const rec = stored as Record<string, unknown>;
          return resolve({ [STAMP]: Number(rec[STAMP]), value: rec["value"] });
        }
        resolve({ [STAMP]: 0, value: stored });
      };
      r.onerror = () => reject(r.error ?? new Error("indexedDB get failed"));
    });
  } catch {
    return undefined;
  }
}
