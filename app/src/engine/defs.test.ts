// SPDX-License-Identifier: GPL-3.0-or-later
// The definitions log (docs/04 6.2) and the helpers the engine uses to build it and to check evalf(e,n) (M4-6).
import { describe, expect, it } from "vitest";
import { applyDefChanges, MAX_DEFS, replayOrder, userNamesOf, validDefs, type DefEntry } from "./defs.ts";
import { floatsAsEvalf } from "./homeEval.ts";
import { askedDigits, namesIn, withAskedPrecision } from "./numeric.ts";

const entry = (name: string, kind: DefEntry["kind"], cmd: string, extra: Partial<DefEntry> = {}): DefEntry => ({
  name,
  kind,
  cmds: [cmd],
  preview: "",
  view: "home",
  time: 0,
  ...extra,
});

describe("applyDefChanges", () => {
  it("keeps the last definition per name, at the end", () => {
    const log = applyDefChanges([], [{ set: entry("A", "var", "A:=(1)") }, { set: entry("B", "var", "B:=(2)") }, { set: entry("A", "var", "A:=(3)") }]);
    expect(log.map((e) => e.cmds[0])).toEqual(["B:=(2)", "A:=(3)"]);
  });
  it("a function and a variable of the same name replace each other; assume too", () => {
    const log = applyDefChanges([], [{ set: entry("f", "var", "f:=(1)") }, { set: entry("f", "fn", "f(x):=x") }, { set: entry("x", "assume", "assume(x>0)") }, { set: entry("x", "var", "x:=(5)") }]);
    expect(log.map((e) => `${e.name}:${e.kind}`)).toEqual(["f:fn", "x:var"]);
  });
  it("purge drops names but never the inputs kept as typed", () => {
    const log = applyDefChanges([], [{ set: entry("A", "var", "A:=(1)") }, { set: entry("", "other", "a,b:=1,2") }, { purge: ["A", "a"] }]);
    expect(log.map((e) => e.cmds[0])).toEqual(["a,b:=1,2"]);
  });
  it("inputs kept as typed are one entry per command", () => {
    const log = applyDefChanges([], [{ set: entry("", "other", "a,b:=1,2") }, { set: entry("", "other", "c,d:=1,2") }, { set: entry("", "other", "a,b:=1,2") }]);
    expect(log.map((e) => e.cmds[0])).toEqual(["c,d:=1,2", "a,b:=1,2"]);
  });
  it(`keeps at most ${MAX_DEFS} entries, dropping the oldest`, () => {
    const changes = Array.from({ length: MAX_DEFS + 3 }, (_, k) => ({ set: entry(`v${k}`, "var", `v${k}:=(${k})`) }));
    const log = applyDefChanges([], changes);
    expect(log).toHaveLength(MAX_DEFS);
    expect(log[0]!.name).toBe("v3");
  });
});

describe("replayOrder, validDefs, userNamesOf", () => {
  it("symbolic values go first, the rest keeps its order", () => {
    const log = [entry("A", "var", "A:=(5)"), entry("S", "var", "S:=(K*x+1)", { early: true }), entry("f", "fn", "f(x):=x")];
    expect(replayOrder(log).map((e) => e.name)).toEqual(["S", "A", "f"]);
  });
  it("stored data: entries with the right shape only", () => {
    const good = entry("A", "var", "A:=(5)", { facts: { reliableDigits: 11, warn: "unaudited" } });
    expect(validDefs([good, { name: "B" }, { ...good, kind: "nope" }, { ...good, name: "1x" }, { ...good, facts: { reliableDigits: "x" } }, null])).toEqual([good]);
    expect(validDefs("junk")).toEqual([]);
  });
  it("G49: `inexact` facts are kept; any other value of it drops the entry", () => {
    const v = entry("A", "var", "A:=(66743/500000000000000)", { facts: { reliableDigits: null, inexact: true } });
    expect(validDefs([v, { ...v, name: "B", facts: { reliableDigits: null, inexact: false } }])).toEqual([v]);
  });
  it("G49f1: a function keeps the facts it was built from", () => {
    const f = entry("q", "fn", "q(x):=x+899450126402", { facts: { reliableDigits: null, warn: "unchecked", inexact: true } });
    expect(validDefs(JSON.parse(JSON.stringify([f])))).toEqual([f]);
  });
  it("G34: a variable keeps the angle mode it was stored in; a wrong or foreign one is dropped", () => {
    const v = entry("A", "var", "A:=(5)", { angle: "deg" });
    const f = entry("f", "fn", "f(x):=x");
    expect(validDefs([v, { ...entry("B", "var", "B:=(1)"), angle: "grad" }, { ...f, angle: "deg" }])).toEqual([v, entry("B", "var", "B:=(1)"), f]);
  });
  it("Vars lists variables and functions, not assumptions or other inputs", () => {
    const log = [entry("A", "var", "A:=(5)"), entry("x", "assume", "assume(x>0)"), entry("f", "fn", "f(x):=x"), entry("", "other", "a,b:=1,2")];
    expect(userNamesOf(log).map((u) => `${u.name}:${u.kind}`)).toEqual(["A:var", "f:fn"]);
  });
});

describe("floatsAsEvalf", () => {
  it("floats come back with their digits in MPFR (at least 15), integers and names stay", () => {
    expect(floatsAsEvalf("[0.7468241328124270416001155918698308916810,2]")).toBe("[evalf((7468241328124270416001155918698308916810/10^40),40),2]");
    expect(floatsAsEvalf("0.123e401")).toBe("evalf((123*10^398),15)"); // a double literal would overflow
    expect(floatsAsEvalf("1.5*x+B2")).toBe("evalf((15/10^1),15)*x+B2");
  });
});

describe("evalf(e,n) in an input (decisions M4-6)", () => {
  it("withAskedPrecision rewrites the literal n of every evalf and approx, nested ones too", () => {
    expect(withAskedPrecision("evalf(pi,50)", (n) => n + 20)).toBe("evalf(pi,70)");
    expect(withAskedPrecision("1+approx(evalf(sqrt(2),20)*3, 30)-evalf(x)", (n) => n * 2)).toBe("1+approx(evalf(sqrt(2),40)*3,60)-evalf(x)");
    expect(withAskedPrecision('evalf(a,n)+"evalf(pi,5)"', () => 99)).toBe('evalf(a,n)+"evalf(pi,5)"');
    expect(withAskedPrecision("myevalf(pi,5)", () => 99)).toBe("myevalf(pi,5)");
  });
  it("askedDigits: only a lone evalf(e,n) or approx(e,n), 1 ≤ n ≤ 1000", () => {
    expect(askedDigits(" evalf(pi,50) ")).toBe(50);
    expect(askedDigits("approx(exp(1),30)")).toBe(30);
    expect(askedDigits("evalf(pi,50)+1")).toBeNull();
    expect(askedDigits("evalf(pi)")).toBeNull();
    expect(askedDigits("evalf(pi,5000)")).toBeNull();
    expect(askedDigits("evalf(pi,0)")).toBeNull();
  });
  it("namesIn: names that are not called, not exponents or strings", () => {
    expect(namesIn('B*2+f(x)-2e5+"C"+B_1')).toEqual(["B", "x", "B_1"]);
  });
});
