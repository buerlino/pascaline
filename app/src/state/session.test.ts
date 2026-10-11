// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { CalcCancelled, type Calc, type CasOutcome, type HomeOutcome } from "../calc/port.ts";
import type { ComplexValue } from "../engine/format.ts";
import { Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

function memoryKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

const third: ComplexValue = {
  re: { neg: false, digits: "3".repeat(40), exp: -1, sticky: true },
  im: { neg: false, digits: "", exp: 0, sticky: false },
};

/** A Home engine that returns a numeric value, and a CAS that echoes. */
class ValueCalc implements Calc {
  ready = (): Promise<void> => Promise.resolve();
  home(): Promise<HomeOutcome> {
    return Promise.resolve({ ok: true, display: "0.333333333333", approximate: false, value: third });
  }
  cas(giac: string): Promise<CasOutcome> {
    return Promise.resolve({ ok: true, text: giac, latex: "\\frac{1}{2}" });
  }
  cancel(): Promise<void> {
    return Promise.resolve();
  }
}

describe("Session history", () => {
  it("stores finished entries of both views and restores them without calling the engine", async () => {
    const kv = memoryKv();
    const a = new Session(new ValueCalc(), kv);
    await a.submit("\\frac13");
    a.setView("cas");
    await a.submit("\\frac12");
    expect(a.home).toHaveLength(1);

    let engineCalls = 0;
    const counting: Calc = {
      ready: () => Promise.resolve(),
      home: () => (engineCalls++, Promise.reject(new Error("no engine call expected"))),
      cas: () => (engineCalls++, Promise.reject(new Error("no engine call expected"))),
      cancel: () => Promise.resolve(),
    };
    const b = new Session(counting, kv);
    await b.restore();
    expect(engineCalls).toBe(0);
    expect(b.home.map((i) => i.latex)).toEqual(["\\frac13"]);
    expect(b.cas.map((i) => i.resultLatex)).toEqual(["\\frac{1}{2}"]);
    // the Home value comes back, so it re-formats in SCI without the engine
    expect(b.home[0]?.value).toEqual(third);
    b.setFormat("sci");
    expect(b.display(b.home[0] as NonNullable<(typeof b.home)[0]>).text).toBe("3.33333333333E-1");
  });

  it("does not store pending or cancelled entries, and ids keep counting", async () => {
    const kv = memoryKv();
    const slow = new FakeCalc(10_000);
    const a = new Session(slow, kv);
    const job = a.submit("1+1");
    expect(a.busy).toBe(true);
    await a.cancel();
    await job;
    expect(a.home[0]?.status).toBe("cancelled");
    const stored = kv.data.get("history") as { home: unknown[] };
    expect(stored.home).toHaveLength(0);

    const done = new Session(new ValueCalc(), kv);
    await done.submit("2");
    const again = new Session(new ValueCalc(), kv);
    await again.restore();
    await again.submit("3");
    const ids = again.home.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CalcCancelled).toBeDefined();
  });

  it("clearing the history clears the store", async () => {
    const kv = memoryKv();
    const a = new Session(new ValueCalc(), kv);
    await a.submit("2");
    a.clearHistory();
    expect((kv.data.get("history") as { home: unknown[] }).home).toHaveLength(0);
  });
});
