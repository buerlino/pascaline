// SPDX-License-Identifier: GPL-3.0-or-later
// The calculator session: current view, modifier keys, settings and the history of both views.
// Plain logic on Svelte 5 runes; the engine comes in through the Calc port.
import { PASDEG } from "../input/angles.ts";
import { CalcCancelled, type AngleUnit, type CalcError, type Calc, type CalcSettings, type ChipFactsTable, type NumberFormat, type UserName } from "../calc/port.ts";
import { ANS_KEY, pruneChips, validChips, type Chip, type ChipTable } from "../input/chips.ts";
import { parseFailText } from "../input/errors.ts";
import { loadEntry, loadParser } from "../input/parser.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { EngineMemoryError, readValueFacts } from "../engine/types.ts";
import { decimalToString, type ComplexValue, type MarkInfo, type PrecisionFacts } from "../engine/format.ts";
import { homeResultToLatex } from "../render/home.ts";
import {
  DEFAULT_FMT_CYCLE,
  factsOf,
  isFmtMode,
  isFormStep,
  markFor,
  nextForm,
  nextMode,
  normalizeCycle,
  renderNumeric,
  type FmtMode,
  type FormStep,
  type Polar,
  type Rational,
  type ResultFacts,
  modeOf,
} from "./displayMode.ts";
import { defaultLook, validLook, type Look } from "../theme/look.ts";
import { idbKv, type Kv } from "./storage.ts";
import { TapCounter } from "./taps.svelte.ts";
import { casItem, chipFactsOf, chipOf, FULL_LIMIT, homeItem, ITEMS_LIMIT } from "./results.ts";

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
  /** Notations the Format key (fmt) cycles through, in canonical order. */
  fmtCycle: FmtMode[];
  /** Decimals of the Fixed mode. */
  fixDecimals: number;
  haptics: HapticsSettings;
  /** Settings › Appearance (R50e): family, brightness, High contrast, Plain keys. */
  look: Look;
}
/** The stored settings' version (docs/04 6.2): 1 = no field (digits ≤ 15, formats std/sci/eng), 2 = digits ≤ 30, pfx,
 *  3 = `look` (R50e). */
export const SETTINGS_SCHEMA = 3;
/** Most significant digits the setting allows (docs/04 2.5). */
export const MAX_DIGITS = 30;
export const defaultSettings: Settings = {
  digits: 12,
  angle: "rad",
  format: "std",
  entry: "textbook",
  fmtCycle: [...DEFAULT_FMT_CYCLE],
  fixDecimals: 4,
  haptics: { on: false, strength: 50, ms: 15 },
  look: defaultLook(),
};

/** "note" is a line the app says itself (G19's safe start): text only, no entry and no result, and never stored. */
export type ItemStatus = "pending" | "done" | "error" | "cancelled" | "note";
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
  /** What the engine knows about the result's accuracy: the mark, and which digits are drawn (docs/04 2.4). */
  facts?: ResultFacts;
  /** An exact rational result (Fraction and Mixed fraction modes). */
  rational?: Rational;
  /** r∡θ, filled the first time the Format key shows this complex result in polar form. */
  polar?: Polar;
  /** The mode the Format key chose for this result only; undefined: the global setting (Home) or the exact form (CAS). */
  fmt?: FmtMode;
  /** The form the a b/c key chose for this result only (R10); drawn instead of `fmt` until the Format key is pressed. */
  form?: FormStep;
  /** The values of the chips in `latex` (docs/04 3.6), so a recalled entry needs no engine or index. Ans is not kept. */
  chips?: ChipTable;
  /** The value a \res chip of this result carries (docs/04 2.8): the exact text, or its confirmed decimal (R65). */
  full?: string;
  /** `full` is the exact value (a fraction, an exact expression), not rounded digits. */
  fullExact?: boolean;
  /** CAS in DEG: the text drawn, when `full` (the radian text of chips and Ans) differs from it; Copy gives this one. */
  drawn?: string;
  /** An inexact chip went into the input, so the result is never marked "=" (docs/04 2.4, decisions M4-4). */
  inexactInput?: boolean;
  /** CAS: the stored values the input read, each with the view that stored it (F28); absent when there is none. */
  uses?: UsedValue[];
  /** G67: the input changed one of the engine's settings, which was put back (a line under the result says so). */
  settingReset?: true;
  startedAt: number;
}

