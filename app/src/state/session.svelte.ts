// SPDX-License-Identifier: GPL-3.0-or-later
// The calculator session: current view, modifier keys, settings and the history of both views.
// Plain logic on Svelte 5 runes; the engine comes in through the Calc port.
import { CalcCancelled, type AngleUnit, type Calc, type CalcSettings, type NumberFormat } from "../calc/port.ts";
import { SerializeError } from "../input/emit.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { homeResultToLatex } from "../render/home.ts";
import { tidyGiacLatex } from "../render/tidy.ts";
import { kvGet, kvSet } from "./storage.ts";

export type View = "home" | "cas";
export type EntryMode = "textbook" | "line";

export interface Settings extends CalcSettings {
  entry: EntryMode;
}
export const defaultSettings: Settings = { digits: 12, angle: "rad", format: "std", entry: "textbook" };

export type ItemStatus = "pending" | "done" | "error" | "cancelled";
export interface HistoryItem {
  id: number;
  view: View;
  /** The entry as MathLive LaTeX (drawn in 2D, and put back on the entry line when tapped). */
  latex: string;
  status: ItemStatus;
  /** The result, as LaTeX for the 2D renderer (empty unless status is done). */
  resultLatex: string;
  /** Plain text of the result or the error message. */
  text: string;
  approximate: boolean;
  startedAt: number;
}

const HISTORY_LIMIT = 200;
const clampDigits = (n: number): number => Math.min(15, Math.max(1, Math.round(n)));

export class Session {
  view = $state<View>("home");
  shift = $state(false);
  alpha = $state(false);
  settingsOpen = $state(false);
  settings = $state<Settings>({ ...defaultSettings });
  home = $state<HistoryItem[]>([]);
  cas = $state<HistoryItem[]>([]);
  /** Set when the engine is starting or failed to start. */
  engineState = $state<"starting" | "ready" | "failed">("starting");

  private nextId = 1;
  private readonly calc: Calc;

  constructor(calc: Calc) {
    this.calc = calc;
    calc.ready().then(
      () => (this.engineState = "ready"),
      () => (this.engineState = "failed"),
    );
  }

  get items(): HistoryItem[] {
    return this.view === "home" ? this.home : this.cas;
  }
  get busy(): boolean {
    return this.home.some((i) => i.status === "pending") || this.cas.some((i) => i.status === "pending");
  }
  get pending(): HistoryItem | undefined {
    return [...this.home, ...this.cas].find((i) => i.status === "pending");
  }

  // ---- modifiers: one-shot, as on a calculator
  toggleShift(): void {
    this.shift = !this.shift;
  }
  toggleAlpha(): void {
    this.alpha = !this.alpha;
  }
  clearModifiers(): void {
    this.shift = false;
    this.alpha = false;
  }

  toggleView(): void {
    this.view = this.view === "home" ? "cas" : "home";
    this.saveView();
  }
  setView(v: View): void {
    this.view = v;
    this.saveView();
  }

  // ---- settings
  setDigits(n: number): void {
    this.settings.digits = clampDigits(n);
    this.save();
  }
  setAngle(a: AngleUnit): void {
    this.settings.angle = a;
    this.save();
  }
  setFormat(f: NumberFormat): void {
    this.settings.format = f;
    this.save();
  }
  setEntry(m: EntryMode): void {
    this.settings.entry = m;
    this.save();
  }

  // ---- evaluation
  /**
   * Start evaluating the entry in the current view. Returns undefined when there is nothing to do (empty
   * line, or a job is running); otherwise the history item exists at once and the promise settles when
   * the job has finished, failed or been cancelled.
   */
  submit(latex: string): Promise<void> | undefined {
    if (latex.trim() === "" || this.busy) return undefined;
    const view = this.view;
    const list = view === "home" ? this.home : this.cas;
    list.push({
      id: this.nextId++,
      view,
      latex,
      status: "pending",
      resultLatex: "",
      text: "",
      approximate: false,
      startedAt: performance.now(),
    });
    // Read and write through the proxy in the list from here on.
    const live = list[list.length - 1] as HistoryItem;
    if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
    return this.finish(live, view, latex);
  }

  private async finish(live: HistoryItem, view: View, latex: string): Promise<void> {
    let giac: string;
    try {
      giac = latexToGiac(latex);
    } catch (e) {
      live.status = "error";
      live.text = e instanceof SerializeError ? e.message : String(e);
      return;
    }
    const s: CalcSettings = { digits: this.settings.digits, angle: this.settings.angle, format: this.settings.format };
    try {
      if (view === "home") {
        const r = await this.calc.home(giac, s);
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.display;
        live.approximate = r.approximate;
        if (r.ok) live.resultLatex = homeResultToLatex(r.display);
      } else {
        const r = await this.calc.cas(giac, s);
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.text;
        if (r.ok) live.resultLatex = tidyGiacLatex(r.latex);
      }
    } catch (e) {
      if (live.status !== "pending") return;
      if (e instanceof CalcCancelled) {
        live.status = "cancelled";
      } else {
        live.status = "error";
        live.text = e instanceof Error ? e.message : String(e);
      }
    }
  }

  /** Stop the running job. History and variables survive; the engine restarts underneath. */
  async cancel(): Promise<boolean> {
    const p = this.pending;
    if (!p) return false;
    p.status = "cancelled";
    await this.calc.cancel();
    return true;
  }

  clearHistory(): void {
    if (this.view === "home") this.home.length = 0;
    else this.cas.length = 0;
  }

  // ---- persistence (IndexedDB; failures are silent)
  async restore(): Promise<void> {
    const saved = await kvGet<Partial<Settings>>("settings");
    if (saved) {
      if (saved.angle === "rad" || saved.angle === "deg") this.settings.angle = saved.angle;
      if (saved.format === "std" || saved.format === "sci" || saved.format === "eng") this.settings.format = saved.format;
      if (saved.entry === "textbook" || saved.entry === "line") this.settings.entry = saved.entry;
      if (typeof saved.digits === "number") this.settings.digits = clampDigits(saved.digits);
    }
    const view = await kvGet<View>("view");
    if (view === "home" || view === "cas") this.view = view;
  }
  save(): void {
    void kvSet("settings", { ...this.settings });
  }
  saveView(): void {
    void kvSet("view", this.view);
  }
}
