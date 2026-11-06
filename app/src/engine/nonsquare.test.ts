// SPDX-License-Identifier: GPL-3.0-or-later
// G97 (backlog F69): a power, inverse or division of a non-square matrix is refused; a square matrix, a flat vector and
// the first power keep Giac's answer. Expected values are derived (the golden cases g97-* in home.yaml and precision.yaml).
import { engineGiac } from "./nodeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, type GiacApi } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { mayPowerMatrix, NO_BODIES, nonSquarePower, type Bodies } from "./nonsquare.ts";

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

// G103 fix round 1 (audit 5): the walks read the tree through bridge-3 and define no name in Giac; on the branch before
// the fix they called our program pastree, which a user's pastree:=5 replaced, so both walks found nothing. Expected
// values: G97's refusal (g97-* golden cases) and F51's 1/(1/0) (novalue.ts).
describe.skipIf(!giacAvailable())("G103 the walks after a user's pastree:=5", () => {
  it("still refuses a non-square power and a division by zero", async () => {
    const host = await nodeHost();
    const home = (input: string) => host.home(input, defaultHomeSettings).result;
    expect(home("pastree:=5")).toMatchObject({ ok: true, display: "5" });
    expect(home("[[1,2,3]]^2")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("1/(1/0)")).toMatchObject({ ok: false, error: "divisionByZero" });
    expect(host.cas("pastree:=5", defaultCasSettings).result).toMatchObject({ ok: true });
    expect(host.cas("[[1,2,3]]^2", defaultCasSettings).result).toMatchObject({ ok: false, error: "notSquare" });
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

// G101 (backlog F74): the power sits in a called function's body. Source: derived (as G97's: f([[5],[1]]) is
// [[5],[1]]^-1, a power of a non-square matrix; f([[1,2],[3,4]]) is the inverse, Giac's own answer, as G97's square case).
describe.skipIf(!giacAvailable())("G101 a stored function's body", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const { giac, bridge } = await loadNodeGiac();
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;

  it("refuses f([[5],[1]]) for f(x):=x^-1 in CAS and Home", () => {
    expect(cas("f(x):=x^-1")).toMatchObject({ ok: true });
    expect(cas("f([[5],[1]])")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("f([[5],[1]])")).toMatchObject({ ok: false, error: "notSquare" });
  });

  it("refuses one level deeper, g(x):=f(x)", () => {
    expect(cas("g(x):=f(x)")).toMatchObject({ ok: true });
    expect(cas("g([[5],[1]])")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("g([[5],[1]])")).toMatchObject({ ok: false, error: "notSquare" });
  });

  it("keeps the inverse of a square matrix", () => {
    expect(cas("f([[1,2],[3,4]])")).toMatchObject({ ok: true, text: "[[-2,1],[3/2,-1/2]]" });
  });

  it("binds each parameter, and a stored x does not leak into the body", () => {
    expect(cas("h(x,y):=x^y")).toMatchObject({ ok: true });
    expect(cas("h([[5],[1]],2)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cas("h([[5],[1]],1)")).toMatchObject({ ok: true, text: "[[5],[1]]" });
    expect(cas("x:=3")).toMatchObject({ ok: true });
    expect(home("f([[5],[1]])")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cas("purge(x)")).toMatchObject({ ok: true });
  });

  // G101 fix 1: a local or a loop variable is no parameter; the body is not walked, so the global of the same name is
  // never read for it. Derived: inv([[1,2],[3,4]]) = [[-2,1],[3/2,-1/2]] (det -2); in the loop k is 1, so the matrix
// inverted is x = [[1,2],[3,4]] (the global k, 2, would pick [[1],[2]]).
  it("a local of the same name as a non-square global keeps the inverse", () => {
    expect(cas("y:=[[1],[2]]")).toMatchObject({ ok: true });
    expect(cas("p(x):={local y; y:=[[1,2],[3,4]]; return inv(y);}")).toMatchObject({ ok: true });
    expect(cas("p(5)")).toMatchObject({ ok: true, text: "[[-2,1],[3/2,-1/2]]" });
    expect(home("p(5)")).toMatchObject({ ok: true });
    expect(cas("purge(y)")).toMatchObject({ ok: true });
  });

  it("a loop variable is not read from the global of the same name", () => {
    expect(cas("k:=2")).toMatchObject({ ok: true });
    expect(cas("r(x):={local s,k; s:=0; for k from 1 to 1 do s:=inv(when(k==1,x,[[1],[2]])); od; return s;}")).toMatchObject({ ok: true });
    expect(cas("r([[1,2],[3,4]])")).toMatchObject({ ok: true, text: "[[-2,1],[3/2,-1/2]]" });
    expect(home("r([[1,2],[3,4]])")).toMatchObject({ ok: true });
    expect(cas("purge(k)")).toMatchObject({ ok: true });
  });
});

// G101f1 (backlog F84): bridge-2's tree writes both a/b and inv(M) as the head "/", and a body's heads are read also
// when the typed text has an operator of its own. Derived: A = [[5],[1]] is 2x1, so inv(A), 2/A (2·inv(A)) and A^2 are
// powers of a non-square matrix (G97); B = [[1,2],[3,4]] (det -2) has inv(B) = [[-2,1],[3/2,-1/2]], 2·inv(B) =
// [[-4,2],[3,-1]], and w(3) = 3^2 = 9.
describe.skipIf(!giacAvailable())("G101f1 a body's division, and a body next to a typed operator", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const { giac, bridge } = await loadNodeGiac();
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;

  it("refuses v(A) for v(M):=inv(M) and u(A) for u(M):=2/M, in Home and CAS", () => {
    expect(cas("A:=[[5],[1]]")).toMatchObject({ ok: true });
    expect(cas("v(M):=inv(M)")).toMatchObject({ ok: true });
    expect(cas("u(M):=2/M")).toMatchObject({ ok: true });
    expect(cas("v(A)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("v(A)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cas("u(A)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("u(A)")).toMatchObject({ ok: false, error: "notSquare" });
  });

  it("refuses w(A)+inv(B) for w(M):=M^2, in Home and CAS", () => {
    expect(cas("B:=[[1,2],[3,4]]")).toMatchObject({ ok: true });
    expect(cas("w(M):=M^2")).toMatchObject({ ok: true });
    expect(cas("w(A)+inv(B)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(home("w(A)+inv(B)")).toMatchObject({ ok: false, error: "notSquare" });
  });

  it("keeps v(B), u(B) and w(3)", () => {
    expect(cas("v(B)")).toMatchObject({ ok: true, text: "[[-2,1],[3/2,-1/2]]" });
    expect(cas("u(B)")).toMatchObject({ ok: true, text: "[[-4,2],[3,-1]]" });
    expect(cas("w(3)")).toMatchObject({ ok: true, text: "9" });
    expect(home("w(3)")).toMatchObject({ ok: true, display: "9" });
  });
});

// G101 fix 3: binding a call's arguments evaluates them again; not when that could take the walk past its budget.
describe.skipIf(!giacAvailable())("G101 the walk's time budget", () => {
  const known: Bodies = { reads: () => ["pasf"], of: (n) => (n === "pasf" ? { params: ["x"], reads: [], heads: ["program", "^"] } : undefined) };
  it("evaluates no argument once an evaluation could pass WALK_BUDGET_MS", async () => {
    const real = engineGiac(await loadNodeGiac());
    const calls: string[] = [];
    const spy = { ...real, eval: (t: string) => (calls.push(t), real.eval(t)) };
    real.eval("pasf(x):=x^-1");
    try {
      expect(nonSquarePower(spy, "pasf([[5],[1]])", "[[1/5],[1]]", true, () => false, 0, () => false, known)).toBe(true);
      calls.length = 0;
      expect(nonSquarePower(spy, "pasf([[5],[1]])", "[[1/5],[1]]", true, () => false, 501, () => false, known)).toBe(false);
      expect(calls.some((c) => c.includes("eval("))).toBe(false);
    } finally {
      real.eval("purge(pasf)");
    }
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

// G171 (backlog F88): an input that runs once (it calls g, which stores) keeps G97's refusal for a part that calls
// nothing and reads nothing the run wrote, and is never `=` for a part it cannot evaluate. Source: derived (as G97's: A =
// [[1,2,3]] is 1x3, so A², A⁻¹ and 2/A have no value; g(M) and h(M) return M, so g(A)^2 is A^2; [[1,2],[3,4]]² =
// [[7,10],[15,22]] and 2² = 4). Each input runs once: cnt rises by 1.
describe.skipIf(!giacAvailable())("G171 a non-square power next to a call of a program that stores", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const { giac, bridge } = await loadNodeGiac();
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  const cnt = (): number => Number(cas("cnt").text);
  const setup = () => {
    for (const d of ["cnt:=0", "g(M):={cnt:=cnt+1;return M;}", "h(M):=M", "A:=[[1,2,3]]"]) expect(cas(d)).toMatchObject({ ok: true });
  };

  it("guards: g(2)^2 = 4 exact, a square matrix kept, h([[1,2,3]])^2 refused", () => {
    setup();
    expect(home("g(2)^2")).toMatchObject({ ok: true, display: "4", approximate: false });
    expect(cnt()).toBe(1);
    expect(home("g([[1,2],[3,4]])^2")).toMatchObject({ ok: true, display: "[[7,10],[15,22]]" });
    expect(cas("g([[1,2],[3,4]])^2")).toMatchObject({ ok: true, text: "[[7,10],[15,22]]" });
    expect(home("h([[1,2,3]])^2")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cas("h([[1,2,3]])^2")).toMatchObject({ ok: false, error: "notSquare" });
  });

  it("refuses A^2+g(1) and h([[1,2,3]])^2+g(1), running each once", () => {
    setup();
    expect(home("A^2+g(1)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cnt()).toBe(1);
    expect(cas("A^2+g(1)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cnt()).toBe(2);
    expect(home("h([[1,2,3]])^2+g(1)")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cnt()).toBe(3);
  });

  it("refuses inv(g(A)) and 2/g(A) by the answer's shape, in Home and CAS", () => {
    setup();
    for (const [input, n] of [["inv(g(A))", 1], ["2/g(A)", 2], ["g(A)^3", 3]] as const) {
      expect(home(input)).toMatchObject({ ok: false, error: "notSquare" });
      expect(cnt()).toBe(2 * n - 1);
      expect(cas(input)).toMatchObject({ ok: false, error: "notSquare" });
      expect(cnt()).toBe(2 * n);
    }
  });

  it("g(A)^2 is ⚠, never = (Giac's 14 is a dot product; the warning cannot tell a flat vector)", () => {
    setup();
    const r = home("g(A)^2");
    expect(r).toMatchObject({ ok: true, display: "14", approximate: true, facts: { exact: false, warn: "unchecked", why: { once: true } } });
    expect(cnt()).toBe(1);
    expect(cas("g(A)^2")).toMatchObject({ ok: true, text: "14", approximate: true, facts: { warn: "unchecked", why: { once: true } } });
    expect(cnt()).toBe(2);
  });

  it("a refused store in CAS keeps no value: B:=inv(g(A))", () => {
    setup();
    expect(cas("B:=inv(g(A))")).toMatchObject({ ok: false, error: "notSquare" });
    expect(cnt()).toBe(1);
    expect(cas("B")).toMatchObject({ ok: true, text: "B" });
  });
});

// G171 (F88): a candidate read as Giac prints the part, not as a string, so its call of g is seen and g is not run
// again. No input reaches this on phase-1 through the host (an input calling a program that stores ran once and was not
// walked), so the walk is called directly. Derived: g(A) is A = [[1,2,3]], 1x3; Giac's g(A)^2 is 14.
describe.skipIf(!giacAvailable())("G171 F88 the candidate filter", () => {
  it("does not evaluate a candidate that calls a function of the user's", async () => {
    const giac = engineGiac(await loadNodeGiac());
    giac.eval("pask:=0");
    giac.eval("pasg(M):={pask:=pask+1;return M;}");
    giac.eval("pasA:=[[1,2,3]]");
    try {
      expect(nonSquarePower(giac, "pasg(pasA)^2", "14", true, () => false, 0, (n) => n === "pasg", NO_BODIES)).toBe("unchecked");
      expect(giac.eval("pask").trim()).toBe("0");
      expect(nonSquarePower(giac, "inv(pasg(pasA))", "[[1,1/2,1/3]]", undefined, () => false, 0, (n) => n === "pasg", NO_BODIES)).toBe(true);
      expect(giac.eval("pask").trim()).toBe("0");
    } finally {
      giac.eval("purge(pask,pasg,pasA)");
    }
  });

  // A program with a local has no known body (G101): its call in a candidate is not run again, so p(A)^2 is ⚠ (phase-1
  // ran it again through the string and refused); inv(p(A)) is still refused by the answer's shape.
  it("a candidate that calls a program with a local is ⚠ in Home and CAS", async () => {
    const { giac, bridge } = await loadNodeGiac();
    const host = new EngineHost(giac, bridge);
    expect(host.cas("A:=[[1,2,3]]", defaultCasSettings).result).toMatchObject({ ok: true });
    expect(host.cas("p(M):={local t; t:=M; return t;}", defaultCasSettings).result).toMatchObject({ ok: true });
    expect(host.home("p(A)^2", defaultHomeSettings).result).toMatchObject({ ok: true, display: "14", approximate: true, facts: { warn: "unchecked" } });
    expect(host.cas("p(A)^2", defaultCasSettings).result).toMatchObject({ ok: true, text: "14", approximate: true });
    expect(host.home("inv(p(A))", defaultHomeSettings).result).toMatchObject({ ok: false, error: "notSquare" });
  });
});