export interface UsedValue {
  name: string;
  preview: string;
  view: View;
}

/** A stored `uses` read back from IndexedDB: the well-formed entries only. */
function validUses(x: unknown): UsedValue[] | undefined {
  const ok = (Array.isArray(x) ? (x as Partial<UsedValue>[]) : []).filter(
    (u): u is UsedValue => typeof u?.name === "string" && typeof u.preview === "string" && (u.view === "home" || u.view === "cas"),
  );
  return ok.length ? ok : undefined;
}

const HISTORY_LIMIT = 200;
/** R91: the tidy-up of Giac's latex (render/tidy.ts) is only needed once a result is in, so it is a chunk of its own: it
 *  loads beside the first job (and when idle, main.ts), and a failed load is tried again by the next job. */
let tidyChunk: Promise<typeof import("../render/tidy.ts")> | undefined;
export const loadTidy = (): Promise<typeof import("../render/tidy.ts")> =>
  (tidyChunk ??= import("../render/tidy.ts").catch((e: unknown) => {
    tidyChunk = undefined;
    throw e;
  }));
/** Start the tidy chunk's load beside a job; a failure here is dealt with where the result is drawn (tidyOr). */
const prefetchTidy = (): Promise<typeof import("../render/tidy.ts")> => {
  const p = loadTidy();
  p.catch(() => {});
  return p;
};
/** Tidy `raw`; a chunk that will not load (a tab open across a redeploy: the old hashed file is gone) never turns the
 *  finished result into an error: one more try, then `fallback` is drawn. */
async function tidyOr(load: Promise<typeof import("../render/tidy.ts")>, raw: string, fallback: string): Promise<string> {
  try {
    return (await load).tidyGiacLatex(raw);
  } catch {
    try {
      return (await loadTidy()).tidyGiacLatex(raw);
    } catch {
      return fallback;
    }
  }
}
const errorText = (code: CalcError | undefined, fallback: string): string =>
  code ? t(`error.${code}` as MessageKey) : fallback;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));
const clampDigits = (n: number): number => Math.min(MAX_DIGITS, Math.max(1, Math.round(n)));

/** Stored facts read back from IndexedDB, through the one mapping for stored facts (readValueFacts: an item stored
 *  before G76 says `exactRational`): kept when they have the shape, else dropped (the item then shows no mark). */
function validFacts(x: unknown): ResultFacts | undefined {
  if (!x || typeof x !== "object") return undefined;
  const f = x as Record<string, unknown>;
  const exactKey = (o: Record<string, unknown>): boolean => typeof (o["exact"] ?? o["exactRational"]) === "boolean";
  const facts = readValueFacts(f);
  if (!facts || !exactKey(f) || f["reliableDigits"] === undefined) return undefined;
  const d = f["digits"];
  if (d !== undefined && !(typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 1000)) return undefined;
  const items = f["items"];
  if (items !== undefined && (!Array.isArray(items) || items.length > ITEMS_LIMIT)) return undefined;
  const els: PrecisionFacts[] = [];
  for (const it of Array.isArray(items) ? (items as unknown[]) : []) {
    const e = it && typeof it === "object" ? (it as Record<string, unknown>) : null;
    const ef = e && exactKey(e) ? readValueFacts(e) : null;
    if (!e || !ef) return undefined;
    els.push({ ...ef, ...(e["value"] ? { value: e["value"] as ComplexValue } : {}) });
  }
  return {
    ...facts,
    ...(d !== undefined ? { digits: d } : {}),
    ...(Array.isArray(items) ? { items: els } : {}),
    ...(f["shape"] !== undefined ? { shape: f["shape"] as [number, number] } : {}),
  };
}

/**
 * The settings from what was stored (docs/04 6.2): field by field, so a wrong or missing field keeps its default.
 * `schema` absent is version 1 (digits ≤ 15, formats std/sci/eng); version 2 allows digits ≤ 30 and `pfx`; version 3
 * adds `look`. Every older value stays valid, so the migration only has to write the data back with the new schema.
 * `firstLook` is the look of a start with nothing stored (Android: Dark; High contrast when the system asks for it).
 */
