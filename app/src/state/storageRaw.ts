// SPDX-License-Identifier: GPL-3.0-or-later
// The raw read of the backup (R38a). A module of its own so that the start chunk does not carry it: only the backup code
// imports it.
// It opens the database itself (the same name, version, store and stamp field as storage.ts, whose own copies are not
// exported: an export would cost the start chunk bytes; backup.test.ts checks that the two agree).
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

/** The record under `key`, undefined only for a key that was never stored. A failed open or get throws (R38af2): read as
 *  a missing key, it would give a backup without that part and the notice "Backup saved". */
export async function kvGetRaw(key: string): Promise<RawRecord | undefined> {
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
}

/**
 * R38b: several records in ONE transaction, so a restore or its Undo is written whole or not at all. It reads the
 * records under `read` as stored (no migration), then `write(stored)` gives each key's new record, put exactly as given
 * (the caller stamps it), or undefined to delete the key. A missing key reads as undefined. When `write` throws, nothing
 * is written and the promise rejects with its error.
 */
export async function kvSetMany(read: readonly string[], write: (stored: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const stored: Record<string, unknown> = {};
    let left = read.length;
    let failed: unknown;
    const put = (): void => {
      let recs: Readonly<Record<string, unknown>>;
      try {
        recs = write(stored);
      } catch (e) {
        failed = e; // nothing is written: the transaction ends with its reads only
        return;
      }
      for (const [key, rec] of Object.entries(recs)) {
        if (rec === undefined) store.delete(key);
        else store.put(rec, key);
      }
    };
    for (const key of read) {
      const r = store.get(key);
      r.onsuccess = () => {
        stored[key] = r.result;
        if (--left === 0) put();
      };
    }
    if (left === 0) put();
    tx.oncomplete = () => (failed === undefined ? resolve() : reject(failed));
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB write aborted"));
  });
}
