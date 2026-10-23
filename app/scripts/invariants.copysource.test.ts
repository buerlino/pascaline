// SPDX-License-Identifier: GPL-3.0-or-later
// G43: the gate's copy source (invariants.ts copySourceOf) equals the one the app copies from: a real Session item.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../src/calc/fake.ts";
import type { Calc, HomeOutcome } from "../src/calc/port.ts";
import { copyFull } from "../src/clipboard/text.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import { EngineHost } from "../src/engine/host.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "../src/engine/nodeGiac.ts";
import { pasdegCommand } from "../src/engine/homeEval.ts";
import type { Kv } from "../src/state/storage.ts";
import { Session } from "../src/state/session.svelte.ts";
import { copySourceOf } from "./invariants.ts";

function memoryKv(): Kv {
  const data = new Map<string, unknown>();
  return {
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()),
  };
}

describe.skipIf(!giacAvailable())("copySourceOf equals the Session item's copy source (real Giac)", () => {
  for (const input of ["1/3", "2/3", "0.5", "sqrt(2)", "1.5e300*2e300", "evalf(1/3)"]) {
    it(input, async () => {
      const { giac: g, bridge } = await loadNodeGiac();
      g.eval(pasdegCommand("rad"));
      const host = new EngineHost(g, bridge);
      const calc: Calc = Object.assign(new FakeCalc(), {
        ready: () => Promise.resolve(),
        cancel: () => Promise.resolve(),
        home: (giac: string, s: { digits: number; angle: "rad" | "deg" }): Promise<HomeOutcome> => {
          const r = host.home(giac, { ...defaultHomeSettings, digits: s.digits, angle: s.angle }).result;
          return Promise.resolve({ ok: r.ok, display: r.display, approximate: r.approximate, facts: r.facts, full: r.full, ...(r.exact !== undefined ? { exact: r.exact } : {}), ...(r.value ? { value: r.value } : {}) });
        },
      });
      const s = new Session(calc, memoryKv());
      s.setView("home");
      await s.submit(input, input);
      const item = s.home.at(-1)!;
      const r = (await nodeHost()).home(input, { ...defaultHomeSettings }).result;
      const mine = copySourceOf(r);
      const theirs = item; // the clipboard reads the item itself (G86: it carries its ValueFacts)
      expect(mine.full).toBe(theirs.full);
      expect(mine.fullExact).toBe(theirs.fullExact);
      expect(mine.rational).toEqual(theirs.rational);
      expect(copyFull(mine)).toBe(copyFull(theirs));
    });
  }
  it("1/3 and 0.5 take the session's rational and exact rule", async () => {
    const { giac: g, bridge } = await loadNodeGiac();
    g.eval(pasdegCommand("rad"));
    const r = new EngineHost(g, bridge).home("1/3", { ...defaultHomeSettings }).result;
    const src = copySourceOf(r);
    expect(src.rational).toEqual({ n: "1", d: "3" });
    expect(src.full).toBe("1/3");
  });
});
