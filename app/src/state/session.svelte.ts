// SPDX-License-Identifier: GPL-3.0-or-later
// The calculator session: current view, modifier keys, settings and the history of both views.
// Plain logic on Svelte 5 runes; the engine comes in through the Calc port.
import { CalcCancelled, type AngleUnit, type CalcError, type Calc, type CalcSettings, type NumberFormat } from "../calc/port.ts";
import { ANS_KEY, pruneChips, validChips, type Chip, type ChipTable } from "../input/chips.ts";
import { SerializeError } from "../input/emit.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { decimalFromRational, decimalFromString, decimalToString, type ComplexValue, type PrecisionWarn } from "../engine/format.ts";
import { homeResultToLatex } from "../render/home.ts";
import { tidyGiacLatex } from "../render/tidy.ts";
import {
  DEFAULT_FMT_CYCLE,
  factsOf,
  isFmtMode,
  nextMode,
  normalizeCycle,
  renderNumeric,
  type FmtMode,
  type Polar,
  type Rational,
} from "./displayMode.ts";
import { idbKv, type Kv } from "./storage.ts";

export type View = "home" | "cas";
export type EntryMode = "textbook" | "line";

/** Key vibration (off by default). Strength 0..100 %, duration in ms; the web build can only set the duration. */
export interface HapticsSettings {
  on: boolean;
  strength: number;
  ms: number;
}
export const HAPTIC_MS_RANGE = { min: 5, max: 100 } as const;

export interface Settings extends CalcSettings {
  entry: EntryMode;
  /** Modes the Format key (fmt) cycles through, in canonical order. */
  fmtCycle: FmtMode[];
  /** Decimals of the Fixed mode. */
  fixDecimals: number;
  haptics: HapticsSettings;
}
export const defaultSettings: Settings = {
  digits: 12,
  angle: "rad",
  format: "std",
  entry: "textbook",
  fmtCycle: [...DEFAULT_FMT_CYCLE],
  fixDecimals: 4,
  haptics: { on: false, strength: 50, ms: 15 },
};

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
  /** An exact rational result (Fraction and Mixed fraction modes). */
  rational?: Rational;
  /** r∡θ, filled the first time the Format key shows this complex result in polar form. */
  polar?: Polar;
  /** The mode the Format key chose for this result only; undefined: the global setting (Home) or the exact form (CAS). */
  fmt?: FmtMode;
  /** The values of the chips in `latex` (docs/04 3.6), so a recalled entry needs no engine or index. Ans is not kept. */
  chips?: ChipTable;
  /** The value a \res chip of this result carries (docs/04 2.8): the exact text, or every digit the engine gave. */
  full?: string;
  /** `full` is the exact value (a fraction, an exact expression), not rounded digits. */
  fullExact?: boolean;
  /** An inexact chip went into the input, so the result is never marked "=" (docs/04 2.4; R3 draws the mark). */
  inexactInput?: boolean;
  /** The engine's facts about the number (docs/04 2.4, 8.2): Copy writes only confirmed digits and the session text carries the mark. */
  exactRational?: boolean;
  /** Digits confirmed by the agreement check; null = exact. */
  reliableDigits?: number | null;
  warn?: PrecisionWarn;
  startedAt: number;
}

const HISTORY_LIMIT = 200;
/** A chip carries at most this much text (docs/04 2.8); a longer result is inserted as it is drawn. */
export const FULL_LIMIT = 2048;
/** Engine text with a decimal point or an E exponent is rounded digits, not an exact value. */
const isDigitsText = (t: string): boolean => /\.|\d[eE][+-]?\d/.test(t);
const errorText = (code: CalcError | undefined, fallback: string): string =>
  code ? t(`error.${code}` as MessageKey) : fallback;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));
const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;
function rationalOf(text: string | undefined): Rational | undefined {
  const m = text === undefined ? null : RATIONAL.exec(text.trim());
  if (!m || m[1] === undefined || (m[2] !== undefined && BigInt(m[2]) === 0n)) return undefined;
  return { n: m[1], d: m[2] ?? "1" };
}
const clampDigits = (n: number): number => Math.min(15, Math.max(1, Math.round(n)));

/** The engine's precision facts onto the history item (Copy and the session text read them). */
function noteFacts(i: HistoryItem, r: { exactRational: boolean; reliableDigits: number | null; warn?: PrecisionWarn }): void {
  i.exactRational = r.exactRational;
  i.reliableDigits = r.reliableDigits;
  if (r.warn) i.warn = r.warn;
}

