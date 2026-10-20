// SPDX-License-Identifier: GPL-3.0-or-later
// ?bench=library (A12): the mode seeds the 200 programs of G33's replay test the way importLibrary defines them.
import { describe, expect, it, vi } from "vitest";
import { EngineHost } from "./engine/host.ts";
import { giacAvailable, loadNodeGiac } from "./engine/nodeGiac.ts";
import { applyDefChanges } from "./engine/defs.ts";
import { defaultCasSettings } from "./engine/types.ts";
import { importLibrary, parseLibrary } from "./engine/library.ts";
import { libraryBenchText, runLibraryBench } from "./bench.ts";

describe("?bench=library", () => {
  it("submits the 200 programs through the session, one by one", async () => {
    vi.stubGlobal("requestAnimationFrame", (f: () => void) => setTimeout(f, 0));
    const sent: string[] = [];
    const session = {
      engineState: "ready",
      setView: () => {},
      cas: [{ status: "done" }],
      submit: (_l: string, g: string) => (sent.push(g), Promise.resolve()),
    };
    await runLibraryBench(session as never);
    expect(sent).toHaveLength(200);
    expect(sent[0]).toContain("lib1(a,b):=");
    vi.unstubAllGlobals();
    expect(sent[199]).toContain("return s+200");
  }, 20000);

  it.skipIf(!giacAvailable())("defines the same log as importLibrary does (real Giac)", async () => {
    const fresh = async (): Promise<EngineHost> => new EngineHost((await loadNodeGiac()).giac);
    const lib = parseLibrary(libraryBenchText());
    const imp = importLibrary(await fresh(), lib, []);
    expect(imp.ok && imp.log).toHaveLength(200);
    const h = await fresh();
    const { asGiac } = await import("./engine/library.ts");
    let log: Parameters<typeof applyDefChanges>[0] = [];
    for (const d of lib.defs) log = applyDefChanges(log, h.cas(asGiac(d.text), defaultCasSettings).defs);
    expect(log.map((e) => e.cmds)).toEqual(imp.ok ? imp.log.map((e) => e.cmds) : []);
  }, 60000);
});
