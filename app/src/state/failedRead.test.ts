// SPDX-License-Identifier: GPL-3.0-or-later
// R93 (night review 2026-10-30, ca-1): a failed store read is not "nothing stored". The store's read tells a value,
// nothing stored and "could not read" apart; a key whose read failed keeps its defaults in memory and is not written
// for the rest of the session, so the user's record survives a transient fault (an Android WebView "UnknownError" that
// clears). One test per caller of the store's read: a stored record, one failed read, then the action that writes that
// key; the record is unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defsStore } from "../calc/index.ts";
import { FakeCalc } from "../calc/fake.ts";
import type { Calc, CalcSettings } from "../calc/port.ts";
import { AppShell } from "../apps/shell.svelte.ts";
import type { AppHost } from "../apps/types.ts";
import type { DefEntry } from "../engine/defs.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { lineKeeper } from "../entry/keep.ts";
import { USER_KEY_IDS, UserKeys } from "../keyboard/userKeys.svelte.ts";
import { UNIT_TARGETS, writeTarget } from "../units/alternatives.ts";
import { CELL_KEYS, UNIT_PAD_CELLS, UnitCells } from "../units/userCells.svelte.ts";
import { fakeIndexedDb, type FakeIdb } from "./fakeIdb.ts";
import { PRESETS_KEY, Presets, PresetError, idbPresetStore } from "./presets.svelte.ts";
import { defaultSettings, Session, SETTINGS_SCHEMA, type HistoryItem } from "./session.svelte.ts";
import { stamp, type Kv } from "./storage.ts";
import { TapCounter, TAPS_KEY } from "./taps.svelte.ts";

let idb: FakeIdb;
/** The app's store (`idbKv`), fresh per test: what a failed read blocks lasts for the session (the module). */
let kv: Kv;
let storage: typeof import("./storage.ts");
/** The steps kvGet loads on demand (R103), from the same fresh module graph as `storage`. */
let migrations: typeof import("./migrations.ts");

