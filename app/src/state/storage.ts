// SPDX-License-Identifier: GPL-3.0-or-later
// Tiny key-value store on IndexedDB (settings, history, definitions, app states). Every value is stamped with
// DATA_VERSION and migrated on read. Every call survives a missing or blocked IndexedDB: the app then simply starts
// with defaults.
/** The store the session persists to; tests pass an in-memory one. */
export interface Kv {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const DB = "pascaline";
const STORE = "kv";

/** The free keys U1–U3 (R15b): per key id and layer (`primary`, `shift`), the user's `{ label, action }` or null for a
 *  slot the user emptied; a slot that is absent has its default from spec/keyboard.yaml (keyboard/userKeys.svelte.ts). */
export const USER_KEYS = "userKeys";

/**
 * The format version of every stored value. Raise it, with a step in MIGRATIONS, whenever a stored shape or the meaning
 * of stored text changes: definitions are Giac text that holds our internal names (R18f1 renamed Φ and Ψ to Phi_ and
 * Psi_), so a rename or a parser fix must rewrite what older versions stored. 0 = stored before versions (2026-10-14).
 */
export const DATA_VERSION = 1;
/** The stamp's field; no value stored before versions has it. */
const STAMP = "@pascaline";

/** Steps from version n to n+1, by key; a key without a step keeps its value. */
type Migrations = Record<number, Record<string, (value: unknown) => unknown>>;
const MIGRATIONS: Migrations = {
  // 0 → 1: only the stamp is new.
  0: {},
};

/** A value as stored: stamped with the version it was written in. */
export function stamp(value: unknown): unknown {
  return { [STAMP]: DATA_VERSION, value };
}

/**
 * The value of a stored record, brought up to DATA_VERSION, and whether it changed version (then it is written back).
 * A record from a newer version is returned as it is (the app was downgraded; dropping it would lose it on the next save).
 */
export function unstamp(key: string, stored: unknown, steps: Migrations = MIGRATIONS): { value: unknown; upgraded: boolean } {
  const rec = typeof stored === "object" && stored !== null && STAMP in stored ? (stored as Record<string, unknown>) : null;
  const from = rec ? Number(rec[STAMP]) : 0;
  let value = rec ? rec["value"] : stored;
  for (let v = from; v < DATA_VERSION; v++) {
    const step = steps[v]?.[key];
    if (step) value = step(value);
  }
  return { value, upgraded: from < DATA_VERSION };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => {
        if (r.result === undefined) return resolve(undefined);
        const { value, upgraded } = unstamp(key, r.result);
        if (upgraded) void kvSet(key, value);
        resolve(value as T);
      };
      r.onerror = () => reject(r.error ?? new Error("indexedDB get failed"));
    });
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(stamp(value), key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB put failed"));
    });
  } catch {
    /* not persisted; nothing else to do */
  }
}

export const idbKv: Kv = { get: kvGet, set: kvSet };