export function migrateSettings(saved: unknown, firstLook: Look = defaultSettings.look): { settings: Settings; migrated: boolean } {
  const s = structuredClone(defaultSettings);
  s.look = { ...firstLook };
  const x = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof Settings | "schema", unknown>>;
  if (x["angle"] === "rad" || x["angle"] === "deg") s.angle = x["angle"];
  if (x["format"] === "std" || x["format"] === "sci" || x["format"] === "eng" || x["format"] === "pfx") s.format = x["format"];
  if (x["entry"] === "textbook" || x["entry"] === "line") s.entry = x["entry"];
  if (typeof x["digits"] === "number" && Number.isFinite(x["digits"])) s.digits = clampDigits(x["digits"]);
  if (Array.isArray(x["fmtCycle"])) s.fmtCycle = normalizeCycle(x["fmtCycle"].filter(isFmtMode));
  if (typeof x["fixDecimals"] === "number" && Number.isFinite(x["fixDecimals"])) s.fixDecimals = clamp(x["fixDecimals"], 0, 12);
  const h = x["haptics"];
  if (h && typeof h === "object") {
    const hh = h as Partial<HapticsSettings>;
    const d = defaultSettings.haptics;
    s.haptics = {
      on: hh.on === true,
      strength: clamp(typeof hh.strength === "number" ? hh.strength : d.strength, 0, 100),
      ms: clamp(typeof hh.ms === "number" ? hh.ms : d.ms, HAPTIC_MS_RANGE.min, HAPTIC_MS_RANGE.max),
    };
  }
  s.look = validLook(x["look"], firstLook);
  return { settings: s, migrated: x["schema"] !== SETTINGS_SCHEMA };
}

/** A stored history item with a fresh id; chip fields that do not have their shape are dropped. */
function restoredItem(i: HistoryItem, id: number): HistoryItem {
  const { chips, full, fullExact, drawn, facts, uses, settingReset, ...rest } = i as HistoryItem & { form?: unknown };
  const { form, ...base } = rest;
  const out: HistoryItem = { ...base, id };
  if (isFormStep(form)) out.form = form;
  const f = validFacts(facts);
  if (f) out.facts = f;
  const c = validChips(chips);
  if (c) out.chips = c;
  const u = validUses(uses);
  if (u) out.uses = u;
  if (settingReset === true) out.settingReset = true;
  if (typeof full === "string" && full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = fullExact === true;
  }
  if (typeof drawn === "string" && drawn.length <= FULL_LIMIT) out.drawn = drawn;
  return out;
}

/** The look of a first start: Dark in the Android app, System in the PWA; High contrast when the phone asks for more (R50e). */
function firstLook(): Look {
  const w = globalThis as { Capacitor?: { isNativePlatform?: () => boolean }; matchMedia?: (q: string) => { matches: boolean } };
  return defaultLook(w.Capacitor?.isNativePlatform?.() === true, w.matchMedia?.("(prefers-contrast: more)").matches === true);
}

export class Session {
  view = $state<View>("home");
  shift = $state(false);
  alpha = $state(false);
  /** Alpha lock (L3): alpha stays on after each key; capsLock keeps shift on too (shift + alpha: lower case, P4). */
  alphaLock = $state(false);
  capsLock = $state(false);
  /** Shift lock (a flick up on Shift, R9): shift stays on after each key until Shift is tapped or flicked again. */
  shiftLock = $state(false);
  /** The local count of Shift and Alpha taps (R9, P7 point 4); shown in Settings. */
  readonly taps: TapCounter;
  settings = $state<Settings>(structuredClone(defaultSettings));
  home = $state<HistoryItem[]>([]);
  cas = $state<HistoryItem[]>([]);
  /** Set when the engine is starting or failed to start. */
  engineState = $state<"starting" | "ready" | "failed">("starting");
  /** The user's variables and functions, the stored ones included (Vars, Find's live items; docs/04 3.4, 6.2). */
  userNames = $state<UserName[]>([]);

