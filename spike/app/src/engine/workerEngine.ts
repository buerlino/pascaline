// SPDX-License-Identifier: GPL-3.0-or-later
// MathEngine backed by giac.worker.ts. State that must survive a Cancel (settings and variable
// definitions) is logged here, outside the worker, and replayed into a fresh worker.
import type { Request, Response } from "./protocol";
import type { HomeResult, HomeSettings } from "../home/homeEval";
import {
  EngineCancelled,
  type EngineKind,
  type EngineSettings,
  type EngineTimings,
  type EvalResult,
  type MathEngine,
} from "./types";

type Pending = { resolve: (r: Response) => void; reject: (e: Error) => void };
type RequestBody = Request extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

// Inputs that change engine state and must be replayed after a restart.
const STATEFUL = /:=|=>|\b(purge|assume|additionally)\s*\(/;

export function settingsToGiac(s: Partial<EngineSettings>): string[] {
  const out: string[] = [];
  if (s.digits !== undefined) out.push(`Digits:=${Math.trunc(s.digits)}`);
  if (s.angle !== undefined) out.push(`angle_radian:=${s.angle === "rad" ? 1 : 0}`);
  return out;
}

export class WorkerEngine implements MathEngine {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private settingsLog = new Map<string, string>();
  private varLog: string[] = [];
  private readyPromise!: Promise<EngineTimings>;

  constructor(
    private readonly kind: EngineKind,
    private readonly baseUrl: string = import.meta.env.BASE_URL,
  ) {
    this.start();
  }

  ready(): Promise<EngineTimings> {
    return this.readyPromise;
  }

  async eval(input: string): Promise<EvalResult> {
    const r = await this.call({ type: "eval", input });
    if (r.type !== "result") throw new Error(`unexpected ${r.type}`);
    if (r.ok && STATEFUL.test(input)) this.varLog.push(input);
    return { output: r.output, ok: r.ok, engineMs: r.engineMs };
  }

  async latex(input: string): Promise<EvalResult> {
    const r = await this.call({ type: "latex", input });
    if (r.type !== "result") throw new Error(`unexpected ${r.type}`);
    return { output: r.output, ok: r.ok, engineMs: r.engineMs };
  }

  async home(input: string, settings: HomeSettings): Promise<HomeResult> {
    const r = await this.call({ type: "home", input, settings });
    if (r.type !== "home") throw new Error(`unexpected ${r.type}`);
    return r.result;
  }

  async setSettings(settings: Partial<EngineSettings>): Promise<void> {
    for (const cmd of settingsToGiac(settings)) {
      const r = await this.call({ type: "eval", input: cmd });
      if (r.type !== "result" || !r.ok) throw new Error(`setting failed: ${cmd}`);
      this.settingsLog.set(cmd.split(":=")[0] ?? cmd, cmd);
    }
  }

  cancel(): Promise<EngineTimings> {
    this.worker.terminate();
    const err = new EngineCancelled();
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    this.start();
    return this.readyPromise;
  }

  dispose(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new EngineCancelled());
    this.pending.clear();
  }

  private start(): void {
    const t0 = performance.now();
    this.worker = new Worker(new URL("./giac.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<Response>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.type === "fatal") p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
    this.worker.onerror = (ev) => {
      const err = new Error(ev.message || "worker error");
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
    const replay = [...this.settingsLog.values(), ...this.varLog];
    this.readyPromise = this.call({ type: "init", engine: this.kind, baseUrl: this.baseUrl, replay }).then((r) => {
      if (r.type !== "ready") throw new Error(`unexpected ${r.type}`);
      return {
        instantiateMs: r.instantiateMs,
        initMs: r.initMs,
        replayMs: r.replayMs,
        readyMs: performance.now() - t0,
      };
    });
  }

  private call(body: RequestBody): Promise<Response> {
    const id = this.nextId++;
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
    });
  }
}
