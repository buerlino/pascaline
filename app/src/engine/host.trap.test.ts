// SPDX-License-Identifier: GPL-3.0-or-later
// G183 (F122, F145, G94): a wasm trap or a stack overflow inside Giac is a dead engine, as G24's memory failures are.
import { describe, expect, it } from "vitest";
import type { Request, Response } from "./protocol.ts";
import { createRequestHandler, type GiacLoader } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";

/** The real Giac, whose eval throws `trap` once armed (the host call of the next request throws it). */
function trapping(): { load: GiacLoader; arm: (e: unknown) => void } {
  let trap: unknown;
  const load: GiacLoader = async () => {
    const L = await loadNodeGiac();
    const real = L.giac.eval.bind(L.giac);
    L.giac.eval = (s) => {
      if (trap !== undefined) throw trap;
      return real(s);
    };
    return L;
  };
  return { load, arm: (e) => (trap = e) };
}

/** The replies a handler posted, by request. */
async function run(load: GiacLoader, reqs: Request[]): Promise<Response[]> {
  const out: Response[] = [];
  const handle = createRequestHandler(load, (r) => out.push(r));
  for (const r of reqs) await handle(r);
  return out;
}

const init: Request = { id: 1, type: "init", baseUrl: "/", replay: [] };

describe.skipIf(!giacAvailable())("the request handler's reply to a trap (G183, real Giac)", () => {
  const cases: [string, unknown][] = [
    ["unreachable (F145)", new WebAssembly.RuntimeError("unreachable")],
    ["memory access out of bounds (G94)", new WebAssembly.RuntimeError("memory access out of bounds")],
    ["V8's stack overflow (F122)", new RangeError("Maximum call stack size exceeded")],
  ];
  for (const [what, e] of cases) {
    it(`${what}: fatal, marked as a crashed engine`, async () => {
      const t = trapping();
      const out: Response[] = [];
      const handle = createRequestHandler(t.load, (r) => out.push(r));
      await handle(init);
      t.arm(e);
      await handle({ id: 2, type: "home", input: "1+1", settings: defaultHomeSettings });
      expect(out.at(-1)).toMatchObject({ id: 2, type: "fatal", dead: "crash" });
    });
  }

  it("a plain Error stays a fatal reply without a dead engine (the worker is kept, as before)", async () => {
    const t = trapping();
    const out: Response[] = [];
    const handle = createRequestHandler(t.load, (r) => out.push(r));
    await handle(init);
    t.arm(new Error("boom"));
    await handle({ id: 2, type: "cas", input: "1+1", settings: defaultCasSettings });
    const last = out.at(-1)!;
    expect(last).toMatchObject({ id: 2, type: "fatal", message: "boom" });
    expect("dead" in last).toBe(false);
  });

  it("an out-of-memory abort is still a memory failure (G24)", async () => {
    const t = trapping();
    const out: Response[] = [];
    const handle = createRequestHandler(t.load, (r) => out.push(r));
    await handle(init);
    t.arm(new Error("Aborted(OOM)"));
    await handle({ id: 2, type: "home", input: "1+1", settings: defaultHomeSettings });
    expect(out.at(-1)).toMatchObject({ id: 2, type: "fatal", dead: "memory" });
  });

  it("F122's input reaches the handler as a crashed engine, not an uncaught throw", async () => {
    // sandra's probe 2026-11-05: RangeError: Maximum call stack size exceeded inside Giac's wasm
    const out = await run(() => loadNodeGiac(), [init, { id: 2, type: "home", input: "(atan(ln(-pi)+9007199254740993))^(sin(10^-300)-10^300)", settings: defaultHomeSettings }]);
    expect(out.at(-1)).toMatchObject({ id: 2, type: "fatal", dead: "crash" });
  }, 60_000);
});
