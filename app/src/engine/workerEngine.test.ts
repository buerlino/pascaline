// SPDX-License-Identifier: GPL-3.0-or-later
// WorkerEngine with in-process stand-ins for the Web Worker.
import { describe, expect, it } from "vitest";
import type { Request, Response } from "./protocol.ts";
import { createRequestHandler } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { EngineCancelled, EngineMemoryError, defaultCasSettings } from "./types.ts";
import { WorkerEngine, type WorkerLike } from "./workerEngine.ts";
import type { DefEntry } from "./defs.ts";

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
  inits: DefEntry[][] = [];
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

describe("WorkerEngine out of memory (G24, F32)", () => {
  it("a worker error during a call is a memory error, and the engine restarts", async () => {
    const workers: StuckWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new StuckWorker()), workers.at(-1)!) });
    await engine.ready();
    const job = expect(engine.cas("ranm(40000,40000)", defaultCasSettings)).rejects.toBeInstanceOf(EngineMemoryError);
    await new Promise((r) => setTimeout(r, 5));
    workers[0]!.onerror?.({ message: "Aborted(OOM)" });
    await job;
    expect(workers).toHaveLength(2);
    await engine.ready();
    engine.dispose();
  });

  it("a thrown allocation failure inside the worker (a fatal reply marked memory) is a memory error, and the worker restarts", async () => {
    const workers: StuckWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new StuckWorker()), workers.at(-1)!) });
    await engine.ready();
    const job = expect(engine.cas("makemat(1,30000,30000)", defaultCasSettings)).rejects.toBeInstanceOf(EngineMemoryError);
    // the id of the call just posted is the highest one the stand-in saw; reply to it
    const w = workers[0]!;
    await new Promise((r) => setTimeout(r, 5)); // the call is posted once the (empty) store has answered
    w.onmessage?.({ data: { id: 2, type: "fatal", message: "[object WebAssembly.Exception]", memory: true } });
    await job;
    expect(workers).toHaveLength(2);
    expect(w.terminated).toBe(true);
    engine.dispose();
  });

  it("a fatal reply that is not about memory stays a plain error and does not restart", async () => {
    const workers: StuckWorker[] = [];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new StuckWorker()), workers.at(-1)!) });
    await engine.ready();
    const job = expect(engine.cas("1+", defaultCasSettings)).rejects.not.toBeInstanceOf(EngineMemoryError);
    await new Promise((r) => setTimeout(r, 5));
    workers[0]!.onmessage?.({ data: { id: 2, type: "fatal", message: "boom" } });
    await job;
    expect(workers).toHaveLength(1);
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
    expect(engine.replayCommands).toEqual(["f(x):=x^2+1", "a:=(1/2)"]);
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
    expect(engine.replayCommands).toEqual(["X:=(7)"]);
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

/** An in-memory definitions store: what a relaunch reads back. */
class MemoryStore {
  saved: unknown = undefined;
  saves = 0;
  load(): Promise<unknown> {
    return Promise.resolve(structuredClone(this.saved));
  }
  save(log: readonly DefEntry[]): void {
    this.saved = structuredClone(log);
    this.saves++;
  }
}

