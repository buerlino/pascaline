// SPDX-License-Identifier: GPL-3.0-or-later
// MathEngine backed by giac.worker.ts. State that must survive a Cancel (variable and function
// definitions) is logged here, outside the worker, and replayed into a fresh worker (D2).
import type { Request, Response } from "./protocol.ts";
import {
  EngineCancelled,
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

/** The part of a Worker that WorkerEngine uses (lets tests drive it without a browser). */
export interface WorkerLike {
  postMessage(msg: Request): void;
  terminate(): void;
  onmessage: ((ev: { data: Response }) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
}

export interface WorkerEngineOptions {
  /** Base URL under which `engine/giac.mjs` is served (Vite's BASE_URL by default). */
  baseUrl?: string;
  createWorker?: () => WorkerLike;
}

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
  private replayLog: string[] = [];
  private readyPromise!: Promise<EngineTimings>;
  private readonly baseUrl: string;
  private readonly createWorker: () => WorkerLike;

  constructor(opts: WorkerEngineOptions = {}) {
    this.baseUrl = opts.baseUrl ?? defaultBaseUrl();
    this.createWorker = opts.createWorker ?? defaultWorker;
    this.start();
  }

  ready(): Promise<EngineTimings> {
    return this.readyPromise;
  }

  async home(input: string, settings: HomeSettings): Promise<HomeResult> {
    const r = await this.call({ type: "home", input, settings });
    if (r.type !== "home") throw new Error(`unexpected ${r.type}`);
    this.replayLog.push(...r.replay);
    return r.result;
  }

  async cas(input: string, settings: CasSettings): Promise<CasResult> {
    const r = await this.call({ type: "cas", input, settings });
    if (r.type !== "cas") throw new Error(`unexpected ${r.type}`);
    this.replayLog.push(...r.replay);
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

  async eval(input: string): Promise<EvalResult> {
    const r = await this.call({ type: "eval", input });
    if (r.type !== "result") throw new Error(`unexpected ${r.type}`);
    this.replayLog.push(...r.replay);
    return { output: r.output, ok: r.ok, engineMs: r.engineMs };
  }

  cancel(): Promise<EngineTimings> {
    this.stop(new EngineCancelled());
    this.start();
    return this.readyPromise;
  }

  dispose(): void {
    this.stop(new EngineCancelled());
  }

  /** Commands replayed into a fresh worker (for tests and diagnostics). */
  get replayCommands(): readonly string[] {
    return this.replayLog;
  }

  private stop(err: Error): void {
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private start(): void {
    const t0 = performance.now();
    const w = this.createWorker();
    this.worker = w;
    w.onmessage = (ev) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.type === "fatal") p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
    // A crash (e.g. out of memory) rejects what is pending and takes the same restart + replay path as Cancel.
    w.onerror = (ev) => {
      if (this.worker !== w) return;
      this.stop(new Error(ev.message || "engine crashed"));
      this.start();
    };
    this.readyPromise = this.call({ type: "init", baseUrl: this.baseUrl, replay: [...this.replayLog] }).then((r) => {
      if (r.type !== "ready") throw new Error(`unexpected ${r.type}`);
      return { instantiateMs: r.instantiateMs, initMs: r.initMs, replayMs: r.replayMs, readyMs: performance.now() - t0 };
    });
    // Callers observe failures through ready() or their own call; avoid an unhandled rejection here.
    this.readyPromise.catch(() => {});
  }

  private call(body: RequestBody): Promise<Response> {
    const id = this.nextId++;
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
    });
  }
}
