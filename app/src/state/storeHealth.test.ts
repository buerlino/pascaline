// SPDX-License-Identifier: GPL-3.0-or-later
// R96 (night review 2026-10-30, fh-4): a store that keeps nothing is not silent. The store records how its writes and
// reads ended this session, persist.ts keeps the browser's answer to persist() and persisted(), and Settings › Data's
// last row tells which of three lines holds, with the last backup's date under it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { fakeIndexedDb, type FakeIdb } from "./fakeIdb.ts";

let idb: FakeIdb;
let storage: typeof import("./storage.ts");

/** localStorage, as persist.ts uses it. */
const local = (asked: boolean): Storage => {
  const m = new Map<string, string>(asked ? [["pascaline.persist-asked", "1"]] : []);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
};

beforeEach(async () => {
  idb = fakeIndexedDb();
  vi.stubGlobal("indexedDB", idb.factory);
  vi.stubGlobal("localStorage", local(true)); // persist() was asked before: the store asks nothing
  vi.resetModules(); // the health lasts for the session: a fresh module per test
  storage = await import("./storage.ts");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the store records its health (R96)", () => {
  it("kept before the first write (the line reads the same), and after a write that completed", async () => {
    expect(storage.storeHealth()).toBe("kept");
    await storage.kvSet("view", "cas");
    expect(storage.storeHealth()).toBe("kept");
  });
  it("failed after a commit that failed (a full disk: abort alone, R96f1), kept again once a write lands", async () => {
    await storage.kvSet("seed", 0); // makes the store
    idb.failCommits.add("history");
    await storage.kvSet("history", { home: [] }); // settles: onabort rejects
    expect(idb.stores.get("kv")?.has("history")).toBe(false);
    expect(storage.storeHealth()).toBe("failed");
    idb.failCommits.clear();
    await storage.kvSet("history", { home: [] });
    expect(storage.storeHealth()).toBe("kept");
  });
  it("per key (R96f1): a later write of another key that lands does not hide the failed one", async () => {
    await storage.kvSet("seed", 0);
    idb.failCommits.add("history");
    await storage.kvSet("history", { home: [] });
    idb.failCommits.clear();
    await storage.kvSet("settings", { digits: 9 });
    expect(idb.stores.get("kv")?.has("settings")).toBe(true);
    expect(storage.storeHealth()).toBe("failed");
    await storage.kvSet("history", { home: [] });
    expect(storage.storeHealth()).toBe("kept");
  });
  it("failed after an open that failed", async () => {
    idb.failOpens = 1;
    await storage.kvSet("view", "cas");
    expect(storage.storeHealth()).toBe("failed");
  });
  it("failed when a newer record keeps this build from writing (A50)", async () => {
    await storage.kvSet("seed", 0);
    idb.stores.get("kv")?.set("settings", { "@pascaline": storage.DATA_VERSION + 1, value: {} });
    await storage.kvSet("settings", { digits: 9 });
    expect(storage.storeHealth()).toBe("failed");
  });
  it("unread from a failed read (R93) on, whatever later writes do", async () => {
    await storage.kvSet("seed", 0);
    idb.stores.get("kv")?.set("view", storage.stamp("cas"));
    idb.failGetsOnce.add("view");
    expect(await storage.idbKv.get("view")).toBeUndefined();
    expect(storage.storeHealth()).toBe("unread");
    await storage.kvSet("other", 1);
    expect(storage.storeHealth()).toBe("unread");
  });
});

describe("persist.ts keeps the browser's answer (R96)", () => {
  const manager = (persist: boolean, persisted: boolean) => {
    const calls = { persist: 0, persisted: 0 };
    vi.stubGlobal("navigator", {
      storage: {
        persist: async () => (calls.persist++, persist),
        persisted: async () => (calls.persisted++, persisted),
      },
    });
    return calls;
  };

  it("keeps persist()'s answer, true or false", async () => {
    for (const a of [true, false]) {
      vi.resetModules();
      vi.stubGlobal("localStorage", local(false));
      manager(a, !a);
      const p = await import("./persist.ts");
      expect(p.persistAnswer()).toBeUndefined();
      p.askPersistOnce();
      await vi.waitFor(() => expect(p.persistAnswer()).toBe(a));
    }
  });
  it("persisted() replaces the kept answer and is read back; without a storage manager the answer stays", async () => {
    const calls = manager(false, true);
    const p = await import("./persist.ts");
    expect(await p.askPersisted()).toBe(true);
    expect(p.persistAnswer()).toBe(true);
    expect(calls.persisted).toBe(1);
    vi.stubGlobal("navigator", {});
    expect(await p.askPersisted()).toBe(true);
  });
});

