// SPDX-License-Identifier: GPL-3.0-or-later
// G65: the call after an input, as Giac prints it (texts from the pinned build, probe 2026-10-21); G99: the reads from
// Giac's tree.
import { describe, expect, it } from "vitest";
import { afterCall, changesOf, isOurs, parsePrinted, readsFrom, splitAfter, tableOf } from "./stateRead.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe("parsePrinted", () => {
  it("reads lists, atoms and strings whose quotes Giac doubles", () => {
    const n = parsePrinted(`[[w," (x)->{ \n  throw(""a """"b"""""");  \n}",[x]],'sto',[]]`)!;
    expect(n.items!.length).toBe(3);
    expect(n.items![0]!.items![1]!.str).toBe(` (x)->{ \n  throw("a ""b""");  \n}`);
    expect(n.items![1]!.raw).toBe("'sto'");
    expect(n.items![2]!.items).toEqual([]);
  });
  it("is null for a text that is not one value", () => {
    expect(parsePrinted("[1,2")).toBeNull();
    expect(parsePrinted("[1],[2]")).toBeNull();
  });
});

describe.skipIf(!giacAvailable())("readsFrom: the reads from Giac's tree (G99)", () => {
  const read = async (input: string) => readsFrom((await loadNodeGiac()).bridge.parse(input));
  it("a store reads its stored side, without a program's parameters", async () => {
    expect(await read("f(x,y):=x+y+a")).toEqual({ names: ["a"], targets: ["f"], fn: true });
    // y is set, not read: x takes the 3, never y's old value
    expect(await read("x:=y:=3")).toEqual({ names: [], targets: ["x"], fn: false });
  });
  it("L[k]:= also reads the target's names; a list store sets each name", async () => {
    expect(await read("L[k]:=b+1")).toEqual({ names: ["b", "L", "k"], targets: ["L"], fn: false });
    expect(await read("[a,b]:=[1,c]")).toEqual({ names: ["c"], targets: ["a", "b"], fn: false });
  });
  it("anything else reads every free name; a store inside is no top-level target", async () => {
    expect(await read("[sto(pA,pY),1]")).toEqual({ names: ["pA"], targets: [], fn: false });
    expect(await read("a;f(b)")).toEqual({ names: ["a", "f", "b"], targets: [], fn: false });
  });
});

describe("tableOf and changesOf", () => {
  const user = (n: string) => n === "pass";
  const t = (printed: string) => tableOf(parsePrinted(printed)!, user)!;
  it("keeps user names with a value, a program's parameters left out of its names", () => {
    const a = t(`[14,[[S,"y+pA0",[y,pA0]],[f," (x)->x+a",[x,a]],[m,"m",[m]],[pasdeg,"1",[]],[pass,"2",[]],[pasr_1,"3",[]]],12]`);
    expect([...a]).toEqual([
      ["S", { text: "y+pA0", names: ["y", "pA0"], fn: false }],
      ["f", { text: " (x)->x+a", names: ["a"], fn: true }],
      ["pass", { text: "2", names: [], fn: false }],
    ]);
    const b = t(`[14,[[S,"y+pA0",[y,pA0]],[pA0,"5",[]]],12]`);
    expect(changesOf(a, b)).toEqual({ changed: ["pA0"], removed: ["f", "pass"] });
  });
  it("names our own engine state as ours", () => {
    for (const n of ["pasr_1", "pasc_G", "pcasans", "pasdeg", "sigfig", "pasmedian", "pasinexact", "pasq0"]) expect(isOurs(n, user), n).toBe(true);
    expect(isOurs("pass", user)).toBe(false);
    expect(isOurs("S", user)).toBe(false);
  });
});

describe("afterCall and splitAfter", () => {
  it("puts the parts in one list and takes them apart", () => {
    expect(afterCall("[cas_setup()]", null)).toBe("[[cas_setup()],0]");
    const s = splitAfter(`[[[0,0],0],0]`)!;
    expect(s.flags).toBe("[[0,0],0]");
    expect(s.state.raw).toBe("0");
  });
});

describe.skipIf(!giacAvailable())("the state part on Giac (Opus pass 49's probe)", () => {
  it("reads a stored value one level deep, calls nothing and evaluates no further", async () => {
    const { giac } = await loadNodeGiac();
    for (const t of ["n:=0", "c:=g(y)", "g(t):={n:=n+1;return t;}", "y:=2", "a:=b", "b:=3"]) giac.eval(t);
    const s = splitAfter(giac.eval(afterCall("0", 12)))!;
    const table = tableOf(s.state, () => false)!;
    expect(table.get("c")?.text).toBe("g(y)");
    expect([...table.get("c")!.names].sort()).toEqual(["g", "y"]);
    expect(table.get("a")?.text).toBe("b");
    expect(table.get("a")?.names).toEqual(["b"]);
    expect(table.get("n")?.text).toBe("0");
    expect(giac.eval("n")).toBe("0");
  });
});