/** A stored history item with a fresh id; chip fields that do not have their shape are dropped. */
function restoredItem(i: HistoryItem, id: number): HistoryItem {
  const { chips, full, fullExact, ...rest } = i;
  const out: HistoryItem = { ...rest, id };
  const c = validChips(chips);
  if (c) out.chips = c;
  if (typeof full === "string" && full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = fullExact === true;
  }
  return out;
}

export class Session {
  view = $state<View>("home");
  shift = $state(false);
  alpha = $state(false);
  /** Alpha lock (L3): alpha stays on after each key; capsLock keeps shift on too (shift + alpha: lower case, P4). */
  alphaLock = $state(false);
  capsLock = $state(false);
  settingsOpen = $state(false);
  settings = $state<Settings>(structuredClone(defaultSettings));
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

  // ---- modifiers: one-shot, as on a calculator. Alpha twice locks it (alpha, alpha locks capitals; shift, alpha, alpha lower case);
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
  setFmtMode(mode: FmtMode, on: boolean): void {
    const ticked = new Set(this.settings.fmtCycle);
    if (on) ticked.add(mode);
    else ticked.delete(mode);
    this.settings.fmtCycle = normalizeCycle([...ticked]);
    this.save();
  }
  setFixDecimals(n: number): void {
    this.settings.fixDecimals = clamp(n, 0, 12);
    this.save();
  }
  setHaptics(h: Partial<HapticsSettings>): void {
    const next = { ...this.settings.haptics, ...h };
    this.settings.haptics = {
      on: next.on === true,
      strength: clamp(next.strength, 0, 100),
      ms: clamp(next.ms, HAPTIC_MS_RANGE.min, HAPTIC_MS_RANGE.max),
    };
    this.save();
  }

  // ---- evaluation
  /**
   * Start evaluating the entry in the current view. Returns undefined when there is nothing to do (empty
   * line, or a job is running); otherwise the history item exists at once and the promise settles when
   * the job has finished, failed or been cancelled.
   */
  submit(latex: string, giacOverride?: string, chips: ChipTable = {}): Promise<void> | undefined {
    if (latex.trim() === "" || this.busy) return undefined;
    const view = this.view;
    const list = view === "home" ? this.home : this.cas;
    // Ans is the view's last result now, at Enter (as on the reference), not when the key was pressed.
    const ans = this.lastChip(view);
    const kept = pruneChips(chips, latex);
    const table: ChipTable = ans ? { ...kept, [ANS_KEY]: ans } : kept;
    list.push({
      id: this.nextId++,
      view,
      latex,
      status: "pending",
      resultLatex: "",
      text: "",
      approximate: false,
      ...(Object.keys(kept).length ? { chips: kept } : {}),
      startedAt: performance.now(),
    });
    // Read and write through the proxy in the list from here on.
    const live = list[list.length - 1] as HistoryItem;
    if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
    return this.finish(live, view, latex, table, giacOverride).finally(() => this.saveHistory());
  }

