// SPDX-License-Identifier: GPL-3.0-or-later
// G85: the bridge wrappers resolve their exports on first call, never at load: the worker and the Node loader still
// start and evaluate on an engine built before the bridge (the shared one until A28). With GIAC_OUT on a bridge build,
// the bridge's own answers are checked too.
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { bridgeOf, NO_BRIDGE, type BridgeModule } from "./bridge.ts";
import { giacAvailable, giacMjsPath, loadNodeGiac } from "./nodeGiac.ts";
import type { Request, Response } from "./protocol.ts";

describe("bridge wrappers", () => {
  it("look nothing up at load and throw NO_BRIDGE on a module without the exports", () => {
    let cwraps = 0;
    const M: BridgeModule = {
      cwrap: () => {
        cwraps++;
        return () => "";
      },
    };
    const b = bridgeOf(M);
    expect(cwraps).toBe(0);
    expect(() => b.parse("1+1")).toThrow(NO_BRIDGE);
    expect(() => b.ctxGet()).toThrow(NO_BRIDGE);
    expect(cwraps).toBe(0);
  });

  it("wrap each export once, on its first call", () => {
    const made: string[] = [];
    const M = {
      _giac_parse: () => 0,
      cwrap: (name: string) => {
        made.push(name);
        return () => '{"ok":true,"heads":[],"reads":["a"],"targets":[],"bound":[],"float":false,"string":false,"nodes":1}';
      },
    } as unknown as BridgeModule;
    const b = bridgeOf(M);
    expect(b.parse("a").reads).toEqual(["a"]);
    b.parse("a");
    expect(made).toEqual(["giac_parse"]);
  });
});

describe.skipIf(!giacAvailable())("the engine loaders with the wrappers", () => {
  it("the worker starts on this engine and evaluates 1+1", async () => {
    // giac.worker.ts imports <baseUrl>engine/giac.mjs relative to self.location: give it that layout.
    const dir = mkdtempSync(join(tmpdir(), "g85-worker-"));
    try {
      mkdirSync(join(dir, "engine"));
      for (const f of ["giac.mjs", "giac.wasm"]) symlinkSync(join(dirname(giacMjsPath()), f), join(dir, "engine", f));
      const posted: Response[] = [];
      const g = globalThis as unknown as { self?: unknown };
      const before = g.self;
      const self = { location: { href: pathToFileURL(join(dir, "index.html")).href }, postMessage: (r: Response) => posted.push(r), onmessage: null as null | ((ev: { data: Request }) => void) };
      g.self = self;
      try {
        await import("./giac.worker.ts");
        const until = async (id: number): Promise<Response> => {
          for (let k = 0; k < 600; k++) {
            const r = posted.find((x) => x.id === id);
            if (r) return r;
            await new Promise((ok) => setTimeout(ok, 50));
          }
          throw new Error(`no answer to ${id}`);
        };
        self.onmessage!({ data: { id: 1, type: "init", baseUrl: "", replay: [] } });
        expect((await until(1)).type).toBe("ready");
        self.onmessage!({ data: { id: 2, type: "eval", input: "1+1" } });
        const r = await until(2);
        expect(r.type === "result" && r.output).toBe("2");
      } finally {
        g.self = before;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("the Node loader evaluates 1+1; the bridge answers, or throws NO_BRIDGE on an engine without it", async () => {
    const { giac, bridge } = await loadNodeGiac();
    expect(giac.eval("1+1")).toBe("2");
    let p;
    try {
      p = bridge!.parse("a:=b+1");
    } catch (e) {
      expect(String(e)).toContain(NO_BRIDGE);
      return;
    }
    expect(p).toMatchObject({ ok: true, reads: ["b"], targets: ["a"], float: false });
    expect(bridge!.parse('s:="a:=1"')).toMatchObject({ targets: ["s"], string: true });
    expect(bridge!.parse("a+=1").targets).toEqual(["a"]);
    expect(bridge!.parse("int(B^2,B,0,1)")).toMatchObject({ reads: [], bound: ["B"] });
    expect(bridge!.value("1/3", [12, 32])).toMatchObject({ kind: "rational", text: "1/3", num: "1", den: "3" });
    const d = bridge!.ctxGet().decimal_digits;
    expect(bridge!.ctxSet({ decimal_digits: 20 })).toMatchObject({ decimal_digits: 20 });
    expect(giac.eval("Digits")).toBe("20");
    bridge!.ctxSet({ decimal_digits: d });
    // giac_eval is untouched by the bridge calls
    expect(giac.eval("7*6")).toBe("42");
  }, 60_000);
});
