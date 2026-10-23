// SPDX-License-Identifier: GPL-3.0-or-later
// G97 (backlog F69): a power, inverse or division of a non-square matrix is refused; a square matrix, a flat vector and
// the first power keep Giac's answer. Expected values are derived (the golden cases g97-* in home.yaml and precision.yaml).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { mayPowerMatrix } from "./nonsquare.ts";

describe("mayPowerMatrix", () => {
  it("needs an operator and a list or a name", () => {
    expect(mayPowerMatrix("[[5],[1]]^-1")).toBe(true);
    expect(mayPowerMatrix("A^2")).toBe(true);
    expect(mayPowerMatrix("inv(pasr_1)")).toBe(true);
    expect(mayPowerMatrix("1/3+2^64")).toBe(false);
    expect(mayPowerMatrix("sin(pi/6)")).toBe(false);
    expect(mayPowerMatrix("[1,2]+[3,4]")).toBe(false);
  });
});

describe.skipIf(!giacAvailable())("G97 on the real engine", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const { giac, bridge } = await loadNodeGiac();
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;

  it("refuses a stored non-square matrix to a power, and stores nothing", () => {
    expect(home("A:=[[5],[1]]")).toMatchObject({ ok: true });
    expect(home("A^2")).toMatchObject({ ok: false, error: "notSquare", display: "The matrix is not square" });
    expect(home("A^1")).toMatchObject({ ok: true, display: "[[5],[1]]" });
    expect(cas("B:=A^-1")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cas("B")).toMatchObject({ ok: true, text: "B" });
  });

  it("keeps a square matrix and a flat vector", () => {
    expect(cas("[[2,1],[1,-1]]^-1*[[5],[1]]")).toMatchObject({ ok: true, text: "[[2],[1]]" });
    expect(home("[1,2]^2")).toMatchObject({ ok: true, display: "5" });
  });
});

describe.skipIf(!giacAvailable())("G97 in the Num table", () => {
  let host: EngineHost;
  const calls: string[] = [];
  beforeAll(async () => {
    const { giac: real, bridge } = await loadNodeGiac();
    const spy: GiacApi = {
      eval: (input) => {
        calls.push(input);
        return real.eval(input);
      },
      setPowLimit: (l) => real.setPowLimit(l),
      messages: () => real.messages(),
      clearMessages: () => real.clearMessages(),
    };
    host = new EngineHost(spy, bridge);
  });

  it("a table of x^2 has no shape walk: Giac printed no warning", () => {
    calls.length = 0;
    const t = host.table({ fns: ["x^2"], xs: ["1", "2", "3"] }, defaultHomeSettings);
    expect(t.map((row) => row[0]!.display)).toEqual(["1", "4", "9"]); // derived: 1², 2², 3²
    expect(calls.some((c) => c.includes("quote("))).toBe(false);
  });

  it("a table of a non-square matrix to the power x still refuses the cell", () => {
    const t = host.table({ fns: ["[[5],[1]]^x"], xs: ["2"] }, defaultHomeSettings);
    // a cell's error is the table's "engine"; its text keeps the reason
    expect(t[0]![0]).toMatchObject({ ok: false, display: "The matrix is not square" });
  });
});
