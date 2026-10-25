// SPDX-License-Identifier: GPL-3.0-or-later
// G92: the words, the read's parts and the put-back (assumed.ts), and the host's read after an input on a real Giac build
// (skipped when none is found, see nodeGiac.ts).
import { describe, expect, it } from "vitest";
import { aboutsOf, leakPart, namesAssuming, putBack, selfHolding, setsAssumption } from "./assumed.ts";
import { parsePrinted, statePart, tableOf } from "./stateRead.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import type { EngineHost } from "./host.ts";

const LEAK = "simplify(integrate(tanh(sqrt(x)),x))";

describe("assumed.ts", () => {
  it("names the commands that may leave an assumption, outside strings and as whole words", () => {
    expect(namesAssuming(LEAK)).toBe(true);
    expect(namesAssuming("fourier_an(x^2,x,2*pi,n,0)")).toBe(true);
    expect(namesAssuming("fourier_cn(x^2,x,2*pi,n,0)")).toBe(false);
    expect(namesAssuming("mysimplify(x)")).toBe(false);
  });
  it("sees an input that sets an assumption", () => {
    expect(setsAssumption("assume(x<0)")).toBe(true);
    expect(setsAssumption("additionally(x>0)")).toBe(true);
    expect(setsAssumption("about(x)")).toBe(false);
  });
  it("reads a leak part's print: the names that hold only themselves and the about()s asked", () => {
    expect(leakPart(["a"], ["y"])).toBe("[0,map(VARS(),k->when(member(k,['a']),k,[k,string(eval(k))])),[about(y)],0]");
    const n = parsePrinted('[0,[a,[x,"x"],[b,"2"]],[assume[[],[line[0,3]],[0,3]]],0]')!;
    expect(selfHolding(n)).toEqual(["x"]);
    expect(aboutsOf(n, 1)).toEqual(["assume[[],[line[0,3]],[0,3]]"]);
    expect(aboutsOf(n, 2)).toBeNull();
  });
  it("puts the about()s inside the state part, which tableOf still reads", () => {
    expect(statePart(12, ["x"])).toBe("[(Digits:=14),map(VARS(),k->[k,string(eval(k)),lname(eval(k))]),[about(x)],(Digits:=12)]");
    const n = parsePrinted('[14,[[x,"x",[x]],[b,"2",[]]],[assume[integer]],12]')!;
    expect([...tableOf(n, () => false)!.keys()]).toEqual(["b"]);
    expect(aboutsOf(n, 1)).toEqual(["assume[integer]"]);
  });
  it("puts back in one text", () => {
    expect(putBack(["n"], [{ name: "x", cmds: ["assume(x<0)"] }])).toBe("purge(n);purge(x);assume(x<0)");
  });
});

describe.skipIf(!giacAvailable())("an assumption Giac leaves (real Giac)", () => {
  const cas = (h: EngineHost, t: string): string => h.cas(t, defaultCasSettings).result.text;
  const about = (h: EngineHost, n: string): string => h.giac.eval(`about(${n})`);

  it("a CAS simplify leaves no assumption and logs nothing", async () => {
    const h = await nodeHost();
    const r = h.cas(LEAK, defaultCasSettings);
    expect(r.defs).toEqual([]);
    expect(about(h, "x")).toBe("x");
    expect(h.home("solve(x^2=4,x)", defaultHomeSettings).result.display).toBe("[-2,2]");
  });
  it("a logged assumption the leak replaced is set again; the user's own purge stays", async () => {
    const h = await nodeHost();
    cas(h, "assume(x<0)");
    cas(h, LEAK);
    expect(cas(h, "sqrt(x^2)")).toBe("-x");
    cas(h, "purge(x)");
    expect(about(h, "x")).toBe("x");
    expect(cas(h, "sqrt(x^2)")).toBe("abs(x)");
  });
  it("fourier_an's assume(n,integer) goes", async () => {
    const h = await nodeHost();
    cas(h, "fourier_an(x^2,x,2*pi,n,0)");
    expect(about(h, "n")).toBe("n");
  });
  it("a stored function that assumes keeps what it set", async () => {
    const h = await nodeHost();
    cas(h, "g92h():=assume(z>0)");
    cas(h, "g92h()");
    expect(cas(h, "sqrt(z^2)")).toBe("z");
  });
  it("an input that names no such command reads nothing more", async () => {
    const h = await nodeHost();
    const texts: string[] = [];
    const ev = h.giac.eval;
    (h.giac as { eval: (t: string) => string }).eval = (t: string) => (texts.push(t), ev(t));
    cas(h, "factor(x^4-1)");
    h.home("sqrt(2)", defaultHomeSettings);
    expect(texts.filter((t) => t.includes("VARS()") || t.includes("about("))).toEqual([]);
  });
});
