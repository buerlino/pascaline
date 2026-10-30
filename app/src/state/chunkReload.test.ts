// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { reloadOnMissingChunk } from "./chunkReload.ts";
import { askPersistOnce } from "./persist.ts";

const memory = (): Pick<Storage, "getItem" | "setItem"> => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe("reloadOnMissingChunk", () => {
  it("reloads once, then not again within a minute (a chunk that stays missing never loops)", () => {
    const s = memory();
    let n = 0;
    expect(reloadOnMissingChunk(s, 1_000_000, () => n++)).toBe(true);
    expect(reloadOnMissingChunk(s, 1_030_000, () => n++)).toBe(false);
    expect(n).toBe(1);
  });
  it("reloads again for a later deploy in the same session", () => {
    const s = memory();
    let n = 0;
    reloadOnMissingChunk(s, 1_000_000, () => n++);
    expect(reloadOnMissingChunk(s, 1_000_000 + 61_000, () => n++)).toBe(true);
    expect(n).toBe(2);
  });
  it("does not reload without a session storage to remember it in", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => undefined };
    let n = 0;
    expect(reloadOnMissingChunk(broken, 1, () => n++)).toBe(false);
    expect(n).toBe(0);
  });
});

describe("askPersistOnce", () => {
  it("does nothing where there is no storage manager (node)", () => {
    expect(() => askPersistOnce()).not.toThrow();
  });
});
