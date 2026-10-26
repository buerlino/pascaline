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

  // R80 fix round 1: Giac's distributions take a list-type argument as a polynomial and give wrong values (F95's family,
  // uniform_cdf(3.2,5.7,list[1,2]) = list[-0.88,-0.48], right {0,0}); until G111 such an argument is refused, as on phase-1
  it("a { } list in a distribution is refused, typed or stored", async () => {
    const refused = async (...entries: string[]): Promise<string> => {
      const s = new Session(calc, noKv);
      for (const e of entries) await s.submit(e);
      return (s.home[s.home.length - 1] as HistoryItem).status;
    };
    const CDF = "\\operatorname{uniform\\_cdf}";
    expect(await refused(`${CDF}\\left(3.2,5.7,\\left\\{1,2\\right\\}\\right)`)).toBe("error");
    expect(await refused(`L:=${LIST}`, `${CDF}\\left(3.2,5.7,L\\right)`)).toBe("error");
    expect(await refused(LIST, `${CDF}\\left(3.2,5.7,\\ans\\right)`)).toBe("error");
    expect(await refused(`${CDF}\\left(3.2,5.7,1\\right)`)).toBe("done");
    // a list of distribution values stays a list (its braces go as a vector, R80 fix 1), not refused
    expect(await refused(`\\left\\{${CDF}\\left(0,1,0.5\\right),2\\right\\}`)).toBe("done");
  });
});
