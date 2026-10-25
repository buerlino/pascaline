// SPDX-License-Identifier: GPL-3.0-or-later
// Chips and Ans in the session (docs/04 2.8): what a result carries, Ans read at Enter, chip tables stored with
// the entry and read back with their shape checked. The engine is a stub that records the Giac text it gets.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { FakeCalc } from "../calc/fake.ts";
import type { Calc, CasOutcome, HomeOutcome } from "../calc/port.ts";
import { EngineHost } from "../engine/host.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import type { MathEngine } from "../engine/types.ts";
import { Session, type HistoryItem } from "./session.svelte.ts";
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

/** Home and CAS answered in-process by an EngineHost (no worker); Home takes the chip table (G49). */
function inProcess(host: EngineHost): MathEngine {
  const engine: Pick<MathEngine, "home" | "cas"> = {
    home: (input, s, consts, chips) => Promise.resolve(host.home(input, s, consts, chips).result),
    cas: (input, s) => Promise.resolve(host.cas(input, s).result),
  };
  return engine as MathEngine;
}

/** Home answers from a table (giac text → outcome); CAS echoes. Every input is recorded. */
class TableCalc extends FakeCalc implements Calc {
  seen: string[] = [];
  constructor(private readonly answers: Record<string, Partial<HomeOutcome>>) {
    super();
  }
  override ready = (): Promise<void> => Promise.resolve();
  override home(giac: string): Promise<HomeOutcome> {
    this.seen.push(giac);
    const a = this.answers[giac] ?? { display: "?" };
    const display = a.display ?? "?";
    return Promise.resolve({ ok: true, approximate: false, ...safePrecision(display), ...a, display });
  }
  override cas(giac: string): Promise<CasOutcome> {
    this.seen.push(giac);
    return Promise.resolve({ ok: true, text: giac, latex: giac, facts: { exact: false, reliableDigits: null } });
  }
}

describe("result chips", () => {
  it("a result carries its exact fraction, not the 12 digits shown", async () => {
    const calc = new TableCalc({ "1/3": { display: "0.333333333333", exact: "1/3" } });
    const s = new Session(calc, memoryKv());
    await s.submit("\\frac13");
    expect(s.chipFor(s.home[0] as HistoryItem)).toEqual({ value: "1/3", exact: true });
  });

  it("rounded digits are an inexact chip, and so is a float fallback", async () => {
    const calc = new TableCalc({ "sqrt(2)": { display: "1.41421356237" }, big: { display: "100000000000", approximate: true } });
    const s = new Session(calc, memoryKv());
    await s.submit("x", "sqrt(2)");
    await s.submit("x", "big");
    expect(s.chipFor(s.home[0] as HistoryItem)).toEqual({ value: "1.41421356237", exact: false, reliableDigits: null }); // R65: with its facts
    expect(s.chipFor(s.home[1] as HistoryItem)?.exact).toBe(false);
  });

  it("the chip table goes to the parser and is stored with the entry (only chips still on the line)", async () => {
    const calc = new TableCalc({});
    const s = new Session(calc, memoryKv());
    const chips = { "res:1": { value: "1/3", exact: true }, "res:2": { value: "5", exact: true } };
    await s.submit("\\res{1}{0.333333333333}\\times3", undefined, chips);
    expect(calc.seen.at(-1)).toBe("(1/3)*3");
    expect(s.home[0]?.chips).toEqual({ "res:1": { value: "1/3", exact: true } });
    expect(s.home[0]?.inexactInput).toBeUndefined();
    await s.submit("\\res{1}{0.33}", undefined, { "res:1": { value: "0.33333", exact: false } });
    expect(s.home[1]?.inexactInput).toBe(true);
  });

  it("Ans is the view's last result when Enter is pressed; without one it is an error", async () => {
    const calc = new TableCalc({ "1/3": { display: "0.333333333333", exact: "1/3" } });
    const s = new Session(calc, memoryKv());
    await s.submit("\\ans+1");
    expect(s.home[0]?.status).toBe("error");
    expect(s.home[0]?.text).toMatch(/Ans/);
    await s.submit("\\frac13");
    await s.submit("\\ans\\times3");
    expect(calc.seen.at(-1)).toBe("(1/3)*3");
    expect(s.home.at(-1)?.chips).toBeUndefined(); // Ans is never stored: a recalled entry reads the newest result
    // CAS keeps its own Ans
    s.setView("cas");
    await s.submit("\\ans");
    expect(s.cas[0]?.status).toBe("error");
  });

  it("restores stored chips and chip values, dropping malformed ones", async () => {
    const kv = memoryKv();
    kv.data.set("history", {
      home: [
        { id: 1, view: "home", latex: "\\res{1}{2}", status: "done", resultLatex: "2", text: "2", approximate: false, startedAt: 0,
          chips: { "res:1": { value: "2", exact: true }, "bad key": { value: "1", exact: true } }, full: "2", fullExact: true },
        { id: 2, view: "home", latex: "3", status: "done", resultLatex: "3", text: "3", approximate: false, startedAt: 0,
          chips: { "res:1": { value: 7 } }, full: 42 },
      ],
    });
    const s = new Session(new TableCalc({}), kv);
    await s.restore();
    expect(s.home[0]?.chips).toEqual({ "res:1": { value: "2", exact: true } });
    expect(s.chipFor(s.home[0] as HistoryItem)).toEqual({ value: "2", exact: true });
    expect(s.home[1]?.chips).toBeUndefined();
    expect(s.chipFor(s.home[1] as HistoryItem)).toBeUndefined();
  });
});

