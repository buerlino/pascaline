// SPDX-License-Identifier: GPL-3.0-or-later
// G65 (S13, R15): the names an input set come from Giac's state, so the definitions log holds every one of them and no
// line kept as typed (F58), and Solve's own changes to stored names are not credited to the next input.
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { applyDefChanges, type DefChange } from "./defs.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("G65: stored names from Giac's state", () => {
  const fresh = async () => new EngineHost((await loadNodeGiac()).giac);

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
    expect(host.home("pB+1", defaultHomeSettings).result.warn).toBe("unchecked");
  });

  it("a restore fills the table: a name replayed lends its facts through a symbolic value", async () => {
    const host = await fresh();
    const defs = [
      ...host.home("S:=y+pA0", defaultHomeSettings).defs,
      ...host.home("sto(floor(sin(10^100)*10^12),pA0)", defaultHomeSettings).defs,
    ];
    const next = await fresh();
    next.restore(applyDefChanges([], defs));
    expect(next.home("subst(S,y=0)", defaultHomeSettings).result.warn).toBe("unchecked");
  });
});