  /** The chip a finished result gives when it is tapped or picked (docs/04 2.8); undefined: insert it as drawn. */
  chipFor(item: HistoryItem): Chip | undefined {
    if (item.status !== "done" || item.full === undefined) return undefined;
    return { value: item.full, exact: item.fullExact === true };
  }
  /** The last finished result of a view, as Ans. */
  lastChip(view: View = this.view): Chip | undefined {
    const list = view === "home" ? this.home : this.cas;
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i] as HistoryItem;
      if (item.status === "done") return this.chipFor(item);
    }
    return undefined;
  }

  private async finish(live: HistoryItem, view: View, latex: string, chips: ChipTable, giacOverride?: string): Promise<void> {
    let giac: string;
    try {
      if (giacOverride !== undefined) giac = giacOverride;
      else {
        const p = latexToGiacInfo(latex, { chips });
        giac = p.giac;
        if (p.inexact) live.inexactInput = true;
      }
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
        if (r.ok) noteFacts(live, r);
        const q = r.value ? rationalOf(r.exact) : undefined;
        if (q) live.rational = q;
        if (r.ok) live.resultLatex = homeResultToLatex(r.display);
        // The chip value: the exact fraction when there is one, else the engine's full value (every confirmed digit)
        const full = r.exact ?? r.full;
        if (r.ok && full && full.length <= FULL_LIMIT) {
          live.full = full;
          live.fullExact = !r.approximate && (r.exact !== undefined || r.exactRational || !isDigitsText(full));
        }
      } else {
        const r = await this.calc.cas(giac, s);
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.ok ? r.text : errorText(r.error, r.text);
        if (r.ok) {
          live.resultLatex = tidyGiacLatex(r.latex);
          // A plain number (3/4, 2.5): the Format key can show it in the other forms.
          const q = rationalOf(r.text);
          const dec = q ? decimalFromRational(BigInt(q.n), BigInt(q.d)) : decimalFromString(r.text);
          if (dec) live.value = { re: dec, im: decimalFromRational(0n, 1n) };
          if (q) live.rational = q;
          // A float result: every confirmed digit the engine gave (r.text is drawn at the shown digits only).
          const nf = r.numeric?.full;
          const full = nf !== undefined && nf.length > 0 ? nf : r.text;
          if (full.length <= FULL_LIMIT) {
            live.full = full;
            live.fullExact = !isDigitsText(full);
          }
          if (r.numeric) noteFacts(live, r.numeric);
        }
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

  /** What the history shows for a finished item: Home numbers follow the current digits and format, or the mode
   *  the Format key chose for that item; a CAS result changes only when the Format key has chosen a mode. */
  display(item: HistoryItem): { text: string; latex: string } {
    if (item.status === "done" && (item.view === "home" || item.fmt !== undefined)) {
      const r = renderNumeric(item, item.fmt, {
        format: this.settings.format,
        digits: this.settings.digits,
        fixDecimals: this.settings.fixDecimals,
        angle: this.settings.angle,
      });
      if (r) return r;
    }
    return { text: item.text, latex: item.resultLatex };
  }

  /**
   * The Format key: show the last result of the current view in the next ticked mode (Settings). Changes that
   * result only. Resolves true when the display changed.
   */
  async cycleFormat(): Promise<boolean> {
    const item = this.items.at(-1);
    if (!item || item.status !== "done" || this.busy) return false;
    const exactBase = item.view === "cas";
    const next = nextMode(item.fmt ?? (exactBase ? undefined : this.settings.format), this.settings.fmtCycle, factsOf(item), exactBase);
    if (!next) return false;
    if (next.mode === "polar" && item.value && item.polar?.angle !== this.settings.angle && !(await this.computePolar(item, item.value)))
      return false;
    item.fmt = next.mode;
    this.saveHistory();
    return true;
  }

  /** abs and arg of the value, from the engine (arg follows the angle unit setting). */
  private async computePolar(item: HistoryItem, v: ComplexValue): Promise<boolean> {
    const z = `((${decimalToString(v.re)})+(${decimalToString(v.im)})*i)`;
    const s: CalcSettings = { digits: this.settings.digits, angle: this.settings.angle, format: this.settings.format };
    try {
      const [r, th] = [await this.calc.home(`abs(${z})`, s), await this.calc.home(`arg(${z})`, s)];
      if (!r.ok || !th.ok || !r.value || !th.value) return false;
      item.polar = { r: r.value.re, theta: th.value.re, angle: this.settings.angle };
      return true;
    } catch {
      return false;
    }
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
      if (Array.isArray(saved.fmtCycle)) this.settings.fmtCycle = normalizeCycle(saved.fmtCycle.filter(isFmtMode));
      if (typeof saved.fixDecimals === "number") this.settings.fixDecimals = clamp(saved.fixDecimals, 0, 12);
      const h = saved.haptics;
      if (h && typeof h === "object") this.setHapticsQuiet(h);
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
          .map((i) => restoredItem(i, this.nextId++));
      this.home.splice(0, 0, ...keep(hist.home));
      this.cas.splice(0, 0, ...keep(hist.cas));
    }
    if (this.savePending) {
      this.savePending = false;
      this.saveHistory();
    }
  }
  private setHapticsQuiet(h: Partial<HapticsSettings>): void {
    const d = defaultSettings.haptics;
    this.settings.haptics = {
      on: h.on === true,
      strength: clamp(typeof h.strength === "number" ? h.strength : d.strength, 0, 100),
      ms: clamp(typeof h.ms === "number" ? h.ms : d.ms, HAPTIC_MS_RANGE.min, HAPTIC_MS_RANGE.max),
    };
  }
  save(): void {
    void this.kv.set("settings", $state.snapshot(this.settings));
  }
  saveView(): void {
    void this.kv.set("view", this.view);
  }
}
