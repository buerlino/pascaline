// SPDX-License-Identifier: GPL-3.0-or-later
// G100 (F57, G72's and G66's cases): which inputs store comes from Giac's tree (bridge-2), and a stored program's
// stores are kept from its definition. Expected values: what Giac itself does (source: derived; probed with
// tools/probes/bridge-forms.ts: `increment(cnt)` raises cnt by 1 per call, `expr("q:=5")` stores q, `for k in L` leaves
// L's last element in k).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import type { GiacBridge } from "./bridge.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import type { DefChange } from "./defs.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { importLibrary, parseLibrary } from "./library.ts";
import { formOf, mayStore, programStores, writesThrough } from "./stores.ts";
import { isOurStore } from "./ourNames.ts";
import { EQ_DIFF, EQ_INEXACT_FLAG } from "./homeEval.ts";

const setsOf = (defs: DefChange[]): string[] => defs.flatMap((c) => ("set" in c ? [`${c.set.name}=${c.set.cmds.join(";")}`] : []));

/** N9's library file (docs/archive/bug-hunt-2026-10-19.md N9). */
const N9 = "// pascaline library 1\n// a counter\ncnt:=0\n// bumps the counter\nbump(x):={ increment(cnt); return x; }\n// drops beam\ndrop(x):={ DelVar(cnt); return x; }\n";

