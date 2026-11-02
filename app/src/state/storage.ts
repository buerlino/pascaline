// SPDX-License-Identifier: GPL-3.0-or-later
// Tiny key-value store on IndexedDB (settings, history, definitions, app states). Every value is stamped with
// DATA_VERSION and migrated on read. Every call survives a missing or blocked IndexedDB: the app then simply starts
// with defaults. A key whose read failed is not written again in that session (R93): its record may still be there.
// The migration steps themselves are a lazy chunk (state/migrations.ts, R103): only a record that needs one loads them.
import { guardWrite } from "./writer.ts";

/** The store the session persists to; tests pass an in-memory one. `get` gives undefined for nothing stored and for a
 *  read that failed: the caller keeps its defaults either way, and the app's store (idbKv) then drops every write of
 *  a key whose read failed, so the defaults never replace the user's record. */
export interface Kv {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** What a read found (R93): the value, nothing stored under the key, or a store that could not be read. */
export type KvRead<T> = { kind: "value"; value: T } | { kind: "none" } | { kind: "failed" };

const DB = "pascaline";
const STORE = "kv";

/** The free keys U1–U3 (R15b): per key id and layer (`primary`, `shift`), the user's `{ label, action }` or null for a
 *  slot the user emptied; a slot that is absent has its default from spec/keyboard.yaml (keyboard/userKeys.svelte.ts). */
export const USER_KEYS = "userKeys";

/**
 * The format version of every stored value. Raise it, with a step in MIGRATIONS (state/migrations.ts) and its keys in
 * STEP_KEYS, whenever a stored shape or the meaning
 * of stored text changes: definitions are Giac text that holds our internal names (R18f1 renamed Φ and Ψ to Phi_ and
 * Psi_), so a rename or a parser fix must rewrite what older versions stored. 0 = stored before versions (2026-10-14).
 */
export const DATA_VERSION = 4;
/**
 * The data version from which each settings schema (`SETTINGS_SCHEMA`, state/session.svelte.ts) is stamped (R94). A
 * new schema raises DATA_VERSION with it (storage.test.ts holds the two together): a build that knows only the stamp
 * then refuses to write over the newer record (kvSet), so it never drops the fields it does not know. Schemas 1–3 were
 * written before this pairing; schema 4 was first stamped 3 and is guarded from 4 on.
 */
export const SETTINGS_SINCE: Readonly<Record<number, number>> = { 4: 4 };
/** The stamp's field; no value stored before versions has it. */
const STAMP = "@pascaline";

/** Steps from version n to n+1, by key; a key without a step keeps its value. The table is MIGRATIONS in
 *  state/migrations.ts, a lazy chunk (R103). */
export type Migrations = Record<number, Record<string, (value: unknown) => unknown>>;

/** The keys that have a step from version n to n+1: MIGRATIONS's own keys (storage.test.ts holds the two together), so a
 *  read knows whether to load the steps without loading them. */
export const STEP_KEYS: Readonly<Record<number, readonly string[]>> = { 0: [], 1: [], 2: ["defs", "library"], 3: [] };

/** The version a stored record was written in (0 before versions). */
function storedVersion(stored: unknown): number {
  return typeof stored === "object" && stored !== null && STAMP in stored ? Number((stored as Record<string, unknown>)[STAMP]) : 0;
}

/** A value as stored: stamped with the version it is written in (today's, or `version` for text read from elsewhere). */
export function stamp(value: unknown, version: number = DATA_VERSION): unknown {
  return { [STAMP]: version, value };
}

/** A step of `key` lies between the record's version and DATA_VERSION (STEP_KEYS): only then are the steps loaded. */
export function needsSteps(key: string, stored: unknown): boolean {
  for (let v = storedVersion(stored); v < DATA_VERSION; v++) if (STEP_KEYS[v]?.includes(key)) return true;
  return false;
}

/**
 * The value of a stored record, brought up to DATA_VERSION, and whether it changed version (then it is written back).
 * A record from a newer version is returned as it is (the app was downgraded; dropping it would lose it on the next save).
 */
export function unstamp(key: string, stored: unknown, steps: Migrations): { value: unknown; upgraded: boolean } {
  const from = storedVersion(stored);
  let value = typeof stored === "object" && stored !== null && STAMP in stored ? (stored as Record<string, unknown>)["value"] : stored;
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

/** The value under `key`, brought up to DATA_VERSION (and written back when older), nothing stored, or "failed": a
 *  failed open or get, a migration step that throws, or a steps chunk that does not load, is never read as a key that
 *  was never stored. The steps are loaded only for a record that has one to run (needsSteps, R103). */
export async function kvGet<T>(key: string): Promise<KvRead<T>> {
  try {
    const db = await open();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error("indexedDB get failed"));
    });
    if (stored === undefined) return { kind: "none" };
    const steps: Migrations = needsSteps(key, stored) ? (await import("./migrations.ts")).MIGRATIONS : {};
    const { value, upgraded } = unstamp(key, stored, steps);
    if (upgraded) void kvSet(key, value);
    return { kind: "value", value: value as T };
  } catch {
    return { kind: "failed" };
  }
}

