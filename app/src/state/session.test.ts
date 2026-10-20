// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { CalcCancelled, type Calc, type CasOutcome, type HomeOutcome, type UserName } from "../calc/port.ts";
import type { ComplexValue } from "../engine/format.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { t } from "../i18n/index.ts";
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
class ValueCalc extends FakeCalc implements Calc {
  override ready = (): Promise<{ safeStart?: { skipped: number } } | void> => Promise.resolve();
  override home(): Promise<HomeOutcome> {
    return Promise.resolve({ ok: true, display: "0.333333333333", approximate: false, ...safePrecision("0.333333333333"), value: third });
  }
  override cas(giac: string): Promise<CasOutcome> {
    return Promise.resolve({ ok: true, text: giac, latex: "\\frac{1}{2}" });
  }
  override cancel(): Promise<void> {
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
    const counting: Calc = Object.assign(new FakeCalc(), {
      ready: () => Promise.resolve(),
      home: () => (engineCalls++, Promise.reject(new Error("no engine call expected"))),
      cas: () => (engineCalls++, Promise.reject(new Error("no engine call expected"))),
      cancel: () => Promise.resolve(),
    });
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

  it("an entry typed while the history is still loading is kept, stored with it, and ids stay unique", async () => {
    const kv = memoryKv();
    const old = new Session(new ValueCalc(), kv);
    for (const x of ["1", "2", "3"]) await old.submit(x);
    const s = new Session(new ValueCalc(), kv);
    const restoring = s.restoreHistory();
    const job = s.submit("4"); // before the store has answered
    await restoring;
    await job;
    expect(s.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
    expect(new Set(s.home.map((i) => i.id)).size).toBe(4);
    const stored = kv.data.get("history") as { home: { latex: string }[] };
    expect(stored.home.map((i) => i.latex)).toEqual(["1", "2", "3", "4"]);
  });

  it("clearing the history clears the store", async () => {
    const kv = memoryKv();
    const a = new Session(new ValueCalc(), kv);
    await a.submit("2");
    a.clearHistory();
    expect((kv.data.get("history") as { home: unknown[] }).home).toHaveLength(0);
  });
});

describe("deleting a row (R11)", () => {
  it("removes that row only, in the open view, and writes the store", async () => {
    const kv = memoryKv();
    const s = new Session(new ValueCalc(), kv);
    for (const e of ["1", "2", "3"]) await s.submit(e);
    const second = s.home[1];
    if (!second) throw new Error("no second row");
    expect(s.removeItem(second)).toBe(true);
    expect(s.home.map((i) => i.latex)).toEqual(["1", "3"]);
    expect((kv.data.get("history") as { home: { latex: string }[] }).home.map((i) => i.latex)).toEqual(["1", "3"]);
    expect(s.removeItem(second)).toBe(false); // already gone
  });

  it("refuses a row that is still running", async () => {
    const s = new Session(new ValueCalc(), memoryKv());
    await s.submit("1");
    const row = s.home[0];
    if (!row) throw new Error("no row");
    row.status = "pending";
    expect(s.removeItem(row)).toBe(false);
    expect(s.home).toHaveLength(1);
  });
});

describe("alpha lock (L3)", () => {
  it("alpha is one-shot; alpha twice locks; alpha again unlocks", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.toggleAlpha();
    s.clearModifiers();
    expect([s.alpha, s.alphaLock]).toEqual([false, false]);
    s.toggleAlpha();
    s.toggleAlpha();
    expect([s.alpha, s.alphaLock, s.capsLock]).toEqual([true, true, false]);
    s.clearModifiers();
    s.clearModifiers();
    expect([s.alpha, s.shift]).toEqual([true, false]);
    s.toggleAlpha();
    expect([s.alpha, s.alphaLock]).toEqual([false, false]);
  });
  it("shift, alpha, alpha locks the shift layer (lower case); shift in the lock is one-shot", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.toggleShift();
    s.toggleAlpha();
    s.toggleAlpha();
    s.clearModifiers();
    expect([s.alpha, s.shift, s.capsLock]).toEqual([true, true, true]);
    s.toggleShift();
    expect(s.shift).toBe(false);
    s.clearModifiers();
    expect(s.shift).toBe(true);
    s.toggleAlpha();
    expect([s.alpha, s.shift, s.alphaLock, s.capsLock]).toEqual([false, false, false, false]);
  });
});

