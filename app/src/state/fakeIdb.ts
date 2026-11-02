// SPDX-License-Identifier: GPL-3.0-or-later
// A50: the smallest IndexedDB stand-in storage.ts needs (open, one store, get, put and delete in a transaction), for tests in
// node; no dependency. Requests finish on a later task, and a transaction completes once its last request has run its
// callback, so a put issued from a get's onsuccess belongs to the same transaction, as in a browser.

type Handler = (() => void) | null;

interface FakeRequest<T> {
  result: T;
  error: Error | null;
  onsuccess: Handler;
  onerror: Handler;
  onupgradeneeded?: Handler;
}

/** One database's records by store and key; tests read and seed `stores` directly. A get of a key in `failGets` ends in
 *  its onerror (R38af2); a key in `failGetsOnce` only for its next get, which takes it out (R93: one failed read, then a
 *  working store). While `failOpens` is above 0, each open ends in its onerror and counts it down (R93). A put of a key
 *  in `failPuts` ends in its onerror and fails its transaction, as a full disk does (R96). */
export interface FakeIdb {
  readonly stores: Map<string, Map<string, unknown>>;
  readonly failGets: Set<string>;
  readonly failGetsOnce: Set<string>;
  readonly failPuts: Set<string>;
  failOpens: number;
  readonly factory: { open(name: string, version: number): FakeRequest<unknown> };
}

export function fakeIndexedDb(): FakeIdb {
  const stores = new Map<string, Map<string, unknown>>();
  const failGets = new Set<string>();
  const failGetsOnce = new Set<string>();
  const failPuts = new Set<string>();
  const fails = (key: string): boolean => failGets.has(key) || failGetsOnce.delete(key);
  const later = (f: () => void): void => void setTimeout(f, 0);

  const transaction = (name: string) => {
    let pending = 0;
    let failed = false;
    const tx = { oncomplete: null as Handler, onerror: null as Handler, error: null as Error | null, objectStore };
    const done = (): void => {
      pending--;
      if (pending === 0 && !failed) later(() => tx.oncomplete?.());
    };
    function request<T>(run: () => T, fail = false, failTx = false): FakeRequest<T | undefined> {
      const r: FakeRequest<T | undefined> = { result: undefined, error: null, onsuccess: null, onerror: null };
      pending++;
      later(() => {
        if (fail) {
          r.error = new Error(failTx ? "QuotaExceededError (fake put failed)" : "fake get failed");
          r.onerror?.();
          if (failTx) {
            failed = true;
            tx.error = r.error;
            tx.onerror?.();
          }
        } else {
          r.result = run();
          r.onsuccess?.();
        }
        done();
      });
      return r;
    }
    function objectStore(s: string) {
      const store = stores.get(s);
      if (!store) throw new Error(`no store ${s}`);
      return {
        get: (key: string) => request(() => (store.has(key) ? structuredClone(store.get(key)) : undefined), fails(key)),
        put: (value: unknown, key: string) => request(() => void store.set(key, structuredClone(value)), failPuts.has(key), true),
        delete: (key: string) => request(() => void store.delete(key)),
      };
    }
    if (!stores.has(name)) throw new Error(`no store ${name}`);
    return tx;
  };

  const db = {
    objectStoreNames: { contains: (s: string) => stores.has(s) },
    createObjectStore: (s: string) => void stores.set(s, new Map()),
    transaction,
  };

  const fake: FakeIdb = {
    stores,
    failGets,
    failGetsOnce,
    failPuts,
    failOpens: 0,
    factory: {
      open() {
        const r: FakeRequest<unknown> = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
        if (fake.failOpens > 0) {
          fake.failOpens--;
          r.error = new Error("UnknownError (fake open failed)");
          later(() => r.onerror?.());
          return r;
        }
        later(() => {
          if (stores.size === 0) r.onupgradeneeded?.();
          r.onsuccess?.();
        });
        return r;
      },
    },
  };
  return fake;
}
