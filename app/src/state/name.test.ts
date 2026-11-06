// SPDX-License-Identifier: GPL-3.0-or-later
// R138: the app is N62 (decisions.md "The name N62"). The stored names, the stamps and the file names change once; the
// readers also take the old marker and stamps (an old backup file, an old library file), the writers write the new ones.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backupName, checkBackup, makeBackup, VALIDATORS, type CheckedBackup } from "./backup.ts";
import { reloadOnMissingChunk } from "./chunkReload.ts";
import { COUNTS_FORMAT, countsName, countsText } from "./countsFile.ts";
import { fakeIndexedDb } from "./fakeIdb.ts";
import { LIBRARY_FORMAT, upToDate } from "./libraryFormat.ts";
import { readPresets } from "./presetRecord.ts";
import { DATA_VERSION, kvSet, stamp, unstamp } from "./storage.ts";
import { kvGetRaw } from "./storageRaw.ts";
import { WRITER_LOCK } from "./writer.ts";
import { HEADER } from "../engine/libraryHeader.ts";
import { defaultLook, FAMILY_IDS } from "../theme/look.ts";
import { familyOf } from "../theme/lookView.ts";
import { LOOK_KEY } from "../theme/lookApply.ts";
import { libraryName } from "../views/libraryJobs.ts";

type File = Record<string, unknown> & { parts: Record<string, Record<string, unknown>> };
const fixture = (): File => JSON.parse(readFileSync(new URL("./fixtures/backup-2026-11.json", import.meta.url), "utf8")) as File;
const bytes = (f: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(f));
const checked = (f: unknown): CheckedBackup => {
  const r = checkBackup(bytes(f));
  if (!r.ok) throw new Error(`refused: ${r.message}`);
  return r;
};
const day = new Date(2026, 10, 6, 12);

afterEach(() => vi.unstubAllGlobals());

describe("the stored names (R138)", () => {
  it("storage opens the IndexedDB n62, and stamps its records @n62", async () => {
    const idb = fakeIndexedDb();
    const names: string[] = [];
    const open = idb.factory.open.bind(idb.factory);
    vi.stubGlobal("indexedDB", { open: (n: string, v: number) => (names.push(n), open(n, v)) });
    await kvSet("view", "cas");
    await kvGetRaw("view");
    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names)).toEqual(new Set(["n62"]));
    expect(idb.stores.get("kv")?.get("view")).toEqual({ "@n62": DATA_VERSION, value: "cas" });
  });
  it("the localStorage keys and the writer lock", () => {
    expect(LOOK_KEY).toBe("n62.look");
    expect(WRITER_LOCK).toBe("n62-writer");
    const keys: string[] = [];
    reloadOnMissingChunk({ getItem: () => null, setItem: (k) => void keys.push(k) }, 1e6, () => {});
    expect(keys).toEqual(["n62.chunk-reload"]);
  });
  it("the file names start with n62-", () => {
    expect(backupName(day)).toBe("n62-backup-2026-11-06.json");
    expect(countsName(day)).toBe("n62-counts-2026-11-06.json");
    expect(libraryName(day)).toBe("n62-library-2026-11-06.txt");
  });
});

