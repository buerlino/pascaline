// SPDX-License-Identifier: GPL-3.0-or-later
// WorkerEngine with in-process stand-ins for the Web Worker.
import { describe, expect, it } from "vitest";
import type { Request, Response } from "./protocol.ts";
import { createRequestHandler } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { EngineCancelled, defaultCasSettings } from "./types.ts";
import { WorkerEngine, type WorkerLike } from "./workerEngine.ts";

/** Runs the real request handler (and a fresh Giac instance) in this thread. */
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

/** Answers init at once and never answers anything else: a job that runs forever. */
class StuckWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  inits: string[][] = [];
  terminated = false;
  postMessage(msg: Request): void {
    if (msg.type === "init") {
      this.inits.push(msg.replay);
      setTimeout(() => this.onmessage?.({ data: { id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 } }), 0);
    }
  }
  terminate(): void {
    this.terminated = true;
  }
}

describe("WorkerEngine cancel (stand-in worker)", () => {
  it("rejects pending calls with EngineCancelled and starts a new worker", async () => {
    const workers: StuckWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new StuckWorker()), workers.at(-1)!) });
    await engine.ready();
    const job = expect(engine.cas("int(exp(x^2),x)", defaultCasSettings)).rejects.toBeInstanceOf(EngineCancelled);
    const t = await engine.cancel();
    await job;
    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.inits).toEqual([[]]);
    expect(t.readyMs).toBeGreaterThanOrEqual(0);
    engine.dispose();
  });

  it("a worker crash restarts like Cancel", async () => {
    const workers: StuckWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new StuckWorker()), workers.at(-1)!) });
    await engine.ready();
    const job = expect(engine.home("1/3", defaultHomeSettings)).rejects.toThrow("out of memory");
    workers[0]!.onerror?.({ message: "out of memory" });
    await job;
    expect(workers).toHaveLength(2);
    await engine.ready();
    engine.dispose();
  });
});

describe.skipIf(!giacAvailable())("WorkerEngine (real Giac in process)", () => {
  it("Home and CAS answers, and definitions survive a Cancel", async () => {
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker() });
    await engine.ready();
    expect((await engine.home("1/3", defaultHomeSettings)).display).toBe("0.333333333333");
    await engine.cas("f(x):=x^2+1", defaultCasSettings);
    await engine.home("a:=0.5", defaultHomeSettings);
    expect(engine.replayCommands).toEqual(["f(x):=x^2+1", "a:=(5/10^1)"]);
    const t = await engine.cancel();
    expect(t.replayMs).toBeGreaterThanOrEqual(0);
    expect((await engine.cas("f(3)", defaultCasSettings)).text).toBe("10");
    expect((await engine.home("a*4", defaultHomeSettings)).display).toBe("2");
    engine.dispose();
  });
});

describe.skipIf(!giacAvailable())("WorkerEngine start-up (real Giac in process)", () => {
  it("a call sent before the engine is ready waits for it (regression: rejected with 'engine not ready')", async () => {
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker() });
    const [a, b] = await Promise.all([engine.home("1/3", defaultHomeSettings), engine.home("2/3", defaultHomeSettings)]);
    expect(a.display).toBe("0.333333333333"); // device, G2 item 16 (tests/golden/home.yaml)
    expect(b.display).toBe("0.666666666667"); // derived: 2/3 rounded half away from zero at 12 digits
    engine.dispose();
  });
});

describe.skipIf(!giacAvailable())("WorkerEngine Solve and Cancel (real Giac in process)", () => {
  it("a user's X survives a solve, and a Cancel in the middle of one", async () => {
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker() });
    await engine.ready();
    await engine.home("X:=7", defaultHomeSettings);
    // Inside the solve X is purged and restored; the call itself adds nothing to the replay log.
    const r = await engine.solve({ kind: "equations", equations: ["X^2=2"], unknowns: ["X"], guesses: ["1"] }, defaultHomeSettings);
    expect(r.roots[0]!.result.display).toBe("1.41421356237"); // oracle sqrt(2): tests/golden/solve.yaml sqrt2-pos
    expect((await engine.home("X", defaultHomeSettings)).display).toBe("7");
    expect(engine.replayCommands).toEqual(["X:=7"]);
    // Cancel while a solve is queued or running: the restarted engine still has X = 7.
    const job = expect(
      engine.solve({ kind: "equations", equations: ["X^2+Y^2=4", "Y=exp(X)"], unknowns: ["X", "Y"], guesses: ["-1", "1"] }, defaultHomeSettings),
    ).rejects.toBeInstanceOf(EngineCancelled);
    await engine.cancel();
    await job;
    expect((await engine.home("X", defaultHomeSettings)).display).toBe("7");
    engine.dispose();
  });
});