// R65 (deep check 2026-10-19 D1, D2): a result's facts travel through Ans and a tapped chip, for every later use. The
// real engine through EngineCalc and the Session, as the app runs a line; the marks are G49's golden sequence cases.
describe.skipIf(!giacAvailable())("marks travel through Ans and chips (R65, real engine)", () => {
  let calc: EngineCalc;
  beforeAll(async () => {
    calc = new EngineCalc(inProcess((await nodeHost())));
  });
  const markOf = (s: Session, i: number): string | null => {
    const item = s.home[i] as HistoryItem;
    expect(item.status, item.latex).toBe("done");
    return s.mark(item)?.mark ?? null;
  };

  it("D1: romberg's ⚠ survives Ans in a cancellation (12 and 30 digits)", async () => {
    for (const digits of [12, 30]) {
      const s = new Session(calc, memoryKv());
      s.setDigits(digits);
      await s.submit("x", "romberg(exp(-x^2),x,0,1)");
      expect(markOf(s, 0)).toBe("⚠");
      await s.submit("\\ans-0.7468241328124");
      expect(markOf(s, 1), `digits ${digits}`).toBe("⚠");
      expect(s.home[1]?.text, `digits ${digits}`).toBe("-2E-12");
      // the chip carries its confirmed decimal, never Giac's float text with digits past the confirmed ones
      const chip = s.chipFor(s.home[0] as HistoryItem);
      expect(chip?.exact).toBe(false);
      expect(chip?.value.replace(/^-|\.|0+$/g, "").replace(/^0+/, "").length).toBeLessThanOrEqual(12);
      expect(chip?.warn).toBeDefined();
    }
  });

  it("D2: normald_icdf ×1000 ÷1000 and romberg ×1 ×1 never become = (⚠ through two chips)", async () => {
    // G44: normald_icdf(0.025) is polished (≈); with σ < 0 the polish refuses and the value stays unaudited (⚠).
    const s = new Session(calc, memoryKv());
    await s.submit("x", "normald_icdf(2,-1,0.3)");
    await s.submit("\\ans\\times1000");
    await s.submit("\\ans\\div1000");
    expect([markOf(s, 0), markOf(s, 1), markOf(s, 2)]).toEqual(["⚠", "⚠", "⚠"]);
    expect(s.home[2]?.fullExact).toBe(false);
    const p = new Session(calc, memoryKv());
    await p.submit("x", "normald_icdf(0.025)");
    await p.submit("\\ans\\times1000");
    await p.submit("\\ans\\div1000");
    expect([markOf(p, 0), markOf(p, 1), markOf(p, 2)]).toEqual(["≈", "≈", "≈"]);
    const t = new Session(calc, memoryKv());
    await t.submit("x", "romberg(exp(-x^2),x,0,1)");
    await t.submit("\\ans\\times1");
    await t.submit("\\ans\\times1");
    expect([markOf(t, 1), markOf(t, 2)]).toEqual(["⚠", "⚠"]);
  });

  // G109: a solve result is Giac's list type, in braces through Ans, sent by name (not exact) or inlined (exact)
  it("G109: a solve result stays a list in braces through Ans", async () => {
    const s = new Session(calc, memoryKv());
    await s.submit("x", "solve(x^2=2,x)");
    await s.submit("\\ans");
    await s.submit("x", "solve(x^2=4,x)");
    await s.submit("\\ans");
    await s.submit("x", "list[1,4]");
    await s.submit("\\ans");
    expect(s.home.map((h) => [h.status, h.text])).toEqual([
      ["done", "{-1.41421356237,1.41421356237}"],
      ["done", "{-1.41421356237,1.41421356237}"],
      ["done", "{-2,2}"],
      ["done", "{-2,2}"],
      ["done", "{1,4}"],
      ["done", "{1,4}"],
    ]);
  });

  it("G86f1: a CAS true on a float (evalf(sin(0.5))==0.4794…) keeps its approximate mark through Ans", async () => {
    const s = new Session(calc, memoryKv());
    s.setView("cas");
    // 0.1+0.2==0.3 gives true without the engine marking it approximate (probed 2026-10-22), so it never reaches the
    // bug; a comparison with evalf does. 0.479425538604203 is sin(0.5) to 15 digits (source: mpmath, sin(mpf('0.5'))).
    await s.submit("\\operatorname{evalf}(\\sin(0.5))==0.479425538604203");
    await s.submit("\\ans");
    const [a, b] = [s.cas[0] as HistoryItem, s.cas[1] as HistoryItem];
    expect([a.status, b.status]).toEqual(["done", "done"]);
    expect(a.text).toBe("true");
    expect(s.chipFor(a)).toMatchObject({ exact: false });
    expect(b.approximate).toBe(true);
  });

  it("a tapped \\res chip behaves as Ans; an exact chip is unchanged (1/3 ×3 stays = 1)", async () => {
    const s = new Session(calc, memoryKv());
    await s.submit("x", "romberg(exp(-x^2),x,0,1)");
    await s.submit("1");
    const k = (s.home[0] as HistoryItem).id;
    const chip = s.chipFor(s.home[0] as HistoryItem)!;
    await s.submit(`\\res{${k}}{0.74682413281}-0.7468241328124`, undefined, { [`res:${k}`]: chip });
    expect(markOf(s, 2)).toBe("⚠");
    expect(s.home[2]?.chips?.[`res:${k}`]?.reliableDigits).toBe(chip.reliableDigits);
    const third = new Session(calc, memoryKv());
    await third.submit("\\frac13");
    expect(third.chipFor(third.home[0] as HistoryItem)).toEqual({ value: "1/3", exact: true });
    await third.submit("\\ans\\times3");
    expect(markOf(third, 1)).toBe("=");
    expect(third.home[1]?.text).toBe("1");
  });
});

