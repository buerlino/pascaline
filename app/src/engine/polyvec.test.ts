// SPDX-License-Identifier: GPL-3.0-or-later
// G106 (backlog F78): Giac's polynomial of a list plus a number (`[1,4]+1` = poly1[1,5]) is refused in Home and CAS when
// the input asked for no polynomial; one that asked for one keeps it. Expected values are derived (golden g106-*).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { asksPoly, mayAddToList, printsPoly, unaskedPoly } from "./polyvec.ts";

const MESSAGE = "A list plus a number: use .+ or add a list of the same length";

describe("text tests", () => {
  it("reads poly1[, and the functions that ask for one", () => {
    expect(printsPoly("poly1[1,5]")).toBe(true);
    expect(printsPoly("[1,5]")).toBe(false);
    expect(asksPoly("symb2poly(x^2+1)*2")).toBe(true);
    expect(asksPoly("[1,4]+1")).toBe(false);
    expect(asksPoly("[1,4]+1+diff(x,x)*0")).toBe(false);
    expect(mayAddToList("[1,4]+1", () => false)).toBe(true);
    expect(mayAddToList("L+1", (n) => n === "L")).toBe(true);
    expect(mayAddToList("a+1", () => false)).toBe(false);
  });
});

describe.skipIf(!giacAvailable())("G106 on the real engine", () => {
  let host: EngineHost;
  let calls = 0;
  beforeAll(async () => {
    const real: GiacApi = (await loadNodeGiac()).giac;
    const spy: GiacApi = {
      eval: (input) => {
        calls++;
        return real.eval(input);
      },
      setPowLimit: (l) => real.setPowLimit(l),
      messages: () => real.messages(),
      clearMessages: () => real.clearMessages(),
    };
    host = new EngineHost(spy);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;

  it("refuses a list plus a number in Home", () => {
    expect(home("[1,4]+1")).toMatchObject({ ok: false, error: "listPlusNumber", display: MESSAGE });
    expect(home("[1,4]*2+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("L:=[1,2]")).toMatchObject({ ok: true, display: "[1,2]" });
    expect(home("L+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
  });

  it("stores nothing for a refused assignment", () => {
    expect(home("M:=[1,4]+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(cas("N:=[1,4]+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("[M,N]")).toMatchObject({ ok: true, display: "[M,N]" });
  });

  it("refuses a list plus a number in CAS", () => {
    expect(cas("[1,4]+1")).toMatchObject({ ok: false, error: "listPlusNumber", text: MESSAGE });
    expect(cas("[1,4]*2+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(cas("L+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
  });

  it("keeps a polynomial the input asked for", () => {
    expect(home("symb2poly(x^2+1)")).toMatchObject({ ok: true, display: "poly1[1,0,1]" });
    expect(cas("symb2poly(x^2+1)")).toMatchObject({ ok: true, text: "poly1[1,0,1]" });
    expect(home("P:=symb2poly(x^2+1)")).toMatchObject({ ok: true });
    expect(home("P+1")).toMatchObject({ ok: true, display: "poly1[1,0,2]" });
    expect(home("[1,4]+[1,1]")).toMatchObject({ ok: true, display: "[2,5]" });
    expect(home("g(x):=symb2poly(x)")).toMatchObject({ ok: true });
    expect(home("g(x^2+1)")).toMatchObject({ ok: true, display: "poly1[1,0,1]" });
  });

  it("refuses a list of them", () => {
    expect(home("[[1,4]+1,[1,2]]")).toMatchObject({ ok: false, error: "listPlusNumber" });
  });

  // G106f1: the old test read the subtype one level deep (max of the elements'), so these showed poly1[1,5] under =
  it("refuses one at any depth", () => {
    expect(home("[[[1,4]+1]]")).toMatchObject({ ok: false, error: "listPlusNumber", display: MESSAGE });
    expect(cas("[[[1,4]+1]]")).toMatchObject({ ok: false, error: "listPlusNumber", text: MESSAGE });
    expect(home("[[1,2],[3,[4,[5]+1]]]")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("L:=[1,4]")).toMatchObject({ ok: true, display: "[1,4]" });
    expect(home("[[L+1]]")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(cas("[[L+1]]")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("[[[1,4]]]")).toMatchObject({ ok: true, display: "[[[1,4]]]" });
  });

  it("refuses a passing-through function's sum, which asks for no polynomial", () => {
    expect(home("[1,4]+1+diff(x,x)*0")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(cas("[1,4]+1+diff(x,x)*0")).toMatchObject({ ok: false, error: "listPlusNumber" });
  });

  it("costs one engine call, and none without poly1[", () => {
    const giac = (host as unknown as { giac: GiacApi }).giac;
    expect(giac.eval("pasans:=[1,4]+1")).toBe("poly1[1,5]");
    // the first use defines the helper (two more calls), once per session
    unaskedPoly(giac, "pasans", "[1,4]+1", "poly1[1,5]", () => false);
    calls = 0;
    expect(unaskedPoly(giac, "pasans", "[1,4]+1", "poly1[1,5]", () => false)).toBe(true);
    expect(calls).toBe(1);
    calls = 0;
    expect(unaskedPoly(giac, "pasans", "[1,4]+[1,1]", "[2,5]", () => false)).toBe(false);
    expect(calls).toBe(0);
    // tools/probes/engine-calls.ts on phase-1 (c8b4723): Home `[1,4]+1` made 5 calls per Enter; at most one more now
    // (the first Enter after a CAS input also sets Home's mode up, so it is not counted)
    home("[1,4]+1");
    calls = 0;
    home("[1,4]+1");
    expect(calls).toBeLessThanOrEqual(5 + 1);
  });
});