describe.skipIf(!giacAvailable())("WorkerEngine definitions across a relaunch (real Giac in process, docs/04 6.2)", () => {
  const launch = (store: MemoryStore) => new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker(), defs: store });

  it("variables and functions come back; the first call already sees them", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    await a.home("A:=5", defaultHomeSettings);
    await a.cas("g(x):=x^2+1", defaultCasSettings);
    a.dispose();
    const b = launch(store);
    // no await of ready(): the stored definitions must reach the worker before this call
    expect((await b.home("A*2", defaultHomeSettings)).display).toBe("10"); // derived
    expect((await b.cas("g(3)", defaultCasSettings)).text).toBe("10"); // derived
    expect((await b.definitions()).map((e) => `${e.name}:${e.kind}`)).toEqual(["A:var", "g:fn"]);
    b.dispose();
  });

  it("a variable keeps its value, not the command: B:=A*2 then A:=5 (derived: B = 2)", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    await a.home("A:=1", defaultHomeSettings);
    await a.home("B:=A*2", defaultHomeSettings);
    await a.home("A:=5", defaultHomeSettings);
    a.dispose();
    const b = launch(store);
    expect((await b.home("B", defaultHomeSettings)).display).toBe("2");
    expect((await b.home("A", defaultHomeSettings)).display).toBe("5");
    b.dispose();
  });

  it("a symbolic value is set again before the names in it: S:=K*x+1, then K:=5", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    await a.cas("S:=K*x+1", defaultCasSettings);
    await a.cas("K:=5", defaultCasSettings);
    const live = (await a.cas("S", defaultCasSettings)).text;
    a.dispose();
    const b = launch(store);
    expect((await b.cas("S", defaultCasSettings)).text).toBe(live); // as in the session it was defined in
    b.dispose();
  });

  it("a stored float keeps its digits and its mark (M4-7)", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    const s30 = { ...defaultHomeSettings, digits: 30 };
    const first = await a.home("B:=romberg(exp(-x^2),x,0,1)", s30);
    const before = await a.home("B", s30);
    a.dispose();
    const b = launch(store);
    const after = await b.home("B", s30);
    expect(after.display).toBe(before.display);
    expect(after.reliableDigits).toBe(first.reliableDigits);
    expect(after.warn).toBe("unaudited");
    b.dispose();
  });

  it("purge removes a name; the log keeps the last definition per name", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    await a.home("P:=1", defaultHomeSettings);
    await a.home("Q:=2", defaultHomeSettings);
    await a.home("P:=3", defaultHomeSettings);
    await a.home("purge(Q)", defaultHomeSettings);
    expect(a.replayCommands).toEqual(["P:=(3)"]);
    a.dispose();
    const b = launch(store);
    expect((await b.home("Q", defaultHomeSettings)).display).toBe("Q");
    b.dispose();
  });

  it("reports the replay of 200 stored definitions in ready().replayMs", async () => {
    const store = new MemoryStore();
    const a = launch(store);
    for (let k = 0; k < 100; k++) await a.home(`v${k}:=${k}/7`, defaultHomeSettings);
    for (let k = 0; k < 100; k++) await a.cas(`f${k}(x):=x^2+${k}*x`, defaultCasSettings);
    a.dispose();
    const b = launch(store);
    const t = await b.ready();
    expect(t.replayMs).toBeGreaterThan(0);
    expect((await b.home("v99*7+f3(1)", defaultHomeSettings)).display).toBe("103"); // derived: 99 + 1 + 3
    b.dispose();
  });

  it("a store that never answers: the engine starts without it and does not overwrite it", async () => {
    const store = { load: () => new Promise<unknown>(() => {}), save: () => expect.unreachable("saved over a store it never read") };
    const e = new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker(), defs: store });
    expect((await e.home("Z:=4", defaultHomeSettings)).display).toBe("4");
    e.dispose();
  }, 10_000);
});

// --- G19 (F31): a safe start ---------------------------------------------------------------------------------------

/** Answers init and define like StuckWorker, but crashes (onerror) whenever it is asked to replay definitions. */
class CrashOnReplayWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  inits: DefEntry[][] = [];
  postMessage(msg: Request): void {
    const crash = (msg.type === "init" && msg.replay.length > 0) || msg.type === "define";
    if (msg.type === "init") this.inits.push(msg.replay);
    setTimeout(() => {
      if (crash) this.onerror?.({ message: "out of memory" });
      else if (msg.type === "init") this.onmessage?.({ data: { id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 } });
    }, 0);
  }
  terminate(): void {}
}

/** Like CrashOnReplayWorker, but the failure is a fatal reply marked memory (G24), not an onerror. Bounded, so a
 *  restart loop ends the test with a wrong worker count instead of hanging it. */
class FatalOnReplayWorker implements WorkerLike {
  static made = 0;
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  inits: DefEntry[][] = [];
  private readonly lenient = ++FatalOnReplayWorker.made > 40;
  postMessage(msg: Request): void {
    const bad = !this.lenient && ((msg.type === "init" && msg.replay.length > 0) || msg.type === "define");
    if (msg.type === "init") this.inits.push(msg.replay);
    setTimeout(() => {
      if (bad) this.onmessage?.({ data: { id: msg.id, type: "fatal", message: "out of memory", memory: true } });
      else if (msg.type === "init") this.onmessage?.({ data: { id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 } });
      else if (msg.type === "define") this.onmessage?.({ data: { id: msg.id, type: "defined", replayMs: 1 } });
    }, 0);
  }
  terminate(): void {}
}

/** Answers init and define. */
class OkWorker extends StuckWorker {
  override postMessage(msg: Request): void {
    super.postMessage(msg);
    if (msg.type === "define") setTimeout(() => this.onmessage?.({ data: { id: msg.id, type: "defined", replayMs: 1 } }), 0);
  }
}

const entry = (name: string, cmd: string): DefEntry => ({ name, kind: "var", cmds: [cmd], preview: "1", view: "home", time: 1 });

/** MemoryStore with the failed-starts counter. */
class CountingStore extends MemoryStore {
  starts = 0;
  startWrites: number[] = [];
  loadStarts(): Promise<number> {
    return Promise.resolve(this.starts);
  }
  saveStarts(n: number): void {
    this.starts = n;
    this.startWrites.push(n);
  }
}