describe.skipIf(!giacAvailable())("G100: the stores of an input, from Giac's tree", () => {
  let host: EngineHost;
  let bridge: GiacBridge;
  const home = (input: string) => host.home(input, defaultHomeSettings);
  const value = (name: string) => host.eval(name).output;
  beforeAll(async () => {
    host = await nodeHost();
    bridge = (await loadNodeGiac()).bridge;
  });

  it("G72: N9's library file is refused (bump increments cnt, which is not local)", () => {
    expect(() => parseLibrary(N9, bridge.parse)).toThrow(/line 5: the body assigns cnt, which is not local/);
    const drop = "// pascaline library 1\n// drops\ndrop(x):={ DelVar(cnt); return x; }\n";
    expect(() => parseLibrary(drop, bridge.parse)).toThrow(/line 3: the body changes the engine's state \(DelVar\)/);
  });

  for (const [name, body] of [["bumpi", "increment(ci)"], ["bumpp", "ci++"], ["bumpe", "ci+=1"]] as const) {
    it(`G72: a stored function whose body runs ${body} runs once per Enter and logs ci`, () => {
      home("ci:=0");
      home(`${name}(x):={ ${body}; return x; }`);
      // floor(sqrt(2)) rests on a decision: before G100 it ran again at P + 20 and P + 40 (ci 3, nothing logged)
      const r = home(`${name}(floor(sqrt(2)))`);
      expect(r.result.display).toBe("1");
      expect(value("ci")).toBe("1");
      expect(setsOf(r.defs)).toEqual(["ci=ci:=(1)"]);
      home(`purge(ci,${name})`);
    });
  }

  it("audit fix 1: a body that stores into its own name runs once per Enter and is logged; a library refuses it", () => {
    home("fs(x):={ fs:=0; return x; }");
    // the bridge lists a target once: before the fix fs's kept stores were empty (its own name left out), so the call
    // ran again at P + 20 and the log kept the program while Giac held fs = 0
    const r = home("fs(floor(sqrt(2)))");
    expect(r.result.display).toBe("1");
    expect(value("fs")).toBe("0");
    expect(setsOf(r.defs)).toEqual(["fs=fs:=(0)"]);
    home("purge(fs)");
    expect(() => parseLibrary("// pascaline library 1\n// d\nf(x):={ f:=0; return x; }\n", bridge.parse)).toThrow(/line 3: the body assigns f, which is not local/);
  });

  it("G66: g3(1) logs n when g3 passes g, whose body stores n, as a value (map); runs once; credited to that input", () => {
    home("n:=0");
    home("g(t):={n:=n+1;return t;}");
    home("g3(t):=map([t],g)");
    // floor(sqrt(2)) rests on a decision: before G100 g3's call to g was not seen (no `g(`), so it ran again
    const r = home("g3(floor(sqrt(2)))");
    expect(r.result.display).toBe("[1]");
    expect(value("n")).toBe("1");
    expect(setsOf(r.defs)).toEqual(["n=n:=(1)"]);
    home("purge(n,g,g3)");
  });

  it("G66 guard (passes on phase-1 too): g2(1) logs n when g2 calls g, whose body stores n; credited to that input", () => {
    home("n:=0");
    home("g(t):={n:=n+1;return t;}");
    home("g2(t):=g(t)");
    const r = home("g2(1)");
    expect(value("n")).toBe("1");
    expect(setsOf(r.defs)).toEqual(["n=n:=(1)"]);
    const c = host.cas("g2(2)", defaultCasSettings);
    expect(value("n")).toBe("2");
    expect(setsOf(c.defs)).toEqual(["n=n:=(2)"]);
    home("purge(n,g,g2)");
  });

  it("text-5: a+=1 is a store (logged)", () => {
    home("a:=1");
    const r = home("a+=1");
    expect(value("a")).toBe("2");
    expect(setsOf(r.defs)).toEqual(["a=a:=(2)"]);
    home("purge(a)");
  });

  it("text-8 (a guard: refused on phase-1 too): a library body approx_mode(1) is refused; text-9: a string holding := is accepted", () => {
    const lib = (d: string) => `// pascaline library 1\n// d\n${d}\n`;
    expect(() => parseLibrary(lib("f(x):={ approx_mode(1); x }"), bridge.parse)).toThrow(/the body changes the engine's state \(approx_mode\)/);
    expect(parseLibrary(lib('f(x):={ local s; s:="a\\"b:=1"; x }'), bridge.parse).defs).toHaveLength(1);
  });

  it("a for-in loop stores its variable (Giac leaves the list's last element in it): logged, refused in a library", () => {
    const r = home("for kq in [1,2] do kq; od");
    expect(value("kq")).toBe("2");
    expect(setsOf(r.defs)).toEqual(["kq=kq:=(2)"]);
    home("purge(kq)");
    expect(() => parseLibrary("// pascaline library 1\n// d\nf(n):={ for k in [1,2] do n; od; return n; }\n", bridge.parse)).toThrow(/assigns k, which is not local/);
  });

  it("guard: expr(\"q:=5\") logs q (a head that evaluates a string keeps the full read)", () => {
    const r = home('expr("q:=5")');
    expect(value("q")).toBe("5");
    expect(setsOf(r.defs)).toEqual(["q=q:=(5)"]);
    home("purge(q)");
  });

  it("an imported library's program keeps its stores on its log entry; a call to it logs nothing", () => {
    const lib = "// pascaline library 1\n// adds\nlibadd(x):={ local s; s:=x+1; return s; }\n";
    const r = importLibrary(host, parseLibrary(lib, bridge.parse), []);
    expect(r.ok).toBe(true);
    const e = r.ok ? r.log.find((d) => d.name === "libadd") : undefined;
    expect(e?.stores).toEqual({ writes: [], calls: [] });
    const c = home("libadd(1)");
    expect(c.result.display).toBe("2");
    expect(c.defs).toEqual([]);
    home("purge(libadd)");
  });

  it("a restored program's stores are read again from its commands: a call runs once per Enter and is logged", async () => {
    // validDefs drops `stores`: after a relaunch keptOf reads them from cmds[0]; too little and F57 is back
    const fresh = await nodeHost();
    fresh.restore([
      { name: "ci", kind: "var", cmds: ["ci:=(0)"], preview: "0", view: "home", time: 0 },
      { name: "bumpi", kind: "fn", cmds: ["bumpi(x):={ increment(ci); return x; }"], preview: "", view: "home", time: 0 },
    ]);
    const r = fresh.home("bumpi(floor(sqrt(2)))", defaultHomeSettings);
    expect(r.result.display).toBe("1");
    expect(fresh.eval("ci").output).toBe("1");
    expect(setsOf(r.defs)).toEqual(["ci=ci:=(1)"]);
  });

  it("forms from the tree (G49f4: name:=x->body is an assignment of a variable)", () => {
    const none = () => false;
    const f = (t: string) => formOf(t, mayStore(t) ? bridge.parse(t) : null, none);
    expect(f("1+2")).toMatchObject({ stores: false, once: false, assignment: null });
    expect(f("a:=1")).toMatchObject({ stores: true, once: false, assignment: { name: "a", rhs: "1" }, defined: { name: "a", kind: "var" } });
    expect(f("pg:=x->x+pB")).toMatchObject({ assignment: { name: "pg" }, defined: { name: "pg", kind: "var" }, once: false });
    expect(f("x:=y:=3")).toMatchObject({ assignment: { name: "x", rhs: "y:=3" }, once: true });
    // audit fix 1: a value that stores into the assigned name itself runs once too
    expect(f("a:=(a:=a+1)")).toMatchObject({ assignment: { name: "a", rhs: "(a:=a+1)" }, once: true });
    expect(f("f(x):=x^2")).toMatchObject({ stores: true, once: true, defined: { name: "f", kind: "fn" }, noValue: true });
    expect(f("v=>w")).toMatchObject({ stores: true, defined: { name: "w", kind: "var" }, assignment: null });
    expect(f("L[2]:=5")).toMatchObject({ stores: true, assignment: null });
    expect(f("L[2]:=5").defined).toBeUndefined();
    expect(f("purge(c)")).toMatchObject({ stores: true, noValue: true });
    expect(f("assume(x>0)")).toMatchObject({ stores: true, noValue: true });
    expect(f("restart(1)")).toMatchObject({ stores: true });
    // our test helper's stores are not the user's
    expect(f(`(a_-b_))(sto(1,${EQ_INEXACT_FLAG})+sto(2,${EQ_DIFF}))`).stores).toBe(false);
    expect([isOurStore(EQ_INEXACT_FLAG), isOurStore(EQ_DIFF)]).toEqual([true, true]);
  });

  it("a program's kept stores leave out its parameters and locals (its own name only when the body does not store it); the walk goes through the programs it reads", () => {
    expect(programStores(bridge.parse("bump(x):={ increment(cnt); return x; }"))).toEqual({ writes: ["cnt"], calls: ["cnt"] });
    expect(programStores(bridge.parse("h(t):={local u; u:=t; DelVar(m); return u;}"))).toEqual({ writes: ["m", "DelVar("], calls: [] });
    expect(programStores(bridge.parse("f(x):={ assume(z>0); x }")).writes).toEqual(["assume("]);
    expect(programStores(bridge.parse("g2(t):=g(t)"))).toEqual({ writes: [], calls: ["g"] });
    expect(programStores(bridge.parse("f(x):={ f:=0; return x; }")).writes).toEqual(["f"]);
    expect(programStores(bridge.parse("f:=x->x+1")).writes).toEqual([]);
    const kept = (n: string) => (n === "g2" ? { writes: [], calls: ["g"] } : n === "g" ? { writes: ["n"], calls: ["n"] } : null);
    expect(writesThrough(["g2"], kept)).toBe(true);
    const loop = (n: string) => (n === "p" ? { writes: [], calls: ["q"] } : n === "q" ? { writes: [], calls: ["p"] } : null);
    expect(writesThrough(["p"], loop)).toBe(false);
  });
});