let persistAsked = false;

/**
 * Stores `value` under today's stamp, unless the record there is from a newer version (A50): an older build (A49's kill
 * switch, an older APK) never writes over it, so the newer build never migrates its own data again. The session keeps
 * its value in memory. The stamp is read in the same transaction as the write. A tab that is not the writer (R95,
 * writer.ts) writes nothing.
 */
export function kvSet(key: string, value: unknown): Promise<void> {
  return guardWrite(() => kvPut(key, value), () => void notKept.add(key));
}

/** R96: how this session's store stands, for Settings › Data: "unread" from a failed read on (R93: that key is not
 *  written again), "failed" while a key's last write did not land (an error or an abort, a newer record there, another
 *  tab the writer), else "kept" (before the first write too: the line reads the same). Per key (R96f1): a write of one
 *  key that lands never hides another key's failure; a key leaves `notKept` when its own write lands. In memory only:
 *  no stored key. */
export type StoreHealth = "kept" | "failed" | "unread";
const notKept = new Set<string>();
export const storeHealth = (): StoreHealth => (unread.size ? "unread" : notKept.size ? "failed" : "kept");

async function kvPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const r = store.get(key);
      let put = false;
      r.onsuccess = () => {
        // R96: a newer record there is not written over, so this session's value is not kept
        if (!(storedVersion(r.result) > DATA_VERSION)) put = !!store.put(stamp(value), key);
      };
      // the value is kept only once its transaction commits (R96f1); a commit that fails (a full disk,
      // QuotaExceededError) aborts it and fires abort alone, never error, so onabort rejects too (as storageRaw.ts
      // does). The catch below reads no reason, so none is given.
      tx.oncomplete = () => (put ? resolve : reject)();
      tx.onerror = tx.onabort = reject;
    });
    notKept.delete(key);
    if (!persistAsked) {
      persistAsked = true;
      void import("./persist.ts").then((m) => m.askPersistOnce()); // after the first stored value (A49); a lazy chunk, off the start chunk
    }
  } catch {
    notKept.add(key); // not persisted: Settings › Data says so (R96)
  }
}

/** R93: the keys whose read failed in this session (the page). */
const unread = new Set<string>();

/**
 * The store as its callers use it (R93). A read that failed gives undefined, so the caller keeps its defaults in memory,
 * and the key is not written for the rest of the session: the defaults never replace the record the read could not
 * see. A read that finds nothing stored leaves the key writable, as before.
 */
export const idbKv: Kv = {
  async get<T>(key: string): Promise<T | undefined> {
    const r = await kvGet<T>(key);
    if (r.kind === "failed") unread.add(key);
    return r.kind === "value" ? r.value : undefined;
  },
  set: (key, value) => (unread.has(key) ? Promise.resolve() : kvSet(key, value)),
};
