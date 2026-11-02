// SPDX-License-Identifier: GPL-3.0-or-later
// R98 (night review 2026-10-30, bu-2 and fh-1): Clear history spares a running job, and Clear and Delete can be undone.
// bu-2: Clear emptied the list with the pending row in it, so busy went false, Esc's cancel() found nothing and a
// second Enter was accepted while the first job ran on. fh-1: one press emptied up to 200 rows for good.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { loadRemoved, Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

function memoryKv(): Kv & { data: Map<string, unknown>; writes: string[] } {
  const data = new Map<string, unknown>();
  const writes: string[] = [];
  return {
    data,
    writes,
    get: <T>(k: string) => Promise.resolve(structuredClone(data.get(k)) as T | undefined),
    set: (k, v) => {
      writes.push(k);
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

/** A session on a FakeCalc (echo) whose jobs take `delay` ms, with the stored history read. */
async function session(delay = 0, kv: Kv = memoryKv()): Promise<Session> {
  const s = new Session(new FakeCalc(delay), kv);
  await s.restoreHistory();
  await loadRemoved(); // main.ts fetches it when idle; once in, Clear and Delete act at once
  return s;
}
const inputs = (s: Session): string[] => s.items.map((i) => i.latex);

describe("Clear spares a running job (R98, bu-2)", () => {
  it("the pending row stays, busy stays true, cancel() stops it, and a second Enter is refused", async () => {
    const s = await session(300);
    s.setView("cas");
    await s.submit("a");
    const job = s.submit("b");
    expect(job).toBeDefined();
    expect(s.busy).toBe(true);
    s.clearHistory();
    expect(inputs(s)).toEqual(["b"]);
    expect(s.items[0]?.status).toBe("pending");
    expect(s.busy).toBe(true);
    expect(s.submit("c")).toBeUndefined(); // refused while busy, as before the Clear
    expect(await s.cancel()).toBe(true);
    await job;
    expect(s.items[0]?.status).toBe("cancelled");
    expect(s.busy).toBe(false);
  });
});

describe("Undo for Clear and Delete (R98, fh-1)", () => {
  it("Clear keeps a copy; undo puts every row back in its place, the running one included", async () => {
    const s = await session(300);
    await s.submit("1");
    await s.submit("2");
    const job = s.submit("3");
    s.clearHistory();
    expect(inputs(s)).toEqual(["3"]);
    expect(s.undoCopy?.kind).toBe("clear");
    expect(s.undoRemoved()).toBe(true);
    expect(inputs(s)).toEqual(["1", "2", "3"]);
    expect(s.undoCopy).toBeNull();
    expect(s.undoRemoved()).toBe(false); // one level
    await job;
    expect(s.items.at(-1)?.status).toBe("done");
  });

  it("Delete of one row keeps it; undo puts it back where it was", async () => {
    const s = await session();
    for (const x of ["1", "2", "3"]) await s.submit(x);
    expect(await s.removeItem(s.items[1]!)).toBe(true);
    expect(inputs(s)).toEqual(["1", "3"]);
    expect(s.undoCopy?.kind).toBe("delete");
    expect(s.undoRemoved()).toBe(true);
    expect(inputs(s)).toEqual(["1", "2", "3"]);
  });

  it("a second Delete replaces the copy (one level)", async () => {
    const s = await session();
    for (const x of ["1", "2", "3"]) await s.submit(x);
    void s.removeItem(s.items[0]!);
    void s.removeItem(s.items[0]!);
    expect(inputs(s)).toEqual(["3"]);
    expect(s.undoRemoved()).toBe(true);
    expect(inputs(s)).toEqual(["2", "3"]);
  });

  it("the next Enter drops the copy, in memory and in the store", async () => {
    const kv = memoryKv();
    const s = await session(0, kv);
    await s.submit("1");
    s.clearHistory();
    await s.submit("2");
    expect(s.undoCopy).toBeNull();
    expect(s.undoRemoved()).toBe(false);
    expect(inputs(s)).toEqual(["2"]);
    expect((kv.data.get("history") as { undo?: unknown }).undo).toBeUndefined();
  });

  it("the next Enter drops the stored copy at once, while its job still runs", async () => {
    const kv = memoryKv();
    const s = await session(300, kv);
    await s.submit("1");
    await s.clearHistory();
    expect((kv.data.get("history") as { undo?: unknown }).undo).toBeDefined();
    const job = s.submit("2");
    expect(s.busy).toBe(true);
    expect((kv.data.get("history") as { undo?: unknown }).undo).toBeUndefined(); // a relaunch now has no Undo
    await job;
  });

  it("a second Clear drops the copy", async () => {
    const s = await session();
    await s.submit("1");
    s.clearHistory();
    s.clearHistory();
    expect(s.undoCopy).toBeNull();
    expect(s.undoRemoved()).toBe(false);
    expect(inputs(s)).toEqual([]);
  });

  it("the copy belongs to its view: the other view's undo does not take it", async () => {
    const s = await session();
    await s.submit("1");
    s.clearHistory();
    s.setView("cas");
    expect(s.undoRemoved()).toBe(false);
    s.setView("home");
    expect(s.undoRemoved()).toBe(true);
    expect(inputs(s)).toEqual(["1"]);
  });

  it("the copy is stored in the same write as the history, so a relaunch keeps the Undo", async () => {
    const kv = memoryKv();
    const a = await session(0, kv);
    for (const x of ["1", "2", "3"]) await a.submit(x);
    kv.writes.length = 0;
    a.clearHistory();
    expect(kv.writes).toEqual(["history"]); // one write
    const b = await session(0, kv);
    expect(inputs(b)).toEqual([]);
    expect(b.undoCopy?.kind).toBe("clear");
    expect(b.undoRemoved()).toBe(true);
    expect(inputs(b)).toEqual(["1", "2", "3"]);
    expect(b.items.every((i) => i.status === "done")).toBe(true);
    // and the undo is stored too: a third launch has the rows and no copy
    const c = await session(0, kv);
    expect(inputs(c)).toEqual(["1", "2", "3"]);
    expect(c.undoCopy).toBeNull();
  });

  it("a Delete survives a relaunch in its place", async () => {
    const kv = memoryKv();
    const a = await session(0, kv);
    for (const x of ["1", "2", "3"]) await a.submit(x);
    void a.removeItem(a.items[0]!);
    const b = await session(0, kv);
    expect(inputs(b)).toEqual(["2", "3"]);
    expect(b.undoRemoved()).toBe(true);
    expect(inputs(b)).toEqual(["1", "2", "3"]);
  });

  it("a stored copy that is not well formed is dropped, the history kept", async () => {
    const kv = memoryKv();
    const a = await session(0, kv);
    await a.submit("1");
    const h = kv.data.get("history") as Record<string, unknown>;
    kv.data.set("history", { ...h, undo: { view: "home", kind: "clear", rows: [{ at: "x", item: 3 }] } });
    const b = await session(0, kv);
    expect(inputs(b)).toEqual(["1"]);
    expect(b.undoCopy).toBeNull();
  });
});