describe("chip facts (R65)", () => {
  it("an inexact input never gives an exact chip, and a non-exact result carries its confirmed decimal", async () => {
    const calc = new TableCalc({
      "pasr_1*1000": { display: "-1959.96398454", exact: "-97998199227/50", full: "-1959.96398454", facts: { exact: true, reliableDigits: null } },
    });
    const s = new Session(calc, memoryKv());
    await s.submit("\\res{1}{x}\\times1000", undefined, { "res:1": { value: "-1.95996398454", exact: false } });
    expect(calc.seen.at(-1)).toBe("pasr_1*1000");
    expect(s.home[0]?.inexactInput).toBe(true);
    expect(s.chipFor(s.home[0] as HistoryItem)).toMatchObject({ value: "-1959.96398454", exact: false });
  });

  it("a chip table stored in the history and read back keeps its facts", async () => {
    const kv = memoryKv();
    const chip = { value: "0.74682413281", exact: false, reliableDigits: 11, warn: "unaudited" as const };
    kv.data.set("history", {
      home: [
        { id: 1, view: "home", latex: "\\res{4}{0.7}", status: "done", resultLatex: "1", text: "1", approximate: false, startedAt: 0,
          chips: { "res:4": chip, "res:5": { value: "1", exact: false, reliableDigits: "x", warn: "nope" } },
          full: "0.74682413281", fullExact: false, facts: { exactRational: false, reliableDigits: 11, warn: "unaudited" } },
      ],
    });
    const s = new Session(new TableCalc({}), kv);
    await s.restore();
    expect(s.home[0]?.chips).toEqual({ "res:4": chip, "res:5": { value: "1", exact: false } });
    expect(s.chipFor(s.home[0] as HistoryItem)).toEqual(chip);
  });
});

describe("a result's facts in the history (G76)", () => {
  it("why and uncDigits of a result reach its history item, as the engine sent them", async () => {
    const facts = { exact: false, reliableDigits: 11, warn: "unaudited" as const, why: { unaudited: ["romberg"] }, uncDigits: 4 };
    const calc = new TableCalc({ "1/3": { display: "0.333333333333", approximate: true, facts } });
    const s = new Session(calc, memoryKv());
    await s.submit("\\frac13");
    expect(s.home[0]?.facts).toEqual(facts);
  });

  it("an item stored before G76 (exactRational) reads back with exact, its elements too", async () => {
    const kv = memoryKv();
    const v = (d: string) => ({ re: { neg: false, digits: d, exp: -1, sticky: false }, im: { neg: false, digits: "", exp: 0, sticky: false } });
    kv.data.set("history", {
      home: [
        { id: 1, view: "home", latex: "\\frac14", status: "done", resultLatex: "0.25", text: "0.25", approximate: false, startedAt: 0, value: v("25"), facts: { exactRational: true, reliableDigits: null } },
        { id: 2, view: "home", latex: "[\\frac14]", status: "done", resultLatex: "[0.25]", text: "[0.25]", approximate: false, startedAt: 0,
          facts: { exactRational: true, reliableDigits: null, items: [{ exactRational: true, reliableDigits: null, value: v("25") }] } },
        { id: 3, view: "home", latex: "x", status: "done", resultLatex: "1", text: "1", approximate: false, startedAt: 0, facts: { reliableDigits: null } },
      ],
    });
    const s = new Session(new TableCalc({}), kv);
    await s.restore();
    expect(s.home[0]?.facts).toEqual({ exact: true, reliableDigits: null });
    expect(s.home[1]?.facts).toEqual({ exact: true, reliableDigits: null, items: [{ exact: true, reliableDigits: null, value: v("25") }] });
    expect(s.home[2]?.facts).toBeUndefined(); // neither exact nor exactRational: dropped, as before (no mark)
  });
});
