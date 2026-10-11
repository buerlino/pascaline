// SPDX-License-Identifier: GPL-3.0-or-later
// PythonEngine backed by python.worker.ts (same pattern as engine/workerEngine.ts). Import this module
// lazily (`await import(...)`): nothing here runs at app start. Cancel terminates the worker and starts
// a fresh one; output and graphics subscriptions survive it.
import type { MathEngine } from "../engine/types.ts";
import { createCalcHost, type HostHandler } from "./calcHost.ts";
import type { PyRequest, PyResponse } from "./protocol.ts";
import { SCRIPT_FILE } from "./pyHost.ts";
import { PythonCancelled, type GfxCmd, type PyOutput, type PyResult, type PyTimings, type PythonEngine } from "./types.ts";

/** The part of a Worker that the engine uses (lets tests drive it without a browser). */
export interface PyWorkerLike {
  postMessage(msg: PyRequest): void;
  terminate(): void;
  onmessage: ((ev: { data: PyResponse }) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
}

export interface PythonEngineOptions {
  /** Base URL under which `python/micropython.mjs` is served (Vite's BASE_URL by default). */
  baseUrl?: string;
  createWorker?: () => PyWorkerLike;
  /** Answers `calc` calls from Python; default: createCalcHost(math). */
  host?: HostHandler;
}

type RequestBody = PyRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;
type Pending = { resolve: (r: PyResponse) => void; reject: (e: Error) => void };

function defaultBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return typeof location === "undefined" ? base : new URL(base, location.href).href;
}

function defaultWorker(): PyWorkerLike {
  return new Worker(new URL("./python.worker.ts", import.meta.url), { type: "module" }) as unknown as PyWorkerLike;
}

class WorkerPythonEngine implements PythonEngine {
  private worker: PyWorkerLike | undefined;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readyPromise: Promise<PyTimings> | undefined;
  private outSubs = new Set<(o: PyOutput) => void>();
  private gfxSubs = new Set<(b: GfxCmd[]) => void>();

  constructor(
    private readonly baseUrl: string,
    private readonly createWorker: () => PyWorkerLike,
    private readonly host: HostHandler,
  ) {}

  ready(): Promise<PyTimings> {
    if (!this.readyPromise) this.start();
    return this.readyPromise!;
  }

  async run(code: string, opts: { file?: string } = {}): Promise<PyResult> {
    await this.ready();
    const r = await this.call({ type: "run", code, file: opts.file ?? SCRIPT_FILE });
    if (r.type !== "done") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async shell(line: string): Promise<PyResult> {
    await this.ready();
    const r = await this.call({ type: "shell", line });
    if (r.type !== "done") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  cancel(): Promise<PyTimings> {
    this.stop(new PythonCancelled());
    this.start();
    return this.readyPromise!;
  }

  onOutput(cb: (o: PyOutput) => void): () => void {
    this.outSubs.add(cb);
    return () => this.outSubs.delete(cb);
  }

  onGraphics(cb: (batch: GfxCmd[]) => void): () => void {
    this.gfxSubs.add(cb);
    return () => this.gfxSubs.delete(cb);
  }

  dispose(): void {
    this.stop(new PythonCancelled());
    this.readyPromise = undefined;
  }

  private stop(err: Error): void {
    const w = this.worker;
    if (w) {
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
    }
    this.worker = undefined;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private start(): void {
    const t0 = performance.now();
    const w = this.createWorker();
    this.worker = w;
    w.onmessage = (ev) => this.onMessage(w, ev.data);
    // A crash (e.g. out of memory) rejects what is pending and starts a fresh worker, like Cancel.
    w.onerror = (ev) => {
      if (this.worker !== w) return;
      this.stop(new Error(ev.message || "python crashed"));
      this.start();
    };
    this.readyPromise = this.call({ type: "init", baseUrl: this.baseUrl }).then((r) => {
      if (r.type !== "ready") throw new Error(`unexpected ${r.type}`);
      return { loadMs: r.loadMs, readyMs: performance.now() - t0 };
    });
    this.readyPromise.catch(() => {});
  }

  private onMessage(w: PyWorkerLike, m: PyResponse): void {
    if (this.worker !== w) return;
    switch (m.type) {
      case "out":
        for (const cb of this.outSubs) cb({ stream: m.stream, text: m.text });
        return;
      case "gfx":
        for (const cb of this.gfxSubs) cb(m.batch);
        return;
      case "host":
        this.host(m.fn, m.args).then(
          (value) => this.worker === w && w.postMessage({ type: "hostReply", rid: m.rid, ok: true, value }),
          (e: unknown) => this.worker === w && w.postMessage({ type: "hostReply", rid: m.rid, ok: false, error: e instanceof Error ? e.message : String(e) }),
        );
        return;
      case "fatal":
        if (m.id === 0) {
          // The runtime reported itself broken after answering: replace it before the next call.
          this.stop(new Error("python runtime failed"));
          this.start();
          return;
        }
        break;
    }
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (m.type === "fatal") p.reject(new Error(m.message));
    else p.resolve(m);
  }

  private call(body: RequestBody): Promise<PyResponse> {
    const id = this.nextId++;
    const w = this.worker;
    return new Promise<PyResponse>((resolve, reject) => {
      if (!w) return reject(new PythonCancelled());
      this.pending.set(id, { resolve, reject });
      w.postMessage({ ...body, id } as PyRequest);
    });
  }
}

/** The Python app's entry point. Nothing loads until the first ready()/run()/shell(). */
export function loadPythonEngine(math: MathEngine, opts: PythonEngineOptions = {}): PythonEngine {
  return new WorkerPythonEngine(opts.baseUrl ?? defaultBaseUrl(), opts.createWorker ?? defaultWorker, opts.host ?? createCalcHost(math));
}
