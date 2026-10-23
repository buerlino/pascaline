// SPDX-License-Identifier: GPL-3.0-or-later
// G85, G99: the bridge wrappers, the loaders that give them, and bridge-2's answers on the engine.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { bridgeOf, GIAC_KINDS, NO_BRIDGE, type BridgeModule } from "./bridge.ts";
import { giacAvailable, giacMjsPath, loadNodeGiac } from "./nodeGiac.ts";
import type { Request, Response } from "./protocol.ts";

describe("bridge wrappers", () => {
  it("throw NO_BRIDGE at load on a module without the exports (G99: no second path)", () => {
    let cwraps = 0;
    const M: BridgeModule = {
      cwrap: () => {
        cwraps++;
        return () => "";
      },
    };
    expect(() => bridgeOf(M)).toThrow(NO_BRIDGE);
    const some = { _giac_parse: () => 0, cwrap: M.cwrap } as unknown as BridgeModule;
    expect(() => bridgeOf(some)).toThrow("giac_ctx_get, giac_ctx_set, giac_value");
    expect(cwraps).toBe(0);
  });

  it("wrap each export once, on its first call", () => {
    const made: string[] = [];
    const M = {
      _giac_parse: () => 0,
      _giac_ctx_get: () => 0,
      _giac_ctx_set: () => 0,
      _giac_value: () => 0,
      cwrap: (name: string) => {
        made.push(name);
        return () => '{"ok":true,"heads":[],"reads":["a"],"targets":[],"bound":[],"top":[],"program":false,"float":false,"string":false,"nodes":1}';
      },
    } as unknown as BridgeModule;
    const b = bridgeOf(M);
    expect(made).toEqual([]);
    expect(b.parse("a").reads).toEqual(["a"]);
    b.parse("a");
    expect(made).toEqual(["giac_parse"]);
  });
});

describe("GiacKind", () => {
  it("holds exactly the kinds kindOf in api.cc returns", () => {
    const api = readFileSync(fileURLToPath(new URL("../../../engine/giac/wasm/api.cc", import.meta.url)), "utf8");
    const start = api.indexOf("const char *kindOf(");
    expect(start).toBeGreaterThan(0);
    const body = api.slice(start, api.indexOf("\n}\n", start));
    const returned = new Set<string>();
    for (const line of body.split("\n")) if (/\breturn\b/.test(line)) for (const m of line.matchAll(/"([a-z]+)"/g)) returned.add(m[1] ?? "");
    expect([...returned].sort()).toEqual([...GIAC_KINDS].sort());
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

  it("the Node loader evaluates 1+1 and the bridge answers", async () => {
    const { giac, bridge } = await loadNodeGiac();
    expect(giac.eval("1+1")).toBe("2");
    expect(bridge.parse("a:=b+1")).toMatchObject({ ok: true, reads: ["b"], targets: ["a"], top: ["a"], program: false, float: false });
    expect(bridge.parse('s:="a:=1"')).toMatchObject({ targets: ["s"], string: true });
    expect(bridge.parse("a+=1").targets).toEqual(["a"]);
    expect(bridge.parse("int(B^2,B,0,1)")).toMatchObject({ reads: [], bound: ["B"] });
    expect(bridge.value("1/3", [12, 32])).toMatchObject({ kind: "rational", text: "1/3", num: "1", den: "3" });
    // a syntax error is an error, never the value of the partial tree the parser left (sin( is no error: Giac closes it)
    for (const bad of ["2*/3", "1+"]) expect(bridge.value(bad, [12])).toMatchObject({ kind: "error" });
    expect(bridge.value("1<2", [12]).kind).toBe("boolean");
    expect(bridge.value("1/0", [12]).kind).toBe("infinity");
    const d = bridge.ctxGet().decimal_digits;
    expect(bridge.ctxSet({ decimal_digits: 20 })).toMatchObject({ decimal_digits: 20 });
    expect(giac.eval("Digits")).toBe("20");
    bridge.ctxSet({ decimal_digits: d });
    // giac_eval is untouched by the bridge calls
    expect(giac.eval("7*6")).toBe("42");
  }, 60_000);

  // G99 (F54): every binding form of the quoting commands binds x in the body, `x,a,b` and `x=a..b` alike (after x:=3,
  // Giac gives sum(x^2,x=1..3) = 14, product(x,x=1..4) = 24, int(x^2,x=0..1) = 1/3: it quotes x, tools/probes/bridge-forms.ts).
  it("binds the variable of every binding form; the bounds and a use outside stay reads", async () => {
    const { bridge } = await loadNodeGiac();
    for (const t of [
      "sum(x^2,x,1,3)", "sum(x^2,x=1..3)", "product(x,x,1,4)", "product(x,x=1..4)", "seq(x^2,x,1,3)", "seq(x^2,x=1..3)",
      "int(x^2,x,0,1)", "int(x^2,x=0..1)", "integrate(x^2,x,0,1)", "integrate(x^2,x=0..1)", "diff(x^3,x)", "solve(x^2=4,x)", "limit(x^2,x,1)",
    ]) expect(bridge.parse(t), t).toMatchObject({ reads: [], bound: ["x"] });
    expect(bridge.parse("sum(x^2,x=a..b)").reads).toEqual(["a", "b"]);
    expect(bridge.parse("sum(x^2,x=1..x)").reads).toEqual(["x"]);
    expect(bridge.parse("sum(x^2,x=1..3)+x").reads).toEqual(["x"]);
    // int(x^2,x) evaluates the integrand with a stored x: read
    expect(bridge.parse("int(x^2,x)").reads).toEqual(["x"]);
  }, 60_000);

  it("names the top-level store's targets and whether it stores a program", async () => {
    const { bridge } = await loadNodeGiac();
    expect(bridge.parse("f(x):={n:=n+1;return x;}")).toMatchObject({ targets: ["n", "f"], top: ["f"], program: true, reads: ["n"] });
    expect(bridge.parse("f:=x->x")).toMatchObject({ top: ["f"], program: true });
    expect(bridge.parse("a:=map(L,x->x)")).toMatchObject({ top: ["a"], program: false, reads: ["L"] });
    expect(bridge.parse("L[k]:=y")).toMatchObject({ top: ["L"], reads: ["y", "L", "k"] });
    expect(bridge.parse("[a,b]:=[b,a]").top).toEqual(["a", "b"]);
    expect(bridge.parse("(BesselJ(1,2))=>y").top).toEqual(["y"]);
    expect(bridge.parse("a:=1;b:=2")).toMatchObject({ top: [], program: false });
    expect(bridge.parse("x^2").top).toEqual([]);
  }, 60_000);
});
