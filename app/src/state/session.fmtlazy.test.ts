// SPDX-License-Identifier: GPL-3.0-or-later
// R135f1: the Format key's code (cycleForms.ts) loads lazily. A press before it has loaded acts on the row that was last
// at the press, not on a row added while the module loads. Its own file: the module must not be loaded yet.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { Kv } from "./storage.ts";
import { Session } from "./session.svelte.ts";

function memoryKv(): Kv {
  const data = new Map<string, unknown>();
  return {
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()),
  };
}

describe("Format key before its module has loaded", () => {
  it("acts on the row that was last at the press; a row added meanwhile is untouched", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.setView("cas");
    await s.submit("\\frac14", "1/4");
    const press = s.cycleFormat(); // the module is not in yet: this waits for it
    await s.submit("\\frac34", "3/4");
    expect(await press).toBe(true);
    expect(s.display(s.cas[0]!).text).toBe("0.25");
    expect(s.cas[1]!.fmt).toBeUndefined();
    expect(s.display(s.cas[1]!).text).toBe("3/4");
  });
});
