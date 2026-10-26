// SPDX-License-Identifier: GPL-3.0-or-later
// R80 (backlog F77, F79, F82): a typed `{ }` list goes to Giac as its list type, `list[…]`, so a list stored by name or
// held in Ans stays a list and is elementwise in every operator, as a typed one is. Real engine through EngineCalc and
// the Session (skipped without a Giac build). Expected values derived by hand: {1,4}² = {1,16}, {1,4}+1 = {2,5},
// sum = 7, mean = 3.5, 2÷{1,4} = {2,0.5}. Golden r80-* in tests/golden/home.yaml are the same sequences.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import type { MathEngine } from "../engine/types.ts";
import { Session, type HistoryItem } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

const noKv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

/** Home answered in-process by an EngineHost (no worker), with the chip table (Ans). */
function inProcess(host: EngineHost): MathEngine {
  const engine: Pick<MathEngine, "home" | "cas"> = {
    home: (input, s, consts, chips) => Promise.resolve(host.home(input, s, consts, chips).result),
    cas: (input, s) => Promise.resolve(host.cas(input, s).result),
  };
  return engine as MathEngine;
}

const LIST = "\\left\\{1,4\\right\\}";

describe.skipIf(!giacAvailable())("a stored { } list stays a list (R80, real engine)", () => {
  let calc: EngineCalc;
  beforeAll(async () => {
    calc = new EngineCalc(inProcess(await nodeHost()));
  });

  /** Each entry in turn in one Home session; the last row's text and mark. */
  const run = async (...entries: (string | [string, string])[]): Promise<{ text: string; mark: string | null }> => {
    const s = new Session(calc, noKv);
    for (const e of entries) {
      const [latex, giac] = typeof e === "string" ? [e, undefined] : e;
      await s.submit(latex, giac);
      const item = s.home[s.home.length - 1] as HistoryItem;
      expect(item.status, latex).toBe("done");
    }
    const last = s.home[s.home.length - 1] as HistoryItem;
    return { text: last.text, mark: s.mark(last)?.mark ?? null };
  };

  it("a list stored with := is elementwise in x², ×, sum, mean and ÷", async () => {
    const L = `L:=${LIST}`;
    expect(await run(L, "L^{2}")).toEqual({ text: "{1,16}", mark: "=" });
    expect(await run(L, "L\\times L")).toEqual({ text: "{1,16}", mark: "=" });
    expect(await run(L, "\\operatorname{sum}\\left(L+1\\right)")).toEqual({ text: "7", mark: "=" });
    expect(await run(L, "\\operatorname{mean}\\left(L+1\\right)")).toEqual({ text: "3.5", mark: "=" });
    expect(await run(L, "2\\div L")).toEqual({ text: "{2,0.5}", mark: "=" });
  });

  it("a list held in Ans squares elementwise", async () => {
    expect(await run(LIST, "\\ans^{2}")).toEqual({ text: "{1,16}", mark: "=" });
  });

  it("a list stored with ▶ adds a number elementwise", async () => {
    expect(await run(`${LIST}\\blacktriangleright K`, "K+1")).toEqual({ text: "{2,5}", mark: "=" });
  });

  it("guards: a stored [ ] vector keeps the dot product, and dot of two lists is a number", async () => {
    // a vector is typed as Giac text (the entry refuses square brackets); owner, 2026-10-22: [1,4]² = 17
    expect(await run(["V:=[1,4]", "V:=[1,4]"], "V^{2}")).toEqual({ text: "17", mark: "=" });
    expect(await run(`\\operatorname{dot}\\left(${LIST},${LIST}\\right)`)).toEqual({ text: "17", mark: "=" });
  });

  it("typed lists keep R77–R79's values", async () => {
    expect((await run(`${LIST}^{2}`)).text).toBe("{1,16}");
    expect((await run(`${LIST}+1`)).text).toBe("{2,5}");
    expect((await run(`${LIST}\\times\\left\\{1,1\\right\\}`)).text).toBe("{1,4}");
    expect((await run(`\\left(${LIST}+1\\right)^{2}`)).text).toBe("{4,25}");
  });

  // R80f1: G111's patch 0007 maps a list-type x per element, so R80 fix 1's refusal went; a list read as the argument list
  // (normald_cdf({0.5,1.5}) = P(0.5 ≤ X ≤ 1.5)) and negbinomial_icdf's wrong answer stay refused (listargs.ts)
  it("a { } list in a distribution is one value per element, typed or stored", async () => {
    const last = async (...entries: string[]): Promise<HistoryItem> => {
      const s = new Session(calc, noKv);
      for (const e of entries) await s.submit(e);
      return s.home[s.home.length - 1] as HistoryItem;
    };
    const CDF = "\\operatorname{uniform\\_cdf}";
    const L12 = "\\left\\{1,2\\right\\}";
    // 3.2 ≤ x ≤ 5.7 holds for neither 1 nor 2, so both cdf values are 0
    expect(await run(`${CDF}\\left(3.2,5.7,${L12}\\right)`)).toEqual({ text: "{0,0}", mark: "=" });
    expect(await run(`L:=${L12}`, `${CDF}\\left(3.2,5.7,L\\right)`)).toEqual({ text: "{0,0}", mark: "=" });
    expect(await run(L12, `${CDF}\\left(3.2,5.7,\\ans\\right)`)).toEqual({ text: "{0,0}", mark: "=" });
    // binomial(5,2) = 10 times each element
    expect(await run(`L:=${LIST}`, "L\\times\\operatorname{binomial}\\left(5,2\\right)")).toEqual({ text: "{10,40}", mark: "=" });
    // 1 + Φ(1) and 2 + Φ(1): a list of two values, Φ(1) ≈ 0.841344746069
    // both values went through the numeric path at two precisions, so the list is ≈, never =
    expect(await run(`${L12}+\\operatorname{normald\\_cdf}\\left(1\\right)`)).toEqual({ text: "{1.84134474607,2.84134474607}", mark: "≈" });
    // a list as the only argument is Giac's argument list (P(0.5 ≤ X ≤ 1.5) = 0.2417…), refused
    expect(await last("\\operatorname{normald\\_cdf}\\left(\\left\\{0.5,1.5\\right\\}\\right)")).toMatchObject({ status: "error" });
    // negbinomial_icdf(3,0.5,list[0.2,0.7]) = 0, right {1,4}: refused
    expect(await last("\\operatorname{negbinomial\\_icdf}\\left(3,0.5,\\left\\{0.2,0.7\\right\\}\\right)")).toMatchObject({ status: "error" });
  });
});
