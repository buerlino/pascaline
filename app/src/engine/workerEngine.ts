// SPDX-License-Identifier: GPL-3.0-or-later
// MathEngine backed by giac.worker.ts. State that must survive a Cancel or a relaunch (variable and function
// definitions) is logged here, outside the worker, stored, and replayed into a fresh worker (D2; docs/04 section 6.2).
import type { Request, Response } from "./protocol.ts";
import { applyDefChanges, replayOrder, validDefs, type DefChange, type DefEntry } from "./defs.ts";
import {
  EngineCancelled,
  EngineMemoryError,
  type CasResult,
  type AnalysisRequest,
  type AnalysisResult,
  type CasSettings,
  type SolveOutcome,
  type SolveRequest,
  type TableRequest,
  type EngineTimings,
  type EvalResult,
  type HomeResult,
  type HomeSettings,
  type MathEngine,
} from "./types.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";

/** The part of a Worker that WorkerEngine uses (lets tests drive it without a browser). */
export interface WorkerLike {
  postMessage(msg: Request): void;
  terminate(): void;
  onmessage: ((ev: { data: Response }) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
}

/** Where the definitions log is kept between launches (the app: IndexedDB key `defs`). */
export interface DefsStore {
  load(): Promise<unknown>;
  save(log: readonly DefEntry[]): void;
  /** G19: starts that began a replay of the log and never got ready (0 when absent). Written before a replay, cleared
   *  once ready, so a crash that kills the whole app counts too. */
  loadStarts?(): Promise<number>;
  saveStarts?(n: number): void;
}

/** Failed starts after which the stored log is left out of the replay (G19). */
export const MAX_FAILED_STARTS = 2;

export interface WorkerEngineOptions {
  /** Base URL under which `engine/giac.mjs` is served (Vite's BASE_URL by default). */
  baseUrl?: string;
  createWorker?: () => WorkerLike;
  /** Keeps the definitions across launches; without it they last until the page closes. */
  defs?: DefsStore;
}

/** How long the first calls wait for the stored definitions before the engine starts without them (a blocked store). */
export const DEFS_LOAD_TIMEOUT_MS = 3000;

type Pending = { resolve: (r: Response) => void; reject: (e: Error) => void };
type RequestBody = Request extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

/** Vite's BASE_URL made absolute against the page: with `base: "./"` a relative base would
 *  otherwise resolve against the worker script's own folder (assets/). */
function defaultBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return typeof location === "undefined" ? base : new URL(base, location.href).href;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL("./giac.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

export class WorkerEngine implements MathEngine {
  private worker!: WorkerLike;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private log: DefEntry[] = [];
  private readyPromise!: Promise<EngineTimings>;
  private readonly baseUrl: string;
  private readonly createWorker: () => WorkerLike;
  private readonly store: DefsStore | undefined;
  /** Saving is on once the stored log was read (a store that timed out is never overwritten with a partial log). */
  private storeOk = false;
  /** Settles once the stored definitions were read and sent to the worker; every call is posted after it. */
  private readonly gate: Promise<void>;
  private gateOpen = false;
  /** Counts stops (Cancel, crash): a call still waiting for the gate when one comes is rejected like a posted one. */
  private generation = 0;
  private stopError: Error = new EngineCancelled();
  /** The replay of the stored definitions on first launch (part of the first ready()). */
  private defined: Promise<number> = Promise.resolve(0);
  /** G19: replays begun and not finished (mirrors the store's count). */
  private attempts = 0;
  /** The current worker has finished its replay. */
  private reached = false;
  /** The first launch's replay (the `define` message) is still the one that decides "ready". */
  private firstPending = true;
  /** G19: entries of the stored log left out because their replay stopped the engine; still stored, still listed. */
  private skipped: DefEntry[] = [];
  private safe: { skipped: number } | undefined;

  constructor(opts: WorkerEngineOptions = {}) {
    this.baseUrl = opts.baseUrl ?? defaultBaseUrl();
    this.createWorker = opts.createWorker ?? defaultWorker;
    this.store = opts.defs;
    // The worker starts at once (the wasm loads while the store is read); the stored definitions follow as their own
    // message, posted before any call (calls wait for the gate, and this callback is the gate's first).
    this.start();
    const first = this.readyPromise;
    this.gate = this.loadStored().then((stored) => {
      this.gateOpen = true;
      // No replay to wait for (nothing stored, or a safe start): the first worker being ready is the whole start.
      const noReplay = () => (this.defined = first.then(() => (this.reach(), 0)));
      if (!stored.length) return void noReplay();
      if (this.attempts >= MAX_FAILED_STARTS) {
        this.leaveOut(stored);
        noReplay();
        return;
      }
      this.beginAttempt(stored.length);
      this.log = applyDefChanges(this.log, stored.map((e) => ({ set: e })));
      this.defined = this.post({ type: "define", defs: stored }).then((r) => (r.type === "defined" ? r.replayMs : 0));
      this.defined.then(() => this.reach(), () => {});
    });
    this.readyPromise = Promise.all([first, this.gate.then(() => this.defined)]).then(([t, ms]) => ({
      ...t,
      ...(this.safe ? { safeStart: this.safe } : {}),
      replayMs: t.replayMs + ms,
      readyMs: Math.max(t.readyMs, performance.now() - this.startedAt),
    }));
    this.readyPromise.catch(() => {});
  }

  private startedAt = 0;

  private async loadStored(): Promise<DefEntry[]> {
    if (!this.store) return [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => (timer = setTimeout(() => resolve("timeout"), DEFS_LOAD_TIMEOUT_MS)));
    try {
      const x = await Promise.race([Promise.all([this.store.load(), this.store.loadStarts?.() ?? 0]), timeout]);
      if (x === "timeout") return [];
      this.storeOk = true;
      this.attempts = typeof x[1] === "number" && x[1] > 0 ? Math.trunc(x[1]) : 0;
      return validDefs(x[0]);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /** Applies what a call defined to the log, and stores it. */
  private keep(changes: readonly DefChange[]): void {
    if (!changes.length) return;
    this.log = applyDefChanges(this.log, changes);
    // a purge reaches the entries a safe start left out too, or stored() would bring the name back (G19)
    const purges = changes.filter((c) => "purge" in c);
    if (this.skipped.length && purges.length) this.skipped = applyDefChanges(this.skipped, purges);
    if (this.storeOk) this.store?.save(this.stored());
  }

  /** The log as stored: what is live plus what a safe start left out (G19). */
  private stored(): readonly DefEntry[] {
    return this.skipped.length ? applyDefChanges(this.skipped, this.log.map((e) => ({ set: e }))) : this.log;
  }

  private writeAttempts(n: number): void {
    this.attempts = n;
    if (this.storeOk) this.store?.saveStarts?.(n);
  }

  /** A replay of `n` entries begins: count it before it runs. */
  private beginAttempt(n = this.log.length): void {
    if (n > 0) this.writeAttempts(this.attempts + 1);
  }

  /** The replay finished: the engine is ready with its log. */
  private reach(): void {
    this.reached = true;
    if (this.attempts > 0) this.writeAttempts(0);
  }

  /** Starts without these entries: they stay in the store and in definitions(), and are said to be skipped. */
  private leaveOut(entries: readonly DefEntry[]): void {
    this.skipped = [...entries];
    this.log = [];
    this.safe = { skipped: entries.length };
  }

  /** Resolves when the engine is ready. A start that a crash replaced (G19) is waited for in its place. */
  async ready(): Promise<EngineTimings> {
    for (;;) {
      const p = this.readyPromise;
      try {
        return await p;
      } catch (e) {
        if (this.readyPromise === p) throw e;
      }
    }
  }

  async home(input: string, settings: HomeSettings): Promise<HomeResult> {
    const r = await this.call({ type: "home", input, settings });
    if (r.type !== "home") throw new Error(`unexpected ${r.type}`);
    this.keep(r.defs);
    return r.result;
  }

  async cas(input: string, settings: CasSettings): Promise<CasResult> {
    const r = await this.call({ type: "cas", input, settings });
    if (r.type !== "cas") throw new Error(`unexpected ${r.type}`);
    this.keep(r.defs);
    return r.result;
  }

  async solve(req: SolveRequest, settings: HomeSettings): Promise<SolveOutcome> {
    const r = await this.call({ type: "solve", req, settings });
    if (r.type !== "solve") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async unknowns(equations: string[]): Promise<string[]> {
    const r = await this.call({ type: "unknowns", equations });
    if (r.type !== "unknowns") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async analyze(req: AnalysisRequest, settings: HomeSettings): Promise<AnalysisResult> {
    const r = await this.call({ type: "analyze", req, settings });
    if (r.type !== "analyze") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async table(req: TableRequest, settings: HomeSettings): Promise<HomeResult[][]> {
    const r = await this.call({ type: "table", req, settings });
    if (r.type !== "table") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async units(job: UnitJob, settings: HomeSettings): Promise<Quantity | UnitError> {
    const r = await this.call({ type: "units", job, settings });
    if (r.type !== "units") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async eval(input: string): Promise<EvalResult> {
    const r = await this.call({ type: "eval", input });
    if (r.type !== "result") throw new Error(`unexpected ${r.type}`);
    this.keep(r.defs);
    return { output: r.output, ok: r.ok, engineMs: r.engineMs };
  }

  cancel(): Promise<EngineTimings> {
    const wasReached = this.reached;
    this.stop(new EngineCancelled());
    if (wasReached) this.beginAttempt(); // a Cancel during the start is the same attempt, not a new one
    this.start();
    return this.readyPromise;
  }

  dispose(): void {
    this.stop(new EngineCancelled());
  }

  /** The definitions log, once the stored one has been read (Vars, Find's live items, docs/04 3.4). */
  async definitions(): Promise<readonly DefEntry[]> {
    await this.gate;
    return this.stored();
  }

  /** Commands replayed into a fresh worker, in replay order (for tests and diagnostics). */
  get replayCommands(): readonly string[] {
    return replayOrder(this.log).flatMap((e) => e.cmds);
  }

  private stop(err: Error): void {
    this.generation++;
    this.firstPending = false;
    this.stopError = err;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  /** The worker died (an error event, or a fatal reply marked memory): a clean worker takes its place and replays the
   *  log. G19: a crash before the replay finished is a failed start; the second one leaves the stored log out. */
  private restartAfterCrash(err: Error): void {
    const wasReached = this.reached;
    this.stop(err);
    if (!wasReached && this.log.length && this.attempts >= MAX_FAILED_STARTS) this.leaveOut(this.stored());
    else this.beginAttempt();
    this.start();
  }

  private start(): void {
    const t0 = performance.now();
    this.startedAt = t0;
    const w = this.createWorker();
    this.worker = w;
    this.reached = false;
    w.onmessage = (ev) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.type === "fatal") {
        if (!ev.data.memory) return void p.reject(new Error(ev.data.message));
        // G24: the heap only grows, and an aborted module is dead: reject the call and start a clean worker.
        p.reject(new EngineMemoryError(ev.data.message));
        if (this.worker === w) this.restartAfterCrash(new EngineMemoryError(ev.data.message));
      } else p.resolve(ev.data);
    };
    // A crash (e.g. out of memory) rejects what is pending and takes the same restart + replay path as Cancel.
    w.onerror = (ev) => {
      if (this.worker === w) this.restartAfterCrash(new EngineMemoryError(ev.message || "engine crashed"));
    };
    this.readyPromise = this.post({ type: "init", baseUrl: this.baseUrl, replay: [...this.log] }).then((r) => {
      if (r.type !== "ready") throw new Error(`unexpected ${r.type}`);
      if (!this.firstPending) this.reach();
      return { ...(this.safe ? { safeStart: this.safe } : {}), instantiateMs: r.instantiateMs, initMs: r.initMs, replayMs: r.replayMs, readyMs: performance.now() - t0 };
    });
    // Callers observe failures through ready() or their own call; avoid an unhandled rejection here.
    this.readyPromise.catch(() => {});
  }

  /** A request, posted once the stored definitions have gone to the worker (at once when they have). */
  private call(body: RequestBody): Promise<Response> {
    if (this.gateOpen) return this.post(body);
    const gen = this.generation;
    return this.gate.then(() => {
      if (gen !== this.generation) throw this.stopError;
      return this.post(body);
    });
  }

  /** A request, posted now (init, and the stored definitions themselves). */
  private post(body: RequestBody): Promise<Response> {
    const id = this.nextId++;
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
    });
  }
}