  private nextId = 1;
  private readonly calc: Calc;
  /** Settles once the stored names were first read (or the engine failed): a parse waits for it, so a function from
   *  before a relaunch is a call from the first Enter on (R56). */
  private readonly namesRead: Promise<void>;

  private readonly kv: Kv;
  /** Put a look on the page (main.ts: theme/lookApply.ts); called when it changes and once the settings are read. */
  onLook: ((look: Look) => void) | undefined;
  /** 0 = write the history at once (tests); the app sets a delay so Enter does not wait for the store. */
  saveDelayMs = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private restoring = false;
  private savePending = false;

  constructor(calc: Calc, kv: Kv = idbKv) {
    this.kv = kv;
    this.calc = calc;
    this.taps = new TapCounter(kv);
    this.namesRead = calc.ready().then(
      (info) => {
        if (info?.safeStart) this.note(t("engine.safeStart"));
        this.engineState = "ready";
        return this.refreshNames();
      },
      () => {
        this.engineState = "failed";
      },
    );
  }

  /** Says something once as a history line, in both views (the definitions are shared, and the open view may still be
   *  restoring). Notes are not stored: the saved history keeps finished entries only. */
  private note(text: string): void {
    for (const view of ["home", "cas"] as const) {
      (view === "home" ? this.home : this.cas).push({
        id: this.nextId++,
        view,
        latex: "",
        status: "note",
        resultLatex: "",
        text,
        approximate: false,
        startedAt: performance.now(),
      });
    }
  }

  /** Reads the user's names again from the engine's definitions log (after a job that may have changed it). */
  async refreshNames(): Promise<void> {
    try {
      this.userNames = await this.calc.names();
    } catch {
      /* the engine restarts on its own; the next job refreshes the list */
    }
  }

  /** Memory (R4b): purge these names from the engine and its definitions log. The list drops them at once, then reads
   *  the log again (a purge that failed brings a name back). */
  async forget(names: readonly string[]): Promise<void> {
    if (names.length === 0) return;
    const gone = new Set(names);
    this.userNames = this.userNames.filter((u) => !gone.has(u.name));
    try {
      await this.calc.home(`purge(${names.join(",")})`, this.settings);
    } catch {
      /* cancelled or the engine restarted: the names are read again below */
    }
    await this.refreshNames();
  }

  /** A function the engine just took (`p(x):=…`) counts for the next parse at once; the names read after the job
   *  (refreshNames) then replace this entry with the log's own (R56). */
  private noteFunction(name: string, view: View, preview: string): void {
    const rest = this.userNames.filter((u) => u.name !== name);
    this.userNames = [...rest, { name, kind: "fn", preview, view, time: Date.now() }];
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
  // Lock flicks (P7 point 3, R9): up on Shift locks shift, down on Alpha locks capitals, up on Alpha lower case. One
  // lock at a time: a lock flick replaces the other lock, and the same flick again (or a tap on that key) unlocks.
  toggleShift(): void {
    if (this.shiftLock) {
      this.shiftLock = false;
      this.shift = false;
      return;
    }
    this.shift = !this.shift;
  }
  /** Flick up on Shift. */
  flickShiftLock(): void {
    const on = !this.shiftLock;
    this.unlock();
    this.shiftLock = on;
    this.shift = on;
  }
  /** Flick down (capitals) or up (lower case) on Alpha. */
  flickAlphaLock(lower: boolean): void {
    const on = !(this.alphaLock && this.capsLock === lower);
    this.unlock();
    this.alphaLock = on;
    this.capsLock = on && lower;
    this.alpha = on;
    this.shift = on && lower;
  }
  private unlock(): void {
    this.shiftLock = this.alphaLock = this.capsLock = this.alpha = this.shift = false;
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
      this.shiftLock = false; // one lock at a time (a shift lock made this a lower-case lock)
    } else this.alpha = true;
  }
  clearModifiers(): void {
    this.shift = this.shiftLock || (this.alphaLock && this.capsLock);
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
    if (!ans && this.hasResult(view) && /\\ans(?![a-zA-Z])/.test(latex)) {
      // A finished result with no chip value (a symbolic text over 2 kB, R44): say why, not "no result yet"
      live.status = "error";
      live.text = "Ans: the last result is too long to reuse (over 2 kB)";
      this.saveHistory();
      return Promise.resolve();
    }
    return this.finish(live, view, latex, table, giacOverride).finally(() => {
      this.saveHistory();
      if (live.status === "done") void this.refreshNames();
    });
  }

