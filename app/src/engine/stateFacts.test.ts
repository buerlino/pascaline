// SPDX-License-Identifier: GPL-3.0-or-later
// G65 (S13, R15): the names an input set come from Giac's state, so the definitions log holds every one of them and no
// line kept as typed (F58), and Solve's own changes to stored names are not credited to the next input.
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { applyDefChanges, type DefChange, type DefEntry } from "./defs.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { parsePrinted, statePart, tableOf, type StoredName } from "./stateRead.ts";

describe.skipIf(!giacAvailable())("G65: stored names from Giac's state", () => {
  const fresh = async () => (await nodeHost());

  it("x:=y:=3 logs x and y as values; purging both leaves nothing to replay (F58)", async () => {
    const host = await fresh();
    const defs: DefChange[] = [];
    const first = host.cas("x:=y:=3", defaultCasSettings).defs;
    expect(first.flatMap((d) => ("set" in d ? [[d.set.name, d.set.kind, d.set.cmds]] : []))).toEqual([
      ["x", "var", ["x:=(3)"]],
      ["y", "var", ["y:=(3)"]],
    ]);
    defs.push(...first, ...host.cas("purge(x)", defaultCasSettings).defs, ...host.cas("purge(y)", defaultCasSettings).defs);
    expect(applyDefChanges([], defs)).toEqual([]);
  });

  it("a called program's global is logged, with the facts of what the call read", async () => {
    const host = await fresh();
    host.home("sto(floor(sin(10^100)*10^12),pA)", defaultHomeSettings);
    host.home("setg(v):={gl:=v; return 1;}", defaultHomeSettings);
    const defs = host.home("setg(pA)", defaultHomeSettings).defs;
    const gl = defs.flatMap((d) => ("set" in d && d.set.name === "gl" ? [d.set] : []))[0];
    expect(gl?.cmds).toEqual(["gl:=(899450126402)"]);
    expect(gl?.facts?.warn).toBe("unchecked");
  });

  it("guard (passes on phase-1 too, by its text rule): a store that prints the value it replaces still takes the input's facts", async () => {
    const host = await fresh();
    host.home("pB:=899450126402", defaultHomeSettings);
    const defs = host.home("sto(floor(sin(10^100)*10^12),pB)", defaultHomeSettings).defs;
    expect(defs.flatMap((d) => ("set" in d ? [d.set.facts?.warn] : []))).toEqual(["unchecked"]);
    expect(host.home("pB+1", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });

  it("a restore fills the table: a name replayed lends its facts through a symbolic value", async () => {
    const host = await fresh();
    const defs = [
      ...host.home("S:=y+pA0", defaultHomeSettings).defs,
      ...host.home("sto(floor(sin(10^100)*10^12),pA0)", defaultHomeSettings).defs,
    ];
    const next = await fresh();
    next.restore(applyDefChanges([], defs));
    expect(next.home("subst(S,y=0)", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });

  it("Solve, an analysis and a unit job leave the table as Giac holds it, with no read of their own (audit, round 2)", async () => {
    const { giac, bridge } = await loadNodeGiac();
    let stateReads = 0;
    const ev = giac.eval.bind(giac);
    giac.eval = (t: string) => (t.includes("VARS()") && stateReads++, ev(t));
    const host = new EngineHost(giac, bridge);
    host.home("sto(floor(sin(10^100)*10^12),X)", defaultHomeSettings);
    host.home("a:=2.5", defaultHomeSettings);
    const inner = host as unknown as { stored: Map<string, StoredName>; byName: Map<string, unknown> };
    const held = (): Map<string, StoredName> => tableOf(parsePrinted(ev(statePart(12)))!, (n) => inner.byName.has(n))!;
    const jobs = [
      () => host.solve({ kind: "equations", equations: ["X*exp(X)=5"], unknowns: ["X"], guesses: ["1"] }, defaultHomeSettings),
      () => host.analyze({ kind: "area", f: "x^2+a", a: "0", b: "1" }, defaultHomeSettings),
      () => host.units({ expr: "2*(((1)*pasdimL^(1)))", inexact: false }, defaultHomeSettings),
    ];
    for (const job of jobs) {
      stateReads = 0;
      job();
      expect(stateReads, "no read of the stored names of its own").toBe(0);
      expect([...inner.stored]).toEqual([...held()]);
    }
    host.home("Y:=1", defaultHomeSettings);
    expect(host.home("X+1", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });
  it("a log stored before G65 holding the \"other\" entry x:=y:=3: a relaunch turns it into x and y, and purging both leaves them free (F58)", async () => {
    const old: DefEntry[] = [{ name: "x", kind: "other", cmds: ["x:=y:=3"], preview: "3", view: "cas", time: 1 }];
    const host = await fresh();
    host.restore(old);
    let log = applyDefChanges(old, host.takeMigrated());
    expect(log.map((e) => [e.name, e.kind]).sort()).toEqual([["x", "var"], ["y", "var"]]);
    log = applyDefChanges(log, [...host.cas("purge(x)", defaultCasSettings).defs, ...host.cas("purge(y)", defaultCasSettings).defs]);
    expect(log).toEqual([]);
    const next = await fresh();
    next.restore(log);
    expect(next.home("x+y", defaultHomeSettings).result.display).toBe("x+y");
  });

  it("a program that stores a global and then errors: the table follows, so the next input is not credited with it", async () => {
    const host = await fresh();
    host.home("sto(floor(sin(10^100)*10^12),pA)", defaultHomeSettings);
    host.home("sg(v):={gl:=v; error(\"e\")}", defaultHomeSettings);
    host.home("sg(pA)", defaultHomeSettings);
    const defs = host.home("Y:=1", defaultHomeSettings).defs;
    expect(defs.flatMap((d) => ("set" in d ? [d.set.name] : []))).toEqual(["Y"]);
  });
});
