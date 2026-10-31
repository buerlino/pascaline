// SPDX-License-Identifier: GPL-3.0-or-later
// R38b (archive/r11-files.md section 3.4, 3.5): the restore's check refuses a file on its first fault, one test per
// refusal (the probe's bad files, tools/probes/backup-file.mjs, plus a validator fault per key), and the restore and its
// Undo write in one transaction.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataText } from "../i18n/enData.ts";
import { BACKUP_KEYS, checkBackup, MAX_BACKUP_BYTES, VALIDATORS, type CheckedBackup, type RefusedBackup } from "./backup.ts";
import { fakeIndexedDb, type FakeIdb } from "./fakeIdb.ts";
import { holdWrites, readUndo, restoreParts, UNDO_KEY, undoRestore } from "./restore.ts";
import { migrateSettings, SETTINGS_SCHEMA } from "./session.svelte.ts";
import { DATA_VERSION, idbKv } from "./storage.ts";

const at = (value: unknown, v = DATA_VERSION): { "@pascaline": unknown; value: unknown } => ({ "@pascaline": v, value });
const row = (latex: string, status = "done"): Record<string, unknown> => ({ id: 1, latex, status, resultLatex: "x" });
const parts = (): Record<string, unknown> => ({
  settings: at({ schema: SETTINGS_SCHEMA, ...migrateSettings({ digits: 9, angle: "rad" }).settings }),
  view: at("cas"),
  place: at({ app: null, view: "home" }),
  entry: at(null),
  history: at({ home: [row("1/3"), row("x+", "error")], cas: [row("x^2")] }),
  defs: at([{ name: "A", kind: "var", cmds: ["A:=5"], preview: "5", view: "home", time: 1 }]),
  userKeys: at({ u1: { primary: { label: "Home", action: { special: "home" } }, shift: null } }),
  taps: at({ shift: 1, alpha: 2, presses: 3, since: "2026-10-31" }),
  "app.function": at({ slots: [], win: null }),
  "app.solve": at({ slots: [] }),
});
const good = (): Record<string, unknown> => {
  const p = parts(); // no unitPadCells: a part missing from the file is not a fault
  return { "pascaline-backup": 1, dataVersion: DATA_VERSION, made: "2026-10-31T12:00:00.000Z", parts: p };
};
const bytes = (f: unknown): Uint8Array => new TextEncoder().encode(typeof f === "string" ? f : JSON.stringify(f));
const refused = (f: unknown): RefusedBackup => {
  const r = checkBackup(f instanceof Uint8Array ? f : bytes(f));
  if (r.ok) throw new Error("accepted");
  return r;
};
const withPart = (key: string, rec: unknown): Record<string, unknown> => {
  const g = good();
  return { ...g, parts: { ...(g["parts"] as object), [key]: rec } };
};