describe("WorkerEngine safe start (G19, F31)", () => {
  it("a log whose replay crashes the worker twice: the third start runs without it, and says so", async () => {
    const workers: CrashOnReplayWorker[] = [];
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1"), entry("B", "B:=2")];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new CrashOnReplayWorker()), workers.at(-1)!), defs: store });
    const t = await engine.ready();
    expect(t.safeStart).toEqual({ skipped: 2 });
    expect(workers.at(-1)!.inits.at(-1)).toEqual([]);
    expect(workers).toHaveLength(3);
    // the stored log is untouched, and Memory still lists the skipped entries
    expect(store.saved).toEqual([entry("A", "A:=1"), entry("B", "B:=2")]);
    expect((await engine.definitions()).map((e) => e.name)).toEqual(["A", "B"]);
    // the count is cleared once ready
    expect(store.starts).toBe(0);
    engine.dispose();
  });

  it("a replay that runs out of memory (a fatal reply marked memory) counts as a failed start too: no restart loop", async () => {
    FatalOnReplayWorker.made = 0;
    const workers: FatalOnReplayWorker[] = [];
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1"), entry("B", "B:=2")];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new FatalOnReplayWorker()), workers.at(-1)!), defs: store });
    const t = await engine.ready();
    expect(workers).toHaveLength(3);
    expect(t.safeStart).toEqual({ skipped: 2 });
    expect(workers.at(-1)!.inits.at(-1)).toEqual([]);
    expect(store.saved).toEqual([entry("A", "A:=1"), entry("B", "B:=2")]);
    expect(store.starts).toBe(0);
    engine.dispose();
  });

  it("two failed starts in earlier launches: this launch starts without the log", async () => {
    const workers: CrashOnReplayWorker[] = [];
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1")];
    store.starts = 2;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new CrashOnReplayWorker()), workers.at(-1)!), defs: store });
    expect((await engine.ready()).safeStart).toEqual({ skipped: 1 });
    expect(workers).toHaveLength(1);
    expect(store.saved).toEqual([entry("A", "A:=1")]);
    // the safe start is a start that worked: the count goes back to 0, so the next launch tries the log again
    expect(store.starts).toBe(0);
    engine.dispose();
  });

  it("a launch with no stored log clears an old count once ready", async () => {
    const store = new CountingStore();
    store.starts = 2;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new OkWorker(), defs: store });
    await engine.ready();
    expect(store.starts).toBe(0);
    engine.dispose();
  });

  it("a launch that works leaves no safeStart, and the count goes back to 0", async () => {
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1")];
    store.starts = 1;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new OkWorker(), defs: store });
    expect((await engine.ready()).safeStart).toBeUndefined();
    expect(store.starts).toBe(0);
    engine.dispose();
  });

  it("a new definition made in a safe start is stored beside the skipped ones", async () => {
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1")];
    store.starts = 2;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new OkWorker(), defs: store });
    await engine.ready();
    (engine as unknown as { keep(c: unknown[]): void }).keep([{ set: entry("C", "C:=3") }]);
    expect((store.saved as DefEntry[]).map((e) => e.name).sort()).toEqual(["A", "C"]);
    engine.dispose();
  });

  it("a purge of a skipped name after a safe start removes it from the store and from definitions()", async () => {
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1"), entry("B", "B:=2")];
    store.starts = 2;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new OkWorker(), defs: store });
    expect((await engine.ready()).safeStart).toEqual({ skipped: 2 });
    (engine as unknown as { keep(c: unknown[]): void }).keep([{ purge: ["A"] }]);
    expect((store.saved as DefEntry[]).map((e) => e.name)).toEqual(["B"]);
    expect((await engine.definitions()).map((e) => e.name)).toEqual(["B"]);
    engine.dispose();
  });

  it("a crash after a safe start replays what was defined since, not nothing", async () => {
    const workers: OkWorker[] = [];
    const store = new CountingStore();
    store.saved = [entry("A", "A:=1")];
    store.starts = 2;
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => (workers.push(new OkWorker()), workers.at(-1)!), defs: store });
    await engine.ready();
    (engine as unknown as { keep(c: unknown[]): void }).keep([{ set: entry("C", "C:=3") }]);
    workers[0]!.onerror?.({ message: "out of memory" });
    await engine.ready();
    expect(workers).toHaveLength(2);
    expect(workers[1]!.inits.at(-1)!.map((e) => e.name)).toEqual(["C"]);
    expect((store.saved as DefEntry[]).map((e) => e.name).sort()).toEqual(["A", "C"]);
    engine.dispose();
  });
});

describe.skipIf(!giacAvailable())("WorkerEngine safe start (real Giac in process)", () => {
  it("a replayed entry that only gives a Giac error is no crash: the rest replays", async () => {
    const store = new CountingStore();
    store.saved = [entry("A", "A:=)("), entry("B", "B:=5")];
    const engine = new WorkerEngine({ baseUrl: "/", createWorker: () => new InProcessWorker(), defs: store });
    const t = await engine.ready();
    expect(t.safeStart).toBeUndefined();
    expect((await engine.home("B", defaultHomeSettings)).display).toBe("5");
    engine.dispose();
  }, 10_000);
});