describe("lock flicks (R9, P7 point 3)", () => {
  const mods = (s: Session) => ({ shift: s.shift, alpha: s.alpha, shiftLock: s.shiftLock, alphaLock: s.alphaLock, capsLock: s.capsLock });
  it("up on Shift locks shift: it stays on after each key; a tap on Shift or the same flick unlocks", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.flickShiftLock();
    s.clearModifiers();
    s.clearModifiers();
    expect([s.shift, s.shiftLock]).toEqual([true, true]);
    s.toggleShift();
    expect([s.shift, s.shiftLock]).toEqual([false, false]);
    s.flickShiftLock();
    s.flickShiftLock();
    expect([s.shift, s.shiftLock]).toEqual([false, false]);
  });
  it("down on Alpha locks capitals, up on Alpha lower case; the same flick or an Alpha tap unlocks", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.flickAlphaLock(false);
    s.clearModifiers();
    expect(mods(s)).toEqual({ shift: false, alpha: true, shiftLock: false, alphaLock: true, capsLock: false });
    s.flickAlphaLock(true); // switches to lower case
    s.clearModifiers();
    expect(mods(s)).toEqual({ shift: true, alpha: true, shiftLock: false, alphaLock: true, capsLock: true });
    s.flickAlphaLock(true);
    expect(mods(s)).toEqual({ shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false });
    s.flickAlphaLock(false);
    s.toggleAlpha();
    expect(mods(s)).toEqual({ shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false });
  });
  it("one lock at a time: a lock flick or Alpha, Alpha replaces the shift lock", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.flickShiftLock();
    s.flickAlphaLock(false);
    expect(mods(s)).toEqual({ shift: false, alpha: true, shiftLock: false, alphaLock: true, capsLock: false });
    s.flickShiftLock();
    expect(mods(s)).toEqual({ shift: true, alpha: false, shiftLock: true, alphaLock: false, capsLock: false });
    s.toggleAlpha(); // one-shot Alpha under the shift lock: the lower-case letter, then the shift lock again
    s.clearModifiers();
    expect(mods(s)).toEqual({ shift: true, alpha: false, shiftLock: true, alphaLock: false, capsLock: false });
    s.toggleAlpha();
    s.toggleAlpha(); // Alpha, Alpha under the shift lock: the lower-case lock, and the shift lock goes
    s.clearModifiers();
    expect(mods(s)).toEqual({ shift: true, alpha: true, shiftLock: false, alphaLock: true, capsLock: true });
  });
  it("the double-tap locks of L3 keep working (taps stay as on the G2)", () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.toggleAlpha();
    s.toggleAlpha();
    expect([s.alphaLock, s.capsLock]).toEqual([true, false]);
  });
});

describe("Session user names (docs/04 3.4)", () => {
  it("reads the engine's names when it is ready and after each finished job", async () => {
    let names: UserName[] = [{ name: "A", kind: "var", preview: "5", view: "home", time: 1 }];
    class NamesCalc extends ValueCalc {
      override names() {
        return Promise.resolve(names);
      }
    }
    const s = new Session(new NamesCalc(), memoryKv());
    await new Promise((r) => setTimeout(r, 0));
    expect(s.userNames.map((u) => u.name)).toEqual(["A"]);
    names = [...names, { name: "f", kind: "fn", preview: "(x)->x^2", view: "home", time: 2 }];
    await s.submit("f(x):=x^2");
    await new Promise((r) => setTimeout(r, 0));
    expect(s.userNames.map((u) => `${u.name}:${u.kind}`)).toEqual(["A:var", "f:fn"]);
  });
});