describe("Settings › Data's last row (R96)", () => {
  const level = async (): Promise<{ items: () => readonly MenuItem[]; open: () => () => readonly MenuItem[] }> => {
    const ds = await import("../views/dataSection.svelte.ts");
    ds.resetUndoTime(null);
    const section = ds.dataSection({ data: () => undefined });
    const open = (): (() => readonly MenuItem[]) => {
      const sub = section.submenu!; // the sheet keeps the level it opened (sheet.svelte.ts activate)
      return () => sub.items;
    };
    return { items: open(), open };
  };
  const row = (items: readonly MenuItem[]): MenuItem => items.find((x) => x.id === "store") as MenuItem;

  it("Kept on this device when the browser keeps the store, with the last backup under it", async () => {
    const calls = { persisted: 0 };
    vi.stubGlobal("navigator", { storage: { persisted: async () => (calls.persisted++, true) } });
    await storage.kvSet("backup.last", new Date(2026, 10, 2, 9, 30).toISOString());
    const { items, open } = await level();
    expect(row(items()).id).toBe("store");
    await vi.waitFor(() => expect(row(items()).label).toBe("Kept on this device"));
    await vi.waitFor(() => expect(row(items()).hint).toBe("Last backup: 2026-11-02 09:30"));
    for (let i = 0; i < 5; i++) items(); // every draw reads the rows; persisted() is asked once per open
    expect(calls.persisted).toBe(1);
    const again = open();
    again();
    again();
    await vi.waitFor(() => expect(calls.persisted).toBe(2));
  });
  it("a download the browser only offered reads as offered, unless a saved backup is newer (R122)", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    await storage.kvSet("backup.last", new Date(2026, 10, 2, 9, 30).toISOString());
    await storage.kvSet("backup.offered", new Date(2026, 10, 3, 8, 0).toISOString());
    const first = await level();
    await vi.waitFor(() => expect(row(first.items()).hint).toBe("Last backup offered: 2026-11-03 08:00"));
    await storage.kvSet("backup.last", new Date(2026, 10, 3, 9, 0).toISOString());
    const again = first.open();
    await vi.waitFor(() => expect(row(again()).hint).toBe("Last backup: 2026-11-03 09:00"));
  });
  it("Kept, but the browser may delete it, when it does not; no backup: no date", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => false } });
    await storage.kvSet("view", "cas");
    const { items } = await level();
    await new Promise((r) => setTimeout(r, 20));
    expect(row(items()).label).toBe("Kept, but the browser may delete it: save a backup");
    expect(row(items()).hint).toBeUndefined();
  });
  it("Not saved after a write that failed, and after a read that failed", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    idb.failOpens = 1;
    await storage.kvSet("view", "cas");
    const { items } = await level();
    await new Promise((r) => setTimeout(r, 20));
    expect(row(items()).label).toBe("Not saved: changes are lost when the app closes");
    await storage.kvSet("view", "cas");
    expect(row(items()).label).toBe("Kept on this device");
    idb.failGetsOnce.add("view");
    await storage.idbKv.get("view");
    expect(row(items()).label).toBe("Not saved: changes are lost when the app closes");
  });
  it("Not saved after a commit that failed (a full disk, R96f1), while a later write of another key lands", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    await storage.kvSet("seed", 0);
    idb.failCommits.add("history");
    await storage.kvSet("history", { home: [] });
    const { items } = await level();
    await new Promise((r) => setTimeout(r, 20));
    expect(row(items()).label).toBe("Not saved: changes are lost when the app closes");
    idb.failCommits.clear();
    await storage.kvSet("settings", { digits: 9 });
    expect(row(items()).label).toBe("Not saved: changes are lost when the app closes");
    await storage.kvSet("history", { home: [] });
    expect(row(items()).label).toBe("Kept on this device");
  });
  it("Not saved in a tab that is not the writer (R95): another tab holds the lock, nothing is written", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => true } });
    const writer = await import("./writer.ts"); // the instance storage.ts uses (same module registry)
    const held = {
      request: (_n: string, _o: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<void> | void) => Promise.resolve(cb(null)),
    }; // writer.test.ts fakeLocks(true): another tab holds `pascaline-writer`
    writer.claimWriter(() => {}, held);
    await storage.kvSet("view", "cas");
    expect(idb.stores.get("kv")?.has("view") ?? false).toBe(false);
    expect(storage.storeHealth()).toBe("failed");
    const { items } = await level();
    await new Promise((r) => setTimeout(r, 20));
    expect(row(items()).label).toBe("Not saved: changes are lost when the app closes");
  });
});
