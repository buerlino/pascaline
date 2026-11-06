// SPDX-License-Identifier: GPL-3.0-or-later
// G183 (real Giac, the app's whole path): F122's input stops the engine; the row says so, the engine is restarted, and the
// next Enter works with the user's stored names back.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { t } from "../i18n/index.ts";
import { Session } from "./session.svelte.ts";
import { fakeKv } from "./fakeKv.ts";

/** The real request handler and a fresh Giac in this thread (as workerEngine.test.ts). */
class InProcessWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  private handle = createRequestHandler(
    () => loadNodeGiac(),
    (r) => setTimeout(() => !this.terminated && this.onmessage?.({ data: r }), 0),
  );
  postMessage(msg: Request): void {
    setTimeout(() => void this.handle(msg), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe.skipIf(!giacAvailable())("F122's input in the app (G183, real Giac)", () => {
  it("shows error.crashed; then 1+1 is 2 and a stored name is back", async () => {
    const workers: InProcessWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new InProcessWorker()), workers.at(-1)!) });
    const s = new Session(new EngineCalc(engine), fakeKv());
    await s.submit("a:=5", "a:=5");
    expect(s.home.at(-1)).toMatchObject({ status: "done", text: "5" });
    // sandra's probe 2026-11-05 (F122): RangeError: Maximum call stack size exceeded inside Giac's wasm
    const f122 = "(atan(ln(-pi)+9007199254740993))^(sin(10^-300)-10^300)";
    await s.submit(f122, f122);
    expect(s.home.at(-1)).toMatchObject({ status: "error", text: t("error.crashed") });
    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    await s.submit("1+1", "1+1");
    expect(s.home.at(-1)).toMatchObject({ status: "done", text: "2" }); // derived
    await s.submit("a*2", "a*2");
    expect(s.home.at(-1)).toMatchObject({ status: "done", text: "10" }); // derived: a = 5 replayed into the new worker
    engine.dispose();
  }, 60_000);
});
