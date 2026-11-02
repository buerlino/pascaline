// SPDX-License-Identifier: GPL-3.0-or-later
// R106 (night review 2026-10-30, bu-1): the history is written only after it was read. A hide or close before the
// stored history is in (main.ts calls flushHistory on pagehide and on every hide) must leave the stored rows alone.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { loadRemoved, Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

/** A Home engine that answers at once (FakeCalc waits); the value does not matter here. */
class QuickCalc extends FakeCalc {
  override ready = (): Promise<{ safeStart?: { skipped: number } } | void> => Promise.resolve();
  override home(): Promise<HomeOutcome> {
    return Promise.resolve({ ok: true, display: "1", approximate: false, ...safePrecision("1") });
  }
  override cas(giac: string): Promise<CasOutcome> {
    return Promise.resolve({ ok: true, text: giac, latex: giac, facts: { exact: true, reliableDigits: null } });
  }
}

/** An in-memory store whose reads of `history` wait for `release()` (or never answer, `hang`); counts its writes. */
function gatedKv(hang = false): Kv & { data: Map<string, unknown>; writes: string[]; release: () => void } {
  const data = new Map<string, unknown>();
  const writes: string[] = [];
  let open: () => void = () => {};
  const gate = new Promise<void>((r) => (open = r));
  return {
    data,
    writes,
    release: () => open(),
    get: async <T>(k: string) => {
      if (k === "history") await (hang ? new Promise<never>(() => {}) : gate);
      return data.get(k) as T | undefined;
    },
    set: (k, v) => {
      writes.push(k);
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

const latexOf = (kv: { data: Map<string, unknown> }, view: "home" | "cas" = "home"): string[] =>
  ((kv.data.get("history") as Record<string, { latex: string }[]> | undefined)?.[view] ?? []).map((i) => i.latex);

/** Launch 1: four Home rows and one CAS row in the store. */
async function storeFour(kv: Kv & { release: () => void }): Promise<void> {
  kv.release();
  const a = new Session(new QuickCalc(), kv);
  await a.restoreHistory();
  for (const x of ["1", "2", "3", "4"]) await a.submit(x);
  a.setView("cas");
  await a.submit("x");
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("the history is written only after it was read (R106)", () => {
  it("a flush before the read leaves the stored rows, and the read then brings them back", async () => {
    const kv = gatedKv();
    await storeFour(kv);
    const b = new Session(new QuickCalc(), kv); // launch 2: hidden before its first frames
    b.flushHistory();
    await tick();
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4"]);
    expect(latexOf(kv, "cas")).toEqual(["x"]);
    await b.restoreHistory();
    expect(b.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4"]); // the pending save wrote the merged lists back
    const c = new Session(new QuickCalc(), kv); // launch 3
    await c.restoreHistory();
    expect(c.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
  });

  it("a flush while the read is in flight leaves the store; the rows typed meanwhile are saved after the read", async () => {
    const seed = gatedKv();
    await storeFour(seed);
    const kv = gatedKv();
    kv.data.set("history", seed.data.get("history"));
    const s = new Session(new QuickCalc(), kv);
    const reading = s.restoreHistory();
    await s.submit("5"); // typed before the store has answered
    s.flushHistory(); // hidden now
    await tick();
    expect(kv.writes).not.toContain("history");
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4"]);
    kv.release();
    await reading;
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4", "5"]);
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4", "5"]);
    expect(latexOf(kv, "cas")).toEqual(["x"]);
  });

  it("a read that never settles: no write of the history at all, the save timer's included", async () => {
    const kv = gatedKv(true);
    const s = new Session(new QuickCalc(), kv);
    s.saveDelayMs = 1;
    void s.restoreHistory();
    await s.submit("5");
    s.flushHistory();
    await new Promise((r) => setTimeout(r, 20)); // past the save timer
    const row = s.home[0];
    if (row) void s.removeItem(row);
    s.clearHistory();
    s.flushHistory();
    await tick();
    expect(kv.writes).not.toContain("history");
  });

  it("a Clear before the read is in clears the rows typed so far; the stored rows come back with the read", async () => {
    const seed = gatedKv();
    await storeFour(seed);
    const kv = gatedKv();
    kv.data.set("history", seed.data.get("history"));
    const s = new Session(new QuickCalc(), kv);
    await s.submit("5");
    const first = s.clearHistory(); // before the read started (main.ts reads after two frames)
    const reading = s.restoreHistory();
    await s.submit("6");
    const second = s.clearHistory(); // while the read is in flight
    await tick();
    expect(kv.writes).not.toContain("history");
    kv.release();
    await reading;
    await Promise.all([first, second]); // (R98: a Clear acts once its Undo code is in; it takes the rows of its press)
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4"]);
  });

  it("a Clear before the read keeps its Undo place behind the stored rows, in memory and across a relaunch (R98)", async () => {
    const seed = gatedKv();
    await storeFour(seed);
    const kv = gatedKv();
    kv.data.set("history", seed.data.get("history"));
    await loadRemoved(); // Clear acts at once (main.ts fetches the code when idle)
    const s = new Session(new QuickCalc(), kv);
    await s.submit("5"); // Enter, then Shift+Esc, before the stored rows are in
    expect(await s.clearHistory()).toBe(true);
    expect(s.home).toEqual([]);
    kv.release();
    await s.restoreHistory();
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
    expect(latexOf(kv)).toEqual(["1", "2", "3", "4"]);
    const b = new Session(new QuickCalc(), kv); // a relaunch between the Clear and the Undo
    await b.restoreHistory();
    expect(b.undoRemoved()).toBe(true);
    expect(b.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4", "5"]);
    expect(s.undoRemoved()).toBe(true); // and in the session that cleared
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("a Clear whose code arrives after the read takes the rows picked at the press, not the stored ones (R98)", async () => {
    const seed = gatedKv();
    await storeFour(seed);
    const kv = gatedKv();
    kv.data.set("history", seed.data.get("history"));
    const s = new Session(new QuickCalc(), kv);
    await s.submit("5");
    await s.submit("6");
    const clearing = s.clearHistory(); // the code may still be loading
    kv.release();
    await s.restoreHistory();
    expect(await clearing).toBe(true);
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
    expect(s.undoRemoved()).toBe(true);
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