beforeEach(async () => {
  idb = fakeIndexedDb();
  vi.stubGlobal("indexedDB", idb.factory);
  // theme.svelte.ts (loaded with the Function app) reads the page's brightness
  vi.stubGlobal("document", { documentElement: { dataset: {} } });
  vi.stubGlobal("MutationObserver", class { observe(): void {} });
  vi.resetModules();
  storage = await import("./storage.ts");
  migrations = await import("./migrations.ts");
  kv = storage.idbKv;
  await storage.kvSet("seed", 0); // opens the database and makes the store
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const store = (): Map<string, unknown> => idb.stores.get("kv")!;
const seed = (key: string, value: unknown): unknown => {
  const rec = stamp(value);
  store().set(key, rec);
  return structuredClone(rec);
};
/** The writes are not awaited by their callers: let them land. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

describe("the store's read tells three outcomes apart", () => {
  it("a value, nothing stored, and could not read (a failed get, a failed open)", async () => {
    seed("view", "cas");
    expect(await storage.kvGet("view")).toEqual({ kind: "value", value: "cas" });
    expect(await storage.kvGet("never")).toEqual({ kind: "none" });
    idb.failGetsOnce.add("view");
    expect(await storage.kvGet("view")).toEqual({ kind: "failed" });
    idb.failOpens = 1;
    expect(await storage.kvGet("view")).toEqual({ kind: "failed" });
    expect(await storage.kvGet("view")).toEqual({ kind: "value", value: "cas" });
  });

  it("a migration step that throws settles the read as could not read, and writes nothing back", async () => {
    const real = migrations.MIGRATIONS[2]!["defs"];
    const before = { "@n62": 2, value: 42 };
    store().set("defs", before);
    migrations.MIGRATIONS[2]!["defs"] = () => {
      throw new Error("step threw");
    };
    try {
      const r = await Promise.race([storage.kvGet("defs"), new Promise((res) => setTimeout(() => res("not settled"), 500))]);
      expect(r).toEqual({ kind: "failed" });
    } finally {
      migrations.MIGRATIONS[2]!["defs"] = real!;
    }
    await settle();
    expect(store().get("defs")).toEqual(before);
  });

  it("after a failed read the key is not written for the session; other keys and keys never stored still are", async () => {
    const before = seed("view", "cas");
    idb.failGetsOnce.add("view");
    expect(await kv.get("view")).toBeUndefined(); // the caller keeps its default
    await kv.set("view", "home");
    expect(await kv.get("view")).toBe("cas"); // a later read that works does not lift it
    await kv.set("view", "home");
    expect(store().get("view")).toEqual(before);
    expect(await kv.get("fresh")).toBeUndefined();
    await kv.set("fresh", 1);
    expect(store().get("fresh")).toEqual(stamp(1));
  });
});

/** A Home engine that answers at once; the value does not matter here. */
class QuickCalc extends FakeCalc {
  override ready = (): Promise<{ safeStart?: { skipped: number } } | void> => Promise.resolve();
}

const settings: CalcSettings = { digits: 12, angle: "rad", format: "std" };
const host = (): AppHost =>
  ({ calc: {} as Calc, settings, kv, userNames: [], setEntry: () => undefined, copy: () => undefined }) as unknown as AppHost;

describe("each caller keeps the stored record after one failed read", () => {
  it("settings (Session.restoreSettings, then a setting changes)", async () => {
    const before = seed("settings", { schema: SETTINGS_SCHEMA, ...structuredClone(defaultSettings), digits: 7, angle: "deg" });
    idb.failGetsOnce.add("settings");
    const s = new Session(new QuickCalc(), kv);
    await s.restoreSettings();
    expect(s.settings.digits).toBe(defaultSettings.digits); // its defaults, in memory
    s.settings.format = "sci";
    s.save();
    await settle();
    expect(store().get("settings")).toEqual(before);
  });

  it("view (Session.restoreSettings, then the view changes)", async () => {
    const before = seed("view", "cas");
    idb.failGetsOnce.add("view");
    const s = new Session(new QuickCalc(), kv);
    await s.restoreSettings();
    expect(s.view).toBe("home");
    s.saveView();
    await settle();
    expect(store().get("view")).toEqual(before);
  });

  it("history (Session.restoreHistory, then Enter)", async () => {
    const row: Omit<HistoryItem, "id"> = { view: "home", latex: "2", status: "done", resultLatex: "2", text: "2", approximate: false, startedAt: 0 };
    const before = seed("history", { home: [{ ...row, id: 1 }], cas: [] });
    idb.failGetsOnce.add("history");
    const s = new Session(new QuickCalc(), kv);
    await s.restoreHistory();
    await s.submit("1+1");
    s.flushHistory();
    await settle();
    expect(s.home.some((i) => i.latex === "1+1")).toBe(true);
    expect(store().get("history")).toEqual(before);
  });

  it("place (AppShell.restorePlace after a failed open, then back to Home)", async () => {
    const before = seed("place", { app: "solve", view: "num" });
    idb.failOpens = 1;
    const shell = new AppShell({} as Calc, kv, { value: "", set() {}, clear() {} }, () => settings);
    expect(await shell.restorePlace()).toBeNull();
    shell.close();
    await settle();
    expect(store().get("place")).toEqual(before);
  });

  it("app.function (restore, then an equation)", async () => {
    const { FunctionApp } = await import("../apps/function/app.svelte.ts");
    const before = seed("app.function", { slots: { latex: ["x^2"], enabled: [true], selected: 0 }, win: null, num: { start: "0", step: "1" }, trace: { slot: 0, x: "0" } });
    idb.failGetsOnce.add("app.function");
    const app = new FunctionApp(host());
    await app.restore();
    app.slots.set(1, "x+1");
    app.flush();
    await settle();
    expect(store().get("app.function")).toEqual(before);
  });

  it("app.solve (restore, then an equation)", async () => {
    const { SolveApp } = await import("../apps/solve/app.svelte.ts");
    const before = seed("app.solve", { slots: { latex: ["x^2=2"], enabled: [true], selected: 0 }, values: { x: "1" }, selected: "x" });
    idb.failGetsOnce.add("app.solve");
    const app = new SolveApp(host());
    await app.restore();
    app.slots.set(1, "y=3");
    app.flush();
    await settle();
    expect(store().get("app.solve")).toEqual(before);
  });

  it("entry (the kept line is read, then a typed line is kept)", async () => {
    const before = seed("entry", { view: "home", latex: "1+", chips: {} });
    idb.failGetsOnce.add("entry");
    const keeper = lineKeeper(kv);
    expect(await keeper.read("home")).toBeUndefined();
    keeper.save({ view: "home", latex: "2+", chips: {} });
    await settle();
    expect(store().get("entry")).toEqual(before);
  });

  it("userKeys (UserKeys.restore, then a slot is set)", async () => {
    const id = USER_KEY_IDS[0]!;
    const before = seed("userKeys", { [id]: { primary: { label: "A", action: { insert: "a" } } } });
    idb.failGetsOnce.add("userKeys");
    const keys = new UserKeys(kv);
    await keys.restore();
    keys.set(id, "shift", { label: "B", action: { insert: "b" } });
    await settle();
    expect(store().get("userKeys")).toEqual(before);
  });

  it("taps (the counters are read, then a Shift tap and a press are counted)", async () => {
    const before = seed(TAPS_KEY, { shift: 5, alpha: 3, presses: 100, presets: 1, since: "2026-10-01" });
    idb.failGetsOnce.add(TAPS_KEY);
    const taps = new TapCounter(kv);
    taps.tap("shift");
    taps.press();
    await taps.flush();
    expect(taps.counts.shift).toBe(1);
    expect(store().get(TAPS_KEY)).toEqual(before);
  });

  it("unitPadCells (UnitCells.restore, then a leg is set)", async () => {
    const key = CELL_KEYS[0]!;
    const before = seed(UNIT_PAD_CELLS, { [key]: { tap: { unit: "m" } } });
    idb.failGetsOnce.add(UNIT_PAD_CELLS);
    const cells = new UnitCells(kv);
    await cells.restore();
    cells.set(key, "up", { unit: "s" });
    await settle();
    expect(store().get(UNIT_PAD_CELLS)).toEqual(before);
  });

  it("units.targets (a tap on a unit alternative reads the targets, then writes them)", async () => {
    const before = seed(UNIT_TARGETS, { L: { tokens: [{ unit: "m" }] } });
    idb.failGetsOnce.add(UNIT_TARGETS);
    await writeTarget(kv, "T", { tokens: [{ unit: "s" }] });
    await settle();
    expect(store().get(UNIT_TARGETS)).toEqual(before);
  });

  it("presets (R88: a failed read refuses every change; already so on phase-1)", async () => {
    const before = seed(PRESETS_KEY, { presets: [{ id: 1, name: "Lab", groups: { mode: { angle: "deg" } } }], active: 1, next: 2 });
    idb.failGetsOnce.add(PRESETS_KEY);
    const session = new Session(new QuickCalc(), kv);
    const p = await Presets.open({ session, userKeys: new UserKeys(kv), cells: new UnitCells(kv), store: idbPresetStore });
    expect(p.refused).toBe("unreadable");
    expect(() => p.capture("New")).toThrow(PresetError);
    await settle();
    expect(store().get(PRESETS_KEY)).toEqual(before);
  });
});

/** Answers init, define and eval; an eval of `n:=v` defines n. */
class DefiningWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  postMessage(msg: Request): void {
    const reply = (data: Response): void => void setTimeout(() => this.onmessage?.({ data }), 0);
    if (msg.type === "init") reply({ id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 });
    else if (msg.type === "define") reply({ id: msg.id, type: "defined", replayMs: 1, defs: [] });
    else if (msg.type === "eval") {
      const name = msg.input.split(":=")[0]!;
      reply({ id: msg.id, type: "result", output: "3", ok: true, engineMs: 1, defs: [{ set: entry(name, msg.input) }] });
    }
  }
  terminate(): void {}
}
const entry = (name: string, cmd: string): DefEntry => ({ name, kind: "var", cmds: [cmd], preview: "1", view: "home", time: 1 });

describe("the definitions log keeps its record after one failed read", () => {
  it("defs (WorkerEngine's load, then a `:=`)", async () => {
    const before = seed("defs", [entry("a", "a:=1"), entry("b", "b:=2"), entry("f", "f(x):=x^2")]);
    idb.failGetsOnce.add("defs");
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new DefiningWorker(), defs: defsStore(kv) });
    await engine.ready();
    await engine.eval("c:=3");
    await settle();
    expect(store().get("defs")).toEqual(before);
    engine.dispose();
  });

  it("defsStarts (WorkerEngine's start count, written before and after a replay)", async () => {
    seed("defs", [entry("a", "a:=1")]);
    const before = seed("defsStarts", 1);
    idb.failGetsOnce.add("defsStarts");
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new DefiningWorker(), defs: defsStore(kv) });
    await engine.ready();
    await settle();
    expect(store().get("defsStarts")).toEqual(before);
    engine.dispose();
  });
});