  /** The chip a finished result gives when it is tapped or picked (docs/04 2.8); undefined: insert it as drawn. */
  chipFor(item: HistoryItem): Chip | undefined {
    return chipOf(item);
  }
  /** Whether the view has a finished result (Ans-first inserts \\ans then, R44). */
  hasResult(view: View = this.view): boolean {
    const list = view === "home" ? this.home : this.cas;
    return list.some((item) => item.status === "done");
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
    let defines: string | undefined;
    let named: ChipFactsTable | undefined;
    try {
      if (giacOverride !== undefined) giac = giacOverride;
      else {
        const [parser, entry] = await Promise.all([loadParser(), loadEntry(), this.namesRead]);
        if (live.status !== "pending") return; // Cancel came while the parser chunk or the names were loading
        // R56: single letters are calls when the user's names (Home and CAS share them) hold them as functions
        const userFunctions = parser.userFunctionsOf(this.userNames);
        // R65: Home sends a chip that is not exact by name. A power keeps Giac's principal root here, as in CAS (R66)
        const p = entry.giacOfEntry(latex, view, { chips, userFunctions });
        giac = p.giac;
        defines = p.defines;
        if (p.inexact) live.inexactInput = true;
        if (p.named) named = chipFactsOf(p.named);
      }
    } catch (e) {
      live.status = "error";
      live.text = parseFailText(e);
      return;
    }
    const s: CalcSettings = { digits: this.settings.digits, angle: this.settings.angle, format: this.settings.format };
    try {
      if (view === "home") {
        const tidy = prefetchTidy();
        const r = await (named ? this.calc.home(giac, s, named) : this.calc.home(giac, s));
        if (live.status !== "pending") return;
        const latex = !r.ok ? "" : r.latex !== undefined ? await tidyOr(tidy, r.latex, homeResultToLatex(r.display)) : homeResultToLatex(r.display);
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.ok ? r.display : errorText(r.error, r.display);
        if (r.settingReset) live.settingReset = true;
        // The value, its facts and the chip text, by the one rule (results.ts, G86)
        Object.assign(live, homeItem(r, live.inexactInput === true));
        // A result that is not a number is drawn from Giac's latex(), as in CAS (R18f3); numbers from our formatter.
        if (r.ok) live.resultLatex = latex;
      } else {
        const tidy = prefetchTidy();
        const r = await this.calc.cas(giac, s);
        if (live.status !== "pending") return;
        const latex = r.ok ? await tidyOr(tidy, r.latex, r.latex) : "";
        if (live.status !== "pending") return;
        live.status = r.ok ? "done" : "error";
        live.text = r.ok ? r.text : errorText(r.error, r.text);
        if (r.settingReset) live.settingReset = true;
        if (r.ok) {
          live.resultLatex = latex;
          if (r.uses?.length) live.uses = r.uses;
          Object.assign(live, casItem(r, live.inexactInput === true));
        }
      }
      if (defines && live.status === "done") this.noteFunction(defines, view, live.text);
    } catch (e) {
      if (live.status !== "pending") return;
      if (e instanceof CalcCancelled) {
        live.status = "cancelled";
      } else {
        live.status = "error";
        live.text = e instanceof EngineMemoryError ? t("error.memory") : e instanceof Error ? e.message : String(e);
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
    const shown = item.view === "home" || item.fmt !== undefined || item.form !== undefined || item.facts !== undefined;
    if (item.status === "done" && shown) {
      const r = renderNumeric(item, this.modeOf(item), this.displayContext());
      if (r) return r;
    }
    return { text: item.text, latex: item.resultLatex };
  }

  /** The mode an item is drawn in: the a b/c form when one is chosen, else the Format key's notation. */
  private modeOf(item: HistoryItem): FmtMode | undefined {
    return modeOf(item, this.settings);
  }

  /** The mark before a finished result (docs/04 2.4), for the form it is drawn in; null: a non-number, or none known. */
  mark(item: HistoryItem): MarkInfo | null {
    if (item.status !== "done") return null;
    return markFor(item, this.modeOf(item), this.displayContext());
  }

  displayContext(): { format: NumberFormat; digits: number; fixDecimals: number; angle: AngleUnit } {
    const s = this.settings;
    return { format: s.format, digits: s.digits, fixDecimals: s.fixDecimals, angle: s.angle };
  }

  /**
   * The Format key: show the last result of the current view in the next ticked mode (Settings). Changes that
   * result only. Resolves true when the display changed.
   */
  async cycleFormat(): Promise<boolean> {
    const item = this.items.at(-1);
    if (!item || item.status !== "done" || this.busy) return false;
    if (item.form !== undefined) {
      // a form chosen with a b/c: the Format key goes back to the number in its notation
      delete item.form;
      this.saveHistory();
      return true;
    }
    const exactBase = item.view === "cas";
    const next = nextMode(item.fmt ?? (exactBase ? undefined : this.settings.format), this.settings.fmtCycle, factsOf(item), exactBase);
    if (!next) return false;
    if (next.mode === "polar" && item.value && item.polar?.angle !== this.settings.angle && !(await this.computePolar(item, item.value)))
      return false;
    item.fmt = next.mode;
    this.saveHistory();
    return true;
  }

  /**
   * The a b/c key on an empty line (R10): show the last result of the current view in its other form (decimal ↔
   * fraction as on the G2; a+bi ↔ polar). Changes that result only. Resolves true
   * when the display changed; false when no other form applies (a whole number, a symbolic result).
   */
  async cycleForm(): Promise<boolean> {
    const item = this.items.at(-1);
    if (!item || item.status !== "done" || this.busy) return false;
    const next = nextForm(item.form, factsOf(item), item.view === "cas");
    if (!next) return false;
    if (next.form === "polar" && item.value && item.polar?.angle !== this.settings.angle && !(await this.computePolar(item, item.value)))
      return false;
    if (next.form === undefined) delete item.form;
    else item.form = next.form;
    this.saveHistory();
    return true;
  }

  /** abs and arg of the value, from the engine (arg follows the angle unit setting). */
  private async computePolar(item: HistoryItem, v: ComplexValue): Promise<boolean> {
    const z = `((${decimalToString(v.re)})+(${decimalToString(v.im)})*i)`;
    const s: CalcSettings = { digits: this.settings.digits, angle: this.settings.angle, format: this.settings.format };
    try {
      const [r, th] = [await this.calc.home(`abs(${z})`, s), await this.calc.home(`(arg(${z})/${PASDEG})`, s)] // G46: Giac answers in radians; the factor gives the mode's unit;
      if (!r.ok || !th.ok || !r.value || !th.value) return false;
      item.polar = { r: r.value.re, theta: th.value.re, angle: this.settings.angle };
      return true;
    } catch {
      return false;
    }
  }

  /** Delete one row of the open view (R11). A running row is not deleted: Cancel stops it first. */
  removeItem(item: HistoryItem): boolean {
    const list = this.items;
    const k = list.findIndex((i) => i.id === item.id);
    const found = list[k];
    if (!found || found.status === "pending") return false;
    list.splice(k, 1);
    this.saveHistory();
    return true;
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
    const saved = await this.kv.get<unknown>("settings");
    const { settings, migrated } = migrateSettings(saved, firstLook());
    if (saved) Object.assign(this.settings, settings);
    else this.settings.look = settings.look;
    // docs/04 6.2: write the settings back as the newest schema. A start with nothing stored writes its look too, so
    // High contrast from `prefers-contrast: more` is only the first start's default (R50e).
    if (saved ? migrated : true) this.save();
    this.onLook?.($state.snapshot(this.settings.look));
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
  save(): void {
    void this.kv.set("settings", { schema: SETTINGS_SCHEMA, ...$state.snapshot(this.settings) });
  }
  saveView(): void {
    void this.kv.set("view", this.view);
  }
}