describe("checkBackup (r11 section 3.4)", () => {
  it("accepts a good file and gives each part's value, brought up to DATA_VERSION", () => {
    const r = checkBackup(bytes(good())) as CheckedBackup;
    expect(r.ok).toBe(true);
    expect(r.made).toBe("2026-10-31T12:00:00.000Z");
    expect(r.dataVersion).toBe(DATA_VERSION);
    expect(Object.keys(r.parts).sort()).toEqual(Object.keys(good()["parts"] as object).sort());
    expect(r.parts["view"]).toBe("cas");
    expect((r.parts["history"] as { home: unknown[] }).home).toHaveLength(2);
  });
  it("accepts a record stored before versions (stamp 0) and a byte order mark", () => {
    const r = checkBackup(bytes("﻿" + JSON.stringify(withPart("view", at("home", 0)))));
    expect(r.ok && r.parts["view"]).toBe("home");
  });
  it("runs a part through the migration steps of a stored value (defs 2 → 3: pasexp goes, G46)", () => {
    const r = checkBackup(bytes(withPart("defs", at([{ name: "f", kind: "fn", cmds: ["f(x):=pasexp(x)"], preview: "", view: "home", time: 0 }], 2))));
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.parts["defs"])).not.toContain("pasexp");
  });
  it("every key the backup holds has a validator", () => {
    for (const k of BACKUP_KEYS) expect(VALIDATORS[k], k).toBeTypeOf("function");
  });

  // one bad file per refusal, in the order of r11 section 3.4
  it("1. over 4 MB, before anything is decoded", () => {
    expect(refused(new Uint8Array(MAX_BACKUP_BYTES + 1)).message).toBe(dataText("refuse.size"));
  });
  it("1. not UTF-8", () => {
    expect(refused(new Uint8Array([0x7b, 0xff, 0x7d])).message).toBe(dataText("refuse.utf8"));
  });
  it("1. not JSON: a library file says where libraries go", () => {
    const r = refused("// pascaline library 3\nf(x):=x^2");
    expect(r.message).toBe("Not a backup; a library is imported under Settings › Data");
  });
  it("2. no pascaline-backup field (an object, an array, a number)", () => {
    for (const f of [{ parts: {} }, [1], 3, null]) expect(refused(f).message).toBe(dataText("refuse.envelope"));
  });
  it("2. a format number that is not an integer ≥ 1", () => {
    for (const n of ["1", 0, 1.5, -1, null]) expect(refused({ ...good(), "pascaline-backup": n }).message, String(n)).toBe(dataText("refuse.format"));
  });
  it("2. a newer format", () => {
    expect(refused({ ...good(), "pascaline-backup": 2 }).message).toBe("Made by a newer Pascaline (backup format 2; this one reads up to 1)");
  });
  it("3. parts missing or not an object", () => {
    for (const p of [undefined, [], "x", null]) expect(refused({ ...good(), parts: p }).message).toBe(dataText("refuse.parts"));
  });
  it("3. an unknown part, the left-out keys included", () => {
    for (const k of ["defsStarts", UNDO_KEY, "units.pad"]) {
      const r = refused(withPart(k, at(0)));
      expect(r.part).toBe(k);
      expect(r.message).toBe(`${k}: a part this version does not know`);
    }
  });
  it("4. a part without a stamp or without a value", () => {
    expect(refused(withPart("view", "home"))).toEqual({ ok: false, part: "view", message: "Open view: no version stamp or no value" });
    expect(refused(withPart("view", { "@pascaline": DATA_VERSION })).part).toBe("view");
    expect(refused(withPart("view", { value: "home" })).part).toBe("view");
  });
  it("4. a broken stamp (text, negative, a fraction)", () => {
    for (const v of ["3", -1, 1.5]) expect(refused(withPart("view", at("home", v as number))).message).toBe("Open view: a broken version stamp");
  });
  it("4. a part newer than DATA_VERSION, with its message and name, even when another part is also broken", () => {
    const f = withPart("defs", at([], DATA_VERSION + 1));
    (f["parts"] as Record<string, unknown>)["history"] = at({ home: [row("1", "pending")] });
    expect(refused(f)).toEqual({ ok: false, part: "defs", message: `Definitions: made by a newer Pascaline (version ${DATA_VERSION + 1}; this one reads up to ${DATA_VERSION})` });
  });
  it("2 before 3: a newer format with an unknown part is refused for its format", () => {
    expect(refused({ ...withPart("defsStarts", at(0)), "pascaline-backup": 2 }).message).toContain("backup format 2");
  });

  // 5. the key's validator: a row or field the start would drop is a fault
  const invalid: [string, unknown][] = [
    ["history", { home: [row("1/3"), row("2", "pending")] }], // restoreHistory drops an unfinished row
    ["history", { home: [row("1"), { status: "done" }] }], // ... and one without its LaTeX
    ["history", { home: [null] }],
    ["history", { home: Array.from({ length: 201 }, () => row("1")) }], // ... and keeps at most 200
    ["history", { home: "rows" }],
    ["history", []],
    ["settings", { angle: "grad" }], // migrateSettings would reset the field
    ["settings", { digits: "12" }],
    ["settings", "std"],
    ["defs", [{ name: "A", kind: "var", cmds: [] }]], // validDefs drops it
    ["defs", { A: 5 }],
    ["userKeys", { u99: { primary: { label: "x", action: { special: "home" } } } }],
    ["userKeys", { u1: { primary: { label: "", action: { special: "home" } } } }],
    ["userKeys", { u1: { hold: null } }],
    ["unitPadCells", { nope: { tap: { unit: "m" } } }],
    ["taps", { shift: -1, alpha: 0, since: "" }],
    ["view", "plot"],
    ["entry", { view: "home" }],
    ["place", "home"],
    ["app.function", 3],
  ];
  it.each(invalid)("5. %s: a value its validator rejects (%j)", (key, value) => {
    const r = refused(withPart(key, at(value)));
    expect(r.part).toBe(key);
    expect(r.message).toMatch(/: holds data this version cannot read$/);
  });
});

describe("restore and Undo, each in one transaction (r11 section 3.5)", () => {
  let idb: FakeIdb;
  const kv = (): Map<string, unknown> => idb.stores.get("kv") as Map<string, unknown>;
  beforeEach(() => {
    idb = fakeIndexedDb();
    idb.stores.set("kv", new Map());
    vi.stubGlobal("indexedDB", idb.factory);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("replaces the ticked keys, keeps their records as stored, sets defsStarts to 0; Undo brings them back exactly", async () => {
    const before = { settings: at({ digits: 7 }), history: { home: [] } /* stored before versions */, view: at("home"), defsStarts: at(2) };
    for (const [k, v] of Object.entries(before)) kv().set(k, v);
    await restoreParts({ settings: { digits: 9 }, history: { home: [row("1")] }, userKeys: { u1: {} } }, 1234);
    expect(kv().get("settings")).toEqual(at({ digits: 9 }));
    expect(kv().get("history")).toEqual(at({ home: [row("1")] }));
    expect(kv().get("userKeys")).toEqual(at({ u1: {} }));
    expect(kv().get("view")).toEqual(at("home")); // not ticked: untouched
    expect(kv().get("defsStarts")).toEqual(at(0));
    expect(await readUndo()).toEqual({ time: 1234, records: { settings: before.settings, history: before.history }, absent: ["userKeys"] });

    await undoRestore();
    expect(kv().get("settings")).toEqual(before.settings);
    expect(kv().get("history")).toEqual(before.history); // as stored: still without a stamp
    expect(kv().has("userKeys")).toBe(false); // it had none before the restore
    expect(kv().has(UNDO_KEY)).toBe(false);
    expect(await readUndo()).toBeUndefined();
  });
  it("Undo with no kept copy fails and writes nothing", async () => {
    kv().set("settings", at({ digits: 7 }));
    await expect(undoRestore()).rejects.toThrow();
    expect([...kv().entries()]).toEqual([["settings", at({ digits: 7 })]]);
  });
  it("holdWrites stops the session's writes until released", async () => {
    await idbKv.set("view", "cas");
    const release = holdWrites();
    await idbKv.set("view", "home");
    expect(kv().get("view")).toEqual(at("cas"));
    release();
    await idbKv.set("view", "home");
    expect(kv().get("view")).toEqual(at("home"));
  });
});
