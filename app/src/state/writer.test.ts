// SPDX-License-Identifier: GPL-3.0-or-later
// R95: one writer per browser profile. The store's writes ask writer.ts; a tab without the lock writes nothing.
import { beforeEach, describe, expect, it, vi } from "vitest";

type W = typeof import("./writer.ts");
let w: W;
beforeEach(async () => {
  vi.resetModules(); // the module holds the tab's answer
  w = await import("./writer.ts");
});

/** A lock manager with one lock: granted to the first ifAvailable request, null to the others. */
function fakeLocks(held: boolean) {
  const calls: string[] = [];
  return {
    calls,
    request(name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<void> | void): Promise<unknown> {
      calls.push(`${name}:${opts.ifAvailable === true}`);
      return Promise.resolve(cb(held ? null : { name }));
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("writer", () => {
  it("writes as before when no lock was asked for (tests, a browser without locks)", async () => {
    const write = vi.fn(async () => "w");
    expect(await w.guardWrite(write, () => "no")).toBe("w");
    expect(w.locksOf({ navigator: {} } as unknown as typeof globalThis)).toBeUndefined(); // claimWriter then asks nothing
  });

  it("the tab holding the lock writes; a second tab writes nothing", async () => {
    const free = fakeLocks(false);
    let answer: boolean | undefined;
    w.claimWriter((x) => (answer = x), free);
    const write = vi.fn(async () => "w");
    expect(await w.guardWrite(write, () => "no")).toBe("w");
    expect(answer).toBe(true);
    expect(free.calls).toEqual(["pascaline-writer:true"]);

    vi.resetModules();
    w = await import("./writer.ts");
    w.claimWriter((x) => (answer = x), fakeLocks(true));
    const write2 = vi.fn(async () => "w");
    expect(await w.guardWrite(write2, () => "no")).toBe("no");
    expect(write2).not.toHaveBeenCalled();
    expect(answer).toBe(false);
  });

  it("a write asked for before the lock's answer waits for it", async () => {
    let grant: (() => void) | undefined;
    const slow = {
      request: (_n: string, _o: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<void> | void) =>
        new Promise<unknown>((r) => (grant = () => r(cb(null)))),
    };
    w.claimWriter(() => {}, slow);
    const write = vi.fn(async () => "w");
    const p = w.guardWrite(write, () => "no");
    await flush();
    expect(write).not.toHaveBeenCalled();
    grant?.();
    expect(await p).toBe("no");
  });

  it("yieldWriter lets the writes in flight land, refuses later ones, then lets go of the lock", async () => {
    let released = false;
    const locks = {
      request: (_n: string, _o: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<void> | void) => {
        const held = cb({});
        void held?.then(() => (released = true));
        return Promise.resolve();
      },
    };
    w.claimWriter(() => {}, locks);
    let land: (() => void) | undefined;
    const before = w.guardWrite(() => new Promise<string>((r) => (land = () => r("landed"))), () => "no");
    await flush();
    const yielded = w.guardWrite(async () => "w", () => "no"); // asked before the hand-over: still written
    const gone = w.yieldWriter();
    const after = w.guardWrite(async () => "w", () => "no");
    expect(await after).toBe("no");
    expect(await yielded).toBe("w");
    await flush();
    expect(released).toBe(false); // the first write is still in flight
    land?.();
    await gone;
    await flush();
    expect(await before).toBe("landed");
    expect(released).toBe(true);
  });

  it("the Android app asks for no lock (one WebView)", () => {
    const g = { Capacitor: { isNativePlatform: () => true }, navigator: { locks: fakeLocks(false) } } as unknown as typeof globalThis;
    expect(w.locksOf(g)).toBeUndefined();
    const web = { navigator: { locks: fakeLocks(false) } } as unknown as typeof globalThis;
    expect(w.locksOf(web)).toBeDefined();
  });
});
