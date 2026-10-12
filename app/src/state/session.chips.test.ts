// SPDX-License-Identifier: GPL-3.0-or-later
// Chips and Ans in the session (docs/04 2.8): what a result carries, Ans read at Enter, chip tables stored with
// the entry and read back with their shape checked. The engine is a stub that records the Giac text it gets.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { Calc, CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
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
    return Promise.resolve({ ok: true, text: giac, latex: giac });
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
    expect(s.chipFor(s.home[0] as HistoryItem)).toEqual({ value: "1.41421356237", exact: false });
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