describe("the stamps: written new, read old and new (R138)", () => {
  it("a record is stamped @n62 and read under it", () => {
    expect(stamp(1)).toEqual({ "@n62": DATA_VERSION, value: 1 });
    const steps = { 2: { place: (v: unknown) => ({ ...(v as object), step: 1 }) } };
    expect(unstamp("place", { "@n62": 2, value: { a: 1 } }, steps)).toEqual({ value: { a: 1, step: 1 }, upgraded: true });
  });
  it("a backup part stamped @pascaline runs the same steps as one stamped @n62", () => {
    const steps = { 2: { place: (v: unknown) => ({ ...(v as object), step: 1 }) } };
    const file = (stamp: string): Uint8Array => bytes({ "n62-backup": 1, parts: { place: { [stamp]: 2, value: { a: 1 } } } });
    const now = checkBackup(file("@n62"), VALIDATORS, steps);
    expect(now).toMatchObject({ ok: true, parts: { place: { a: 1, step: 1 } } });
    expect(checkBackup(file("@pascaline"), VALIDATORS, steps)).toEqual(now);
  });
  it("kvGetRaw reads an old-stamped record stamped @n62", async () => {
    const idb = fakeIndexedDb();
    idb.stores.set("kv", new Map<string, unknown>([["view", { "@pascaline": DATA_VERSION, value: "cas" }], ["place", { "@pascaline": 2, value: { a: 1 } }]]));
    vi.stubGlobal("indexedDB", idb.factory);
    expect(await kvGetRaw("view")).toEqual({ "@n62": DATA_VERSION, value: "cas" });
    expect(await kvGetRaw("place")).toEqual({ "@n62": 2, value: { a: 1 } });
  });
  it("a library file is written with `// n62 library N`; one starting `// pascaline library N` loads the same", () => {
    expect(HEADER.exec(`// n62 library ${DATA_VERSION}`)?.[1]).toBe(String(DATA_VERSION));
    expect(HEADER.exec("// pascaline library 2")?.[1]).toBe("2");
    expect(HEADER.exec("// pascal library 2")).toBeNull();
    const body = "// phasor\nph(w):=pasexp(i*w)\n";
    expect(String(upToDate(`// pascaline library 2\n${body}`))).toBe(String(upToDate(`// n62 library 2\n${body}`)));
    expect(String(upToDate(`// pascaline library 2\n${body}`)).split("\n")[0]).toBe(`// n62 library ${DATA_VERSION}`);
    expect(LIBRARY_FORMAT.version).toBe(DATA_VERSION);
  });
  it("the counts file says n62-counts/1", () => {
    expect(COUNTS_FORMAT).toBe("n62-counts/1");
    expect(JSON.parse(countsText({ since: "x", presses: 1, keys: {}, shift: 0, alpha: 0, presets: 0 }))).toMatchObject({ format: "n62-counts/1" });
  });
});

describe("the backup (R138)", () => {
  it("writes the marker n62-backup and parts stamped @n62", async () => {
    const b = await makeBackup(async (k) => (k === "view" ? { "@n62": DATA_VERSION, value: "cas" } : undefined), day);
    expect(b).toMatchObject({ "n62-backup": 1, parts: { view: { "@n62": DATA_VERSION, value: "cas" } } });
    expect(b).not.toHaveProperty("pascaline-backup");
    expect(checked(b).parts).toEqual({ view: "cas" });
  });
  it("the fixture (old marker, old stamps) reads as before", () => {
    const f = fixture();
    expect(f).toHaveProperty("pascaline-backup", 1);
    expect(Object.keys(checked(f).parts).sort()).toEqual(Object.keys(f.parts).sort());
  });
  it("its look and a preset's look of family pascaline read as family n62", () => {
    const f = fixture();
    const settings = f.parts["settings"]!["value"] as { look: Record<string, unknown> };
    settings.look["family"] = "pascaline";
    f.parts["presets"] = {
      "@pascaline": 3,
      value: { presets: [{ id: 1, name: "Old", groups: { look: { family: "pascaline", plain: true } } }], active: null, next: 2 },
    };
    const r = checked(f);
    expect((r.parts["settings"] as { look: { family: string } }).look.family).toBe("n62");
    const p = r.parts["presets"] as { presets: { groups: { look: Record<string, unknown> } }[] };
    expect(p.presets[0]!.groups.look).toEqual({ family: "n62", plain: true });
  });
  it("a file with both markers, or neither, is refused as before", () => {
    const f = fixture();
    delete f["pascaline-backup"];
    expect(checkBackup(bytes(f)).ok).toBe(false);
    expect(checkBackup(bytes({ ...f, "n62-backup": 2 })).ok).toBe(false); // a newer format, under the new marker
  });
});

describe("the house look (R138)", () => {
  it("is n62, named N62", () => {
    expect(FAMILY_IDS[0]).toBe("n62");
    expect(FAMILY_IDS).not.toContain("pascaline");
    expect(defaultLook().family).toBe("n62");
    expect(familyOf("n62").name).toBe("N62");
  });
  it("a stored preset holding the look pascaline reads as n62", () => {
    const { record } = readPresets({ presets: [{ id: 1, name: "A", groups: { look: { family: "pascaline" }, mode: { angle: "deg" } } }], active: null, next: 2 });
    expect(record.presets[0]!.groups).toEqual({ look: { family: "n62" }, mode: { angle: "deg" } });
  });
});
