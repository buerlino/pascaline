// SPDX-License-Identifier: GPL-3.0-or-later
// R91: a tidy chunk that will not load (a tab open across a redeploy: its old hashed file is gone) never turns a
// result the engine has finished into an error.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { homeResultToLatex } from "../render/home.ts";
import { Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

vi.mock("../render/tidy.ts", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

const kv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

class Calc extends FakeCalc {
  override ready = (): Promise<void> => Promise.resolve();
  hang = false;
  /** Once `hang` is set the names read back never answers, so what noteFunction recorded stays visible (as in session.test.ts, R56). */
  override names(): Promise<never[]> {
    return this.hang ? new Promise(() => {}) : Promise.resolve([]);
  }
  override home(): Promise<HomeOutcome> {
    // Giac's latex for the result is there (so tidyOr runs) and the display is not a number (so the formatter's fallback differs from the raw latex)
    return Promise.resolve({ ok: true, display: "x/2", latex: "\\frac{1}{2}", approximate: false, ...safePrecision("x/2") });
  }
  override cas(giac: string): Promise<CasOutcome> {
    return Promise.resolve({ ok: true, text: giac, latex: "\\frac{1}{2}", facts: { exact: false, reliableDigits: null } });
  }
}

describe("a tidy chunk that fails to load", () => {
  it("Home: the finished result stays done, drawn from our formatter, and the definition is noted", async () => {
    const calc = new Calc();
    const s = new Session(calc, kv);
    await new Promise((r) => setTimeout(r, 0));
    calc.hang = true;
    await s.submit("f(x):=x^2");
    const item = s.home[s.home.length - 1];
    expect(item?.status).toBe("done");
    expect(item?.text).toBe("x/2");
    expect(item?.resultLatex).toBe(homeResultToLatex("x/2"));
    expect(item?.resultLatex).not.toBe("\\frac{1}{2}");
    expect(s.userNames.map((u) => u.name)).toContain("f");
  });
  it("CAS: the finished result stays done, drawn from Giac's own latex, and the definition is noted", async () => {
    const calc = new Calc();
    const s = new Session(calc, kv);
    await new Promise((r) => setTimeout(r, 0));
    calc.hang = true;
    s.setView("cas");
    await s.submit("f(x):=x^2");
    const item = s.cas[s.cas.length - 1];
    expect(item?.status).toBe("done");
    expect(item?.resultLatex).toBe("\\frac{1}{2}");
    expect(s.userNames.map((u) => u.name)).toContain("f");
  });
});
