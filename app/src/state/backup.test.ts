// SPDX-License-Identifier: GPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataText } from "../i18n/enData.ts";
import { backupName, BACKUP_KEYS, LEFT_OUT, makeBackup, saveBackup } from "./backup.ts";
import { fakeIndexedDb, type FakeIdb } from "./fakeIdb.ts";
import { DATA_VERSION, stamp } from "./storage.ts";
import { kvGetRaw, type RawRecord } from "./storageRaw.ts";

const saveFile = vi.hoisted(() => vi.fn(async () => "saved" as const));
vi.mock("../clipboard/files.ts", () => ({ saveFile }));

const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Every source file of app/src but the tests: path and text. */
function sources(dir = SRC): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.(ts|svelte)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [{ path, text: readFileSync(path, "utf8") }] : [];
  });
}

/**
 * R38af2: the keys the app writes to the store: the first argument of every `kv.set(…)`, `idbKv.set(…)` and `kvSet(…)`
 * in app/src, a string or a named constant (`USER_KEYS`, `TAPS_KEY`, `LINE_KEY`, `UNIT_PAD_CELLS`, …) resolved to its
 * `const NAME = "…"`. storage.ts's own `kvSet(key, …)` (the write-back of a migrated record) is the store, not a key.
 */
function writtenKeys(): { keys: Map<string, string>; unresolved: string[] } {
  const files = sources();
  const consts = new Map<string, Set<string>>();
  for (const f of files)
    for (const m of f.text.matchAll(/\bconst ([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/g)) {
      const name = m[1] as string;
      if (!consts.has(name)) consts.set(name, new Set());
      consts.get(name)?.add(m[2] as string);
    }
  const keys = new Map<string, string>();
  const unresolved: string[] = [];
  for (const f of files) {
    const where = f.path.slice(SRC.length);
    for (const m of f.text.matchAll(/(?:[kK]v\??\.set|\bkvSet)\(\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))/g)) {
      const literal = m[1] ?? m[2];
      if (literal !== undefined) {
        keys.set(literal, where);
        continue;
      }
      const name = m[3] as string;
      if (where === "state/storage.ts" && name === "key") continue;
      const values = consts.get(name);
      if (values?.size === 1) keys.set([...values][0] as string, `${where} (${name})`);
      else unresolved.push(`${where}: ${name}`);
    }
  }
  return { keys, unresolved };
}

/** The keys in the first column of docs/04 section 6.2's table. */
function documentedKeys(): string[] {
  const doc = readFileSync(new URL("../../../docs/04-architecture.md", import.meta.url), "utf8");
  const sec = doc.split("### 6.2")[1]?.split("\n### ")[0] ?? "";
  const keys: string[] = [];
  for (const line of sec.split("\n")) {
    const cell = /^\|([^|]*)\|/.exec(line)?.[1];
    if (cell) for (const m of cell.matchAll(/`([^`]+)`/g)) keys.push(m[1] as string);
  }
  return keys;
}

describe("the backup's keys (R38a)", () => {
  it("every key of docs/04 6.2 is in BACKUP_KEYS or on the left-out list", () => {
    const keys = documentedKeys();
    expect(keys.length).toBeGreaterThanOrEqual(12);
    for (const k of keys) expect(BACKUP_KEYS.includes(k) || LEFT_OUT.includes(k), k).toBe(true);
    for (const k of BACKUP_KEYS) expect(LEFT_OUT).not.toContain(k);
  });
  it("makeBackup holds only the keys that are present, with their stamps as stored", async () => {
    const store: Record<string, RawRecord> = {
      settings: { "@pascaline": DATA_VERSION, value: { digits: 12 } },
      defs: { "@pascaline": 0, value: [] },
      defsStarts: { "@pascaline": DATA_VERSION, value: 1 },
      view: { "@pascaline": DATA_VERSION + 1, value: "cas" },
    };
    const b = await makeBackup(async (k) => store[k], new Date("2026-10-31T12:00:00Z"));
    expect(b["pascaline-backup"]).toBe(1);
    expect(b.dataVersion).toBe(DATA_VERSION);
    expect(b.made).toBe("2026-10-31T12:00:00.000Z");
    expect(Object.keys(b.parts).sort()).toEqual(["defs", "settings", "view"]);
    expect(b.parts["defs"]?.["@pascaline"]).toBe(0);
    expect(b.parts["view"]?.["@pascaline"]).toBe(DATA_VERSION + 1);
  });
  it("every key the app writes is in BACKUP_KEYS or on the left-out list (R38af2)", () => {
    const { keys, unresolved } = writtenKeys();
    expect(unresolved, "a key the scan cannot resolve to a string").toEqual([]);
    // The scan itself still finds the keys behind the named constants and the string keys.
    for (const k of ["userKeys", "taps", "entry", "unitPadCells", "settings", "defs"]) expect(keys.has(k), k).toBe(true);
    for (const [k, where] of keys) expect(BACKUP_KEYS.includes(k) || LEFT_OUT.includes(k), `${k} (${where})`).toBe(true);
  });
  it("names the file by the date", () => {
    expect(backupName(new Date(2026, 9, 5))).toBe("pascaline-backup-2026-10-05.json");
  });
});

// R38af2: a failed read is not a missing key, so the backup is not saved without the part.
describe("a failed read fails the backup", () => {
  let idb: FakeIdb;
  beforeEach(() => {
    idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb.factory);
    saveFile.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const seed = (key: string, value: unknown): void => {
    if (!idb.stores.has("kv")) idb.stores.set("kv", new Map());
    idb.stores.get("kv")?.set(key, stamp(value));
  };

  it("reads a stored record and a missing key", async () => {
    seed("view", "cas");
    expect(await kvGetRaw("view")).toEqual({ "@pascaline": DATA_VERSION, value: "cas" });
    expect(await kvGetRaw("history")).toBeUndefined();
  });
  it("kvGetRaw throws when the get fails", async () => {
    seed("history", { home: [] });
    idb.failGets.add("history");
    await expect(kvGetRaw("history")).rejects.toThrow();
  });
  it("kvGetRaw throws when the open fails", async () => {
    vi.stubGlobal("indexedDB", {
      open() {
        const r = { error: new Error("blocked"), onerror: null as (() => void) | null, onsuccess: null, onupgradeneeded: null };
        setTimeout(() => r.onerror?.(), 0);
        return r;
      },
    });
    await expect(kvGetRaw("view")).rejects.toThrow();
  });
  it("saveBackup saves no file and says it could not when a get fails", async () => {
    seed("settings", { digits: 12 });
    seed("history", { home: [] });
    idb.failGets.add("history");
    expect(await saveBackup(new Date(2026, 9, 31))).toBe(dataText("backup.failed"));
    expect(saveFile).not.toHaveBeenCalled();
  });
  it("saveBackup saves the file when every read succeeds", async () => {
    seed("settings", { digits: 12 });
    expect(await saveBackup(new Date(2026, 9, 31))).toBe(dataText("backup.saved"));
    expect(saveFile).toHaveBeenCalledTimes(1);
  });
});

// R38af2: storageRaw.ts repeats storage.ts's database, version, store and stamp field (an export would cost the start
// chunk bytes); the two must agree.
describe("storageRaw.ts opens the same store as storage.ts", () => {
  const facts = (file: string): { db: string; version: string; store: string; stamp: string } => {
    const text = readFileSync(join(SRC, "state", file), "utf8");
    const str = (name: string): string | undefined => new RegExp(`\\bconst ${name}\\s*=\\s*"([^"]*)"`).exec(text)?.[1];
    const value = (arg: string): string => (/^"/.test(arg) ? arg.slice(1, -1) : (str(arg) ?? `unresolved ${arg}`));
    const open = /indexedDB\.open\(\s*([^,\s]+)\s*,\s*(\d+)\s*\)/.exec(text);
    const store = /createObjectStore\(\s*([^)\s]+)\s*\)/.exec(text);
    return {
      db: value(open?.[1] ?? "missing"),
      version: open?.[2] ?? "missing",
      store: value(store?.[1] ?? "missing"),
      stamp: str("STAMP") ?? "missing",
    };
  };
  it("the database name, its version, the store and the stamp field are equal", () => {
    const main = facts("storage.ts");
    expect(main).toEqual({ db: "pascaline", version: "1", store: "kv", stamp: "@pascaline" });
    expect(facts("storageRaw.ts")).toEqual(main);
  });
});
