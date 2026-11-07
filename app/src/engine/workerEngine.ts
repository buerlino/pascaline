// SPDX-License-Identifier: GPL-3.0-or-later
// MathEngine backed by giac.worker.ts. State that must survive a Cancel or a relaunch (variable and function
// definitions) is logged here, outside the worker, stored, and replayed into a fresh worker (D2; docs/04 section 6.2).
import type { Request, Response } from "./protocol.ts";
import { applyDefChanges, validDefs, type DefChange, type DefEntry } from "./defs.ts";
import {
  EngineCancelled,
  EngineCrashError,
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
import type { ConstTable } from "./constUnc.ts";
import type { ChipFactsTable } from "./chipFacts.ts";
import { enEngine } from "../i18n/enEngine.ts";

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

/** G185 (F62): a Home or unit-view call that has not answered this long after the engine was ready is stopped: the
 *  worker is restarted on Cancel's path and the call answers Home's time-out. Some Giac calls never look at the
 *  interrupt (MPFR reducing sin(cosh(10!))'s argument), so neither Home's step budget nor Giac's clock stops them. The
 *  larger of 4 s and 8 × the slowest Home Enter that finishes (tools/probes/home-slowest.ts on the 8× fast clock: 228 ms,
 *  so 1.83 s on the Tab One); Opus pass 86, decisions.md "Time limits". Kept here, not in homeEval.ts (start chunk). */
export const HOME_WATCHDOG_MS = 4000;

/** How long the first calls wait for the stored definitions before the engine starts without them (a blocked store). */
export const DEFS_LOAD_TIMEOUT_MS = 3000;

type Pending = { resolve: (r: Response) => void; reject: (e: Error) => void };
type RequestBody = Request extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

/** Vite's BASE_URL made absolute against the page: with `base: "./"` a relative base would
 *  otherwise resolve against the worker script's own folder (assets/). */
function defaultBaseUrl(): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return typeof location === "undefined" ? base : new URL(base, location.href).href;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL("./giac.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

/** Home's time-out result (homeEval.ts `failed` with Giac's interrupt): the row shows `error.timeout`. */
const timedOut = (text = enEngine["error.timeout"]): HomeResult =>
  ({ ok: false, display: text, path: "exact", approximate: true, exactMs: 0, totalMs: HOME_WATCHDOG_MS, error: "timeout", full: text, facts: { exact: false, reliableDigits: null } });

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
      this.defined = this.post({ type: "define", defs: stored }).then((r) => {
        if (r.type !== "defined") return 0;
        // G46: stored values the engine read again (angleMigration.ts) are kept and stored in their new form
        this.keep(r.defs);
        return r.replayMs;
      });
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

  /** Applies what a call defined to the log, and stores it. Public for code that loads later and posts its own
   *  requests (R59, calc/library.ts), so nothing of it is in the start chunk. */
  keep(changes: readonly DefChange[]): void {
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

  async home(input: string, settings: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): Promise<HomeResult> {
    const r = await this.ask({ type: "home", input, settings, ...(consts ? { consts } : {}), ...(chips ? { chips } : {}) }, timedOut());
    this.keep(r.defs);
    return r.result;
  }

  async cas(input: string, settings: CasSettings): Promise<CasResult> {
    const r = await this.ask({ type: "cas", input, settings });
    this.keep(r.defs);
    return r.result;
  }

  async solve(req: SolveRequest, settings: HomeSettings): Promise<SolveOutcome> {
    return (await this.ask({ type: "solve", req, settings })).result;
  }

  async unknowns(equations: string[]): Promise<string[]> {
    return (await this.ask({ type: "unknowns", equations })).result;
  }

  async analyze(req: AnalysisRequest, settings: HomeSettings): Promise<AnalysisResult> {
    return (await this.ask({ type: "analyze", req, settings })).result;
  }

  async table(req: TableRequest, settings: HomeSettings): Promise<HomeResult[][]> {
    return (await this.ask({ type: "table", req, settings })).result;
  }

  async units(job: UnitJob, settings: HomeSettings): Promise<Quantity | UnitError> {
    return (await this.ask({ type: "units", job, settings }, { error: "engine", detail: "timeout" })).result;
  }

  /** A call whose answer has the type `want` (the request's own but for eval's "result"). `late`: the result it gives
   *  when the watchdog stops it (G185, post). */
  private async ask<T extends RequestBody, W extends string = T["type"]>(body: T, late?: HomeResult | UnitError, want = body.type as W): Promise<Extract<Response, { type: W }>> {
    const r = await this.call(body, late && ({ id: 0, type: body.type, result: late, defs: [] } as Response));
    if (r.type !== want) throw new Error(`unexpected ${r.type}`);
    return r as Extract<Response, { type: W }>;
  }

  async eval(input: string): Promise<EvalResult> {
    const r = await this.ask({ type: "eval", input }, undefined, "result");
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

  /** The worker died (an error event, or a fatal reply marked dead): a clean worker takes its place and replays the
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
        // G24: the heap only grows, and an aborted module is dead; G183: so is one a trap unwound: reject the call and
        // start a clean worker, which replays the log. A fatal reply not marked dead keeps the worker.
        const { dead, message } = ev.data;
        const Failure = dead === "crash" ? EngineCrashError : dead ? EngineMemoryError : Error;
        p.reject(new Failure(message));
        if (dead && this.worker === w) this.restartAfterCrash(new Failure(message));
      } else p.resolve(ev.data);
    };
    // A crash (e.g. out of memory) rejects what is pending and takes the same restart + replay path as Cancel.
    w.onerror = (ev) => {
      if (this.worker === w) this.restartAfterCrash(new EngineMemoryError(ev.message));
    };
    this.readyPromise = this.post({ type: "init", baseUrl: this.baseUrl, replay: [...this.log] }).then((r) => {
      if (r.type !== "ready") throw new Error(`unexpected ${r.type}`);
      if (!this.firstPending) this.reach();
      return { ...(this.safe ? { safeStart: this.safe } : {}), instantiateMs: r.instantiateMs, initMs: r.initMs, replayMs: r.replayMs, readyMs: performance.now() - t0 };
    });
    // Callers observe failures through ready() or their own call; avoid an unhandled rejection here.
    this.readyPromise.catch(() => {});
  }

  /** A request, posted once the stored definitions have gone to the worker (at once when they have). Public for code
   *  that loads later (R59, calc/library.ts). */
  call(body: RequestBody, late?: Response): Promise<Response> {
    if (this.gateOpen) return this.post(body, late);
    const gen = this.generation;
    return this.gate.then(() => {
      if (gen !== this.generation) throw this.stopError;
      return this.post(body, late);
    });
  }

  /** A request, posted now (init, and the stored definitions themselves). G185: with `late` (Home and the unit view) it is
   *  under the watchdog, counted from the engine being ready (its start and the replay are not the call's; a call queued
   *  behind another job counts from then too): at HOME_WATCHDOG_MS the call answers `late` and the worker restarts as on
   *  Cancel. A timer whose call has answered, or was ended by a Cancel or a crash (pending emptied), finds it gone and does
   *  nothing; so a new Enter, which the session sends only once the last one answered (session.busy), meets no old limit. */
  private post(body: RequestBody, late?: Response): Promise<Response> {
    const id = this.nextId++;
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
      if (late)
        this.readyPromise.then(() => setTimeout(() => this.pending.delete(id) && (resolve(late), this.cancel()), HOME_WATCHDOG_MS), () => {});
    });
  }
}
