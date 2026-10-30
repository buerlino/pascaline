// SPDX-License-Identifier: GPL-3.0-or-later
// The version stamp on stored values (R18f2 verification, 2026-10-14): old records are told apart and migrated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeIndexedDb, type FakeIdb } from "./fakeIdb.ts";
import { DATA_VERSION, kvGet, kvSet, MIGRATIONS, stamp, unstamp } from "./storage.ts";

describe("stored values carry a version", () => {
  it("round-trips a stamped value without a write-back", () => {
    expect(unstamp("history", stamp({ home: [1] }))).toEqual({ value: { home: [1] }, upgraded: false });
    expect(unstamp("view", stamp("cas"))).toEqual({ value: "cas", upgraded: false });
  });
  it("reads a value stored before versions as version 0 and writes it back", () => {
    expect(unstamp("defs", [{ name: "a" }])).toEqual({ value: [{ name: "a" }], upgraded: true });
    expect(unstamp("view", "home")).toEqual({ value: "home", upgraded: true });
  });
  it("runs the steps for its key from its version up", () => {
    const steps = { 0: { defs: (v: unknown) => String(v).replace("Psi", "Psi_") } };
    expect(unstamp("defs", "Psi+1", steps).value).toBe("Psi_+1");
    expect(unstamp("view", "Psi", steps).value).toBe("Psi");
    expect(unstamp("defs", stamp("Psi+1"), steps).value).toBe("Psi+1");
  });
  it("keeps a record from a newer version as it is", () => {
    expect(unstamp("view", { "@pascaline": DATA_VERSION + 1, value: "cas" })).toEqual({ value: "cas", upgraded: false });
  });
});

// A50: a downgrade (A49's kill switch, an older APK, the night's device between builds) never overwrites newer data,
// and no migration step changes what it already migrated.
describe("an older build never overwrites newer data (A50)", () => {
  let idb: FakeIdb;
  beforeEach(() => {
    idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb.factory);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const stored = (key: string): unknown => idb.stores.get("kv")?.get(key);
  const seed = async (key: string, record: unknown): Promise<void> => {
    await kvSet("seed", 0); // opens the database and makes the store
    idb.stores.get("kv")!.set(key, record);
  };
  /** kvGet's write-back is not awaited: let it land. */
  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

  it("a record stamped DATA_VERSION + 1 survives a save of the same key from today's code", async () => {
    const newer = { "@pascaline": DATA_VERSION + 1, value: { home: ["from a newer build"] } };
    await seed("history", newer);
    expect(await kvGet("history")).toEqual({ home: ["from a newer build"] });
    await kvSet("history", { home: ["today's session"] });
    expect(stored("history")).toEqual(newer);
  });

  it("a record of today's version or older is still written over", async () => {
    await seed("view", stamp("home"));
    await kvSet("view", "cas");
    expect(stored("view")).toEqual(stamp("cas"));
    await seed("defs", []); // stored before versions
    await kvSet("defs", [{ name: "a" }]);
    expect(stored("defs")).toEqual(stamp([{ name: "a" }]));
    await kvSet("fresh", 1);
    expect(stored("fresh")).toEqual(stamp(1));
  });

  it("every step of MIGRATIONS applied to its own output changes nothing", () => {
    for (const [v, byKey] of Object.entries(MIGRATIONS)) {
      for (const [key, step] of Object.entries(byKey)) {
        expect(SAMPLES[key], `a sample for the ${v} → ${Number(v) + 1} step of ${key}`).toBeDefined();
        const once = step(structuredClone(SAMPLES[key]));
        expect(step(structuredClone(once)), `${key}, step ${v}`).toEqual(once);
      }
    }
  });

  it("a record without a stamp goes through every step exactly once", async () => {
    const ran: string[] = [];
    const steps = Object.fromEntries(
      Array.from({ length: DATA_VERSION }, (_, v) => [v, { defs: (x: unknown) => (ran.push(`${v}`), [...(x as string[]), `${v}`]) }]),
    );
    const { value, upgraded } = unstamp("defs", ["typed"], steps);
    expect(upgraded).toBe(true);
    expect(ran).toEqual(Array.from({ length: DATA_VERSION }, (_, v) => `${v}`));
    expect(unstamp("defs", stamp(value), steps).value).toEqual(value);
    expect(ran).toHaveLength(DATA_VERSION);
    // through the store: read (migrated, written back), saved by the session, read again: the value is migrated once
    await seed("defs", SAMPLES["defs"]);
    const first = await kvGet("defs");
    await settle();
    expect(stored("defs")).toEqual(stamp(first));
    await kvSet("defs", first);
    expect(await kvGet("defs")).toEqual(first);
    expect(JSON.stringify(first)).toContain("D:=(sin((pi/180)*(1)))");
  });
});

/** One stored value per migrated key that takes every branch of its steps (a new step's key needs one here). */
const SAMPLES: Record<string, unknown> = {
  defs: [
    { name: "f", kind: "fn", cmds: ["f(x):=sin(x)+asin(x)+pasexp(i*x)"], preview: "", view: "home", time: 0 },
    { name: "g", kind: "fn", cmds: ["g(x):=(pi/180)^angle_radian()*x"], preview: "", view: "home", time: 0 },
    { name: "", kind: "other", cmds: ["(A:=cos(60))+1"], preview: "", view: "home", time: 0 },
    { name: "D", kind: "var", cmds: ["D:=(sin(1))"], angle: "deg", preview: "", view: "home", time: 0 },
    { name: "E", kind: "var", cmds: ["E:=(atan(3/4)+polar_coordinates([1,1]))"], angle: "deg", preview: "", view: "home", time: 0 },
    { name: "R", kind: "var", cmds: ["R:=(sin(1))"], angle: "rad", preview: "", view: "home", time: 0 },
    { name: "S", kind: "var", cmds: ["S:=(sin(x))"], early: true, preview: "", view: "home", time: 0 },
    { name: "T", kind: "var", cmds: ["T:=(atan(3/4))"], preview: "36.8698976458", view: "home", time: 0 },
    { name: "P", kind: "var", cmds: ["P:=(pasexp(1))"], preview: "", view: "home", time: 0 },
  ],
  library: "f(x):=pasexp(i*x)+sin(x)",
};