describe("Session user functions for the parser (R56)", () => {
  const fn = (name: string, kind: UserName["kind"] = "fn"): UserName => ({ name, kind, preview: "", view: "home", time: 1 });
  /** The fake engine echoes the Giac text it gets; names() answers from the list, or never once `hang` is set. */
  class NamesEcho extends FakeCalc {
    constructor(public list: UserName[], public hang = false) {
      super();
    }
    override names(): Promise<UserName[]> {
      return this.hang ? new Promise<UserName[]>(() => {}) : Promise.resolve(this.list);
    }
  }
  const sent = (s: Session): string => s.home[s.home.length - 1]?.text ?? "";

  it("a single-letter function from the stored names is a call from the first Enter on", async () => {
    const s = new Session(new NamesEcho([fn("p")]), memoryKv());
    await s.submit("p\\left(2\\right)"); // straight after the start: the parse waits for the names
    expect(sent(s)).toBe("p(2)");
  });
  it("a stored value or no entry at all leaves it a product; Home and CAS read the same names", async () => {
    const s = new Session(new NamesEcho([fn("p", "var")]), memoryKv());
    await s.submit("p\\left(2\\right)");
    expect(sent(s)).toBe("p*(2)");
    s.setView("cas");
    await s.submit("q\\left(2\\right)");
    expect(s.cas[s.cas.length - 1]?.text).toBe("q*(2)");
  });
  it("a function defined in this session is a call before its names are read back", async () => {
    const calc = new NamesEcho([]);
    const s = new Session(calc, memoryKv());
    await new Promise((r) => setTimeout(r, 0)); // the names read at the start has answered
    calc.hang = true; // the read after the definition does not answer before the next Enter
    await s.submit("p\\left(x\\right):=x^{2}");
    await s.submit("p\\left(2\\right)");
    expect(sent(s)).toBe("p(2)");
  });
});

describe("Session safe start (G19, F31)", () => {
  class SafeCalc extends ValueCalc {
    override ready = (): Promise<{ safeStart?: { skipped: number } } | void> => Promise.resolve({ safeStart: { skipped: 2 } });
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("says it once, as a history line in the i18n table (not a header note), and does not store it", async () => {
    const kv = memoryKv();
    const s = new Session(new SafeCalc(), kv);
    await tick();
    for (const list of [s.home, s.cas]) {
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe("note");
      expect(list[0]?.text).toBe(t("engine.safeStart"));
    }
    // the next entry does not say it again, and a note is no result: Ans, Copy and the stored history skip it
    await s.submit("\\frac13");
    expect(s.home.map((i) => i.status)).toEqual(["note", "done"]);
    expect(s.hasResult("home")).toBe(true);
    s.flushHistory();
    const saved = kv.data.get("history") as { home: { status: string }[]; cas: unknown[] };
    expect(saved.home.map((i) => i.status)).toEqual(["done"]);
    expect(saved.cas).toEqual([]);
  });

  it("a launch that is not a safe start adds no line", async () => {
    const s = new Session(new ValueCalc(), memoryKv());
    await tick();
    expect(s.home).toHaveLength(0);
    expect(s.cas).toHaveLength(0);
  });
});

describe("R66 (S12 row 2a): a power keeps Giac's principal root in Home and CAS", () => {
  it("Home sends the power, not surd, for a p/q exponent with q odd; so does CAS", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    await s.submit("\\left(-8\\right)^{\\frac{1}{3}}");
    await s.submit("\\left(-8\\right)^{\\frac{2}{3}}");
    await s.submit("\\left(-8\\right)^{\\frac{1}{2}}");
    expect(s.home.map((i) => i.text)).toEqual(["(-8)^(1/3)", "(-8)^(2/3)", "(-8)^(1/2)"]);
    s.setView("cas");
    await s.submit("\\left(-8\\right)^{\\frac{1}{3}}");
    expect(s.cas[0]?.text).toBe("(-8)^(1/3)");
  });

  it("Home keeps the root template's real cube root (L6, S12 row 3)", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    await s.submit("\\sqrt[3]{-8}");
    expect(s.home[0]?.text).toBe("surd(-8,3)");
  });

  it("CAS keeps the root template's real cube root (L6)", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.setView("cas");
    await s.submit("\\sqrt[3]{-8}");
    expect(s.cas[0]?.text).toBe("surd(-8,3)");
  });
});
