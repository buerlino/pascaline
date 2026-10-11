// SPDX-License-Identifier: GPL-3.0-or-later
// The calculator session: current view, modifier keys, settings and the history of both views.
// Plain logic on Svelte 5 runes; the engine comes in through the Calc port.
import { CalcCancelled, type AngleUnit, type CalcError, type Calc, type CalcSettings, type NumberFormat } from "../calc/port.ts";
import { SerializeError } from "../input/emit.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { formatComplex, type ComplexValue } from "../engine/format.ts";
import { complexToLatex, homeResultToLatex } from "../render/home.ts";
import { tidyGiacLatex } from "../render/tidy.ts";
import { idbKv, type Kv } from "./storage.ts";

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
  /** Home: the numeric result, formatted on demand so a settings change re-formats the whole history. */
  value?: ComplexValue;
  startedAt: number;
}

const HISTORY_LIMIT = 200;
const errorText = (code: CalcError | undefined, fallback: string): string =>
  code ? t(`error.${code}` as MessageKey) : fallback;
const clampDigits = (n: number): number => Math.min(15, Math.max(1, Math.round(n)));

export class Session {
  view = $state<View>("home");
  shift = $state(false);
  alpha = $state(false);
  /** Alpha lock (L3): alpha stays on after each key; capsLock keeps shift on too (capitals). */
  alphaLock = $state(false);
  capsLock = $state(false);
  settingsOpen = $state(false);
  settings = $state<Settings>({ ...defaultSettings });
  home = $state<HistoryItem[]>([]);
  cas = $state<HistoryItem[]>([]);
  /** Set when the engine is starting or failed to start. */
  engineState = $state<"starting" | "ready" | "failed">("starting");

  private nextId = 1;
  private readonly calc: Calc;

  private readonly kv: Kv;
  /** 0 = write the history at once (tests); the app sets a delay so Enter does not wait for the store. */
  saveDelayMs = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private restoring = false;
  private savePending = false;

  constructor(calc: Calc, kv: Kv = idbKv) {
    this.kv = kv;
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

  // ---- modifiers: one-shot, as on a calculator. Alpha twice locks it (shift, alpha, alpha locks capitals);
  // alpha again unlocks. In the lock, shift is one-shot and flips the case of the next letter.
  toggleShift(): void {
    this.shift = !this.shift;
  }
  toggleAlpha(): void {
    if (this.alphaLock) {
      this.alphaLock = false;
      this.capsLock = false;
      this.alpha = false;
      this.shift = false;
    } else if (this.alpha) {
      this.alphaLock = true;
      this.capsLock = this.shift;
    } else this.alpha = true;
  }
  clearModifiers(): void {
    this.shift = this.alphaLock && this.capsLock;
    this.alpha = this.alphaLock;
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
  submit(latex: string, giacOverride?: string): Promise<void> | undefined {
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
    return this.finish(live, view, latex, giacOverride).finally(() => this.saveHistory());
  }

  private async finish(live: HistoryItem, view: View, latex: string, giacOverride?: string): Promise<void> {
    let giac: string;
    try {
      giac = giacOverride ?? latexToGiac(latex);
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
        live.text = r.ok ? r.display : errorText(r.error, r.display);
        live.approximate = r.approximate;
        if (r.value) live.value = r.value;
        if (r.ok) live.resultLatex = homeResultToLatex(r.display);
      } else {
        const r = await this.calc.cas(giac, s);
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.ok ? r.text : errorText(r.error, r.text);
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
    this.saveHistory();
    await this.calc.cancel();
    return true;
  }

  /** What the history shows for a finished item: Home numbers follow the current digits and format. */
  display(item: HistoryItem): { text: string; latex: string } {
    if (item.view === "home" && item.value && item.status === "done") {
      const f = formatComplex(item.value, { format: this.settings.format.toUpperCase() as "STD" | "SCI" | "ENG", digits: this.settings.digits });
      return { text: f.text, latex: complexToLatex(f) };
    }
    return { text: item.text, latex: item.resultLatex };
  }

  clearHistory(): void {
    if (this.view === "home") this.home.length = 0;
    else this.cas.length = 0;
    this.saveHistory();
  }

  // ---- persistence (IndexedDB; failures are silent)
  async restore(): Promise<void> {
    await this.restoreSettings();
    await this.restoreHistory();
  }
  /** Settings and the open view: small, read at launch. */
  async restoreSettings(): Promise<void> {
    const saved = await this.kv.get<Partial<Settings>>("settings");
    if (saved) {
      if (saved.angle === "rad" || saved.angle === "deg") this.settings.angle = saved.angle;
      if (saved.format === "std" || saved.format === "sci" || saved.format === "eng") this.settings.format = saved.format;
      if (saved.entry === "textbook" || saved.entry === "line") this.settings.entry = saved.entry;
      if (typeof saved.digits === "number") this.settings.digits = clampDigits(saved.digits);
    }
    const view = await this.kv.get<View>("view");
    if (view === "home" || view === "cas") this.view = view;
  }
  /** Entry LaTeX, result LaTeX and the Home numeric value of finished entries; nothing that needs the engine. */
  saveHistory(): void {
    if (this.restoring) {
      // Writing now would overwrite the stored history with only the entries typed since launch.
      this.savePending = true;
      return;
    }
    if (this.saveDelayMs > 0) {
      // Snapshotting and storing up to HISTORY_LIMIT entries costs ~100 ms on a tablet: not on the Enter path.
      this.saveTimer ??= setTimeout(() => this.flushHistory(), this.saveDelayMs);
      return;
    }
    this.flushHistory();
  }
  /** Write the history now (also called when the page is hidden). */
  flushHistory(): void {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const keep = (xs: HistoryItem[]): HistoryItem[] =>
      $state.snapshot(xs).filter((i) => i.status === "done" || i.status === "error").slice(-HISTORY_LIMIT);
    void this.kv.set("history", { home: keep(this.home), cas: keep(this.cas) });
  }
  /** The stored history (up to HISTORY_LIMIT entries per view); the app reads it after the keypad is drawn. */
  async restoreHistory(): Promise<void> {
    this.restoring = true;
    let hist: { home?: HistoryItem[]; cas?: HistoryItem[] } | undefined;
    try {
      hist = await this.kv.get<{ home?: HistoryItem[]; cas?: HistoryItem[] }>("history");
    } finally {
      this.restoring = false;
    }
    if (hist) {
      // Entries typed before the store answered stay after the restored ones.
      // Fresh ids: entries typed before the store answered already use the low numbers (ids key the list).
      const keep = (xs: HistoryItem[] | undefined): HistoryItem[] =>
        (xs ?? [])
          .filter((i) => (i.status === "done" || i.status === "error") && typeof i.latex === "string")
          .slice(-HISTORY_LIMIT)
          .map((i) => ({ ...i, id: this.nextId++ }));
      this.home.splice(0, 0, ...keep(hist.home));
      this.cas.splice(0, 0, ...keep(hist.cas));
    }
    if (this.savePending) {
      this.savePending = false;
      this.saveHistory();
    }
  }
  save(): void {
    void this.kv.set("settings", { ...this.settings });
  }
  saveView(): void {
    void this.kv.set("view", this.view);
  }
}
