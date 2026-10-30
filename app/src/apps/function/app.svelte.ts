// SPDX-License-Identifier: GPL-3.0-or-later
// The Function app: up to ten functions of x (F1…F9, F0) in Symb, drawn in Plot, tabulated in Num.
// Drawing uses our own JS evaluator (D7); every number shown (trace, table, analysis) comes from the engine.
import { CalcCancelled, engineFormat, type Calc } from "../../calc/port.ts";
import { confirmedText, isWarned } from "../../calc/shown.ts";
import { formatComplex, type ComplexValue, type DecimalValue } from "../../engine/format.ts";
import { numberSource } from "../../clipboard/source.ts";
import type { CopySource } from "../../clipboard/text.ts";
import { t } from "../../i18n/index.ts";
import { tc } from "../../clipboard/strings.ts";
import { addMul, decText, decToNumber, nearestK, niceStep, parseDec, plainNumber, showDecimal, type Dec } from "../decimal.ts";
import { slotNames, SlotsState, type SlotsJson } from "../slots.svelte.ts";
import type { AppHost, AppInstance, MenuItem, NavDir, SubMenu, ViewId } from "../types.ts";
import { compileDefinition, type Compiled } from "./compile.ts";
import type { AnalysisOutcome, AnalysisRequest, Cell } from "./engineApi.ts";

import { brightness } from "../../theme.svelte.ts";

/** Curve colours (our own palette), one list per brightness: each at least 3:1 on its --bg (src/style.test.ts). */
export const CURVE_COLORS_DARK = ["#e8743b", "#3fa7d6", "#59c36a", "#d65db1", "#f2c14e", "#8f7ee6", "#e05d5d", "#4fc1b5", "#b0b8c4", "#c4884f"];
export const CURVE_COLORS_LIGHT = ["#e56120", "#2a93c3", "#389c48", "#d65db1", "#b1800d", "#8b7ae5", "#e05d5d", "#36988e", "#7d8a9e", "#bb7b3f"];
/** The list for the brightness the page is in (reactive). */
export const curveColors = (): readonly string[] => (brightness() === "light" ? CURVE_COLORS_LIGHT : CURVE_COLORS_DARK);

export interface PlotWindow {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}
/** Default window: x from -10 to 10, y at the same scale as x, centred on 0 (assumed, docs/decisions.md). */
export const DEFAULT_X: readonly [number, number] = [-10, 10];

export interface Mark {
  x: number;
  y: number;
  slot: number;
}
export interface Readout {
  /** Label and value pairs, already formatted. */
  lines: { label: string; value: string; /** ⚠: the value behind the line is warned (M4-10) */ warn?: boolean; /** The engine number behind the line, for Copy. */ cell?: Cell; /** The line the Copy key copies. */ primary?: boolean }[];
  info: string;
  warn: boolean;
}

interface Stored {
  slots: SlotsJson;
  win: PlotWindow | null;
  num: { start: string; step: string };
  trace: { slot: number; x: string };
}

const valueToNumber = (v: DecimalValue): number =>
  v.digits === "" ? 0 : Number(`${v.neg ? "-" : ""}0.${v.digits}e${v.exp + 1}`);
/** For drawing marks only (never shown). */
export const cellNumber = (c: Cell | undefined): number | undefined =>
  c?.value ? valueToNumber(c.value.re) : undefined;

export class FunctionApp implements AppInstance {
  readonly id = "function" as const;
  readonly views: readonly ViewId[] = ["symb", "plot", "num"];
  readonly slots = new SlotsState(slotNames("F"));
  compiled = $state.raw<Compiled[]>([]);

  /** null until Plot has been drawn once (then y follows the board's aspect). */
  win = $state<PlotWindow | null>(null);
  trace = $state({ on: true, slot: 0, x: "0" });
  marks = $state.raw<Mark[]>([]);
  readout = $state<Readout | undefined>(undefined);
  /** Start of a signed area, waiting for the end position (Enter). */
  areaStart = $state<string | undefined>(undefined);

  num = $state({ start: "0", step: "0.1", top: 0, rows: 12, edit: "start" as "start" | "step" });
  numXs = $state.raw<string[]>([]);
  numSlots = $state.raw<number[]>([]);

  private jobs = $state(0);
  private readonly host: AppHost;
  private readonly fc: Calc;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(host: AppHost) {
    this.host = host;
    this.fc = host.calc;
    this.compiled = this.slots.names.map(() => ({ giac: "", error: "", angle: "rad" as const }));
  }

  get angle(): "rad" | "deg" {
    return this.host.settings.angle;
  }
  get busy(): boolean {
    return this.jobs > 0;
  }
  /** Slots that are on and parse. */
  get active(): number[] {
    return this.slots.active.filter((i) => (this.compiled[i]?.giac ?? "") !== "");
  }

  // ---- formatting (Home formatter, current settings)
  fmt(c: Cell | undefined): string {
    if (!c) return "…";
    if (!c.ok) return t("function.undefined");
    // a pole or an undefined value: NaN, as the reference's Num view and Signed area show it (G2 items 19, 22)
    if (/^[-+]?(infinity|inf|undef)$/.test(c.display)) return t("function.nan");
    return c.value ? (confirmedText(c, this.host.settings) ?? c.display) : c.display;
  }
  /** ⚠: the cell shows more digits than the engine confirmed (the Num table and trace show no other mark). */
  warned(c: Cell | undefined): boolean {
    return c?.ok === true && isWarned(c, this.host.settings);
  }
  fmtValue(v: ComplexValue): string {
    const s = this.host.settings;
    return formatComplex(v, { format: engineFormat(s.format), digits: s.digits }).text;
  }
  fmtX(x: string): string {
    return showDecimal(x, this.host.settings.digits, engineFormat(this.host.settings.format));
  }

  // ---- framework hooks
  entryLabel(view: ViewId): string | undefined {
    if (view === "symb") return `${this.slots.names[this.slots.selected]}(x)=`;
    if (view === "num") return this.num.edit === "start" ? t("num.start") : t("num.step");
    return undefined;
  }

  show(view: ViewId): void {
    if (view === "symb") this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
    if (view === "num") void this.refreshNum();
    if (view === "plot") {
      this.syncAngle();
      this.fixTraceSlot();
      void this.refreshTrace();
    }
  }

  enter(view: ViewId, latex: string): void {
    if (view === "symb") {
      this.define(this.slots.selected, latex);
      this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
    } else if (view === "num") {
      const s = plainNumber(latex);
      const d = s === undefined ? undefined : parseDec(s);
      if (!d || (this.num.edit === "step" && d.m === 0n)) return;
      if (this.num.edit === "start") {
        this.num.start = decText(d);
        this.num.top = 0;
      } else this.num.step = decText(d);
      this.num.edit = "start";
      this.host.setEntry("");
      this.save();
      void this.refreshNum();
    } else if (view === "plot" && this.areaStart !== undefined) {
      void this.finishArea();
    }
  }

  nav(view: ViewId, dir: NavDir, edited: boolean): boolean {
    if (view === "symb") {
      if (edited || (dir !== "up" && dir !== "down")) return false;
      this.slots.move(dir === "up" ? -1 : 1);
      this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
      this.save();
      return true;
    }
    if (view === "num") {
      if (dir !== "up" && dir !== "down") return false;
      this.scrollNum(dir === "up" ? -1 : 1);
      return true;
    }
    if (view === "plot") {
      if (dir === "left" || dir === "right") this.moveTrace(dir === "left" ? -1 : 1);
      else this.cycleTrace(dir === "up" ? -1 : 1);
      return true;
    }
    return false;
  }

  menu(view: ViewId): MenuItem[] {
    if (view === "plot") {
      const none = this.active.length === 0;
      const why = none ? t("why.noFunction") : undefined;
      return [
        { id: "root", label: t("fcn.root"), disabled: none, reason: why, run: () => void this.analyze("root") },
        { id: "extremum", label: t("fcn.extremum"), disabled: none, reason: why, run: () => void this.analyze("extremum") },
        { id: "intersection", label: t("fcn.intersection"), disabled: none, reason: why, submenu: this.intersectionMenu() },
        { id: "slope", label: t("fcn.slope"), disabled: none, reason: why, run: () => void this.analyze("slope") },
        { id: "area", label: t("fcn.area"), disabled: none, reason: why, run: () => this.startArea() },
        { id: "default", label: t("plot.defaultWindow"), run: () => this.defaultWindow() },
        { id: "copy", label: tc("clip.copy"), disabled: !this.copyLine(), reason: tc("clip.noResult"), run: () => void this.copyReadout(this.copyLine()) },
        { id: "shown", label: tc("clip.asShown"), disabled: !this.copyLine(), reason: tc("clip.noResult"), run: () => void this.copyReadout(this.copyLine(), true) },
      ];
    }
    if (view === "num")
      return [
        { id: "start", label: t("num.setStart"), run: () => this.editNum("start") },
        { id: "step", label: t("num.setStep"), run: () => this.editNum("step") },
        { id: "csv", label: tc("clip.csv"), disabled: this.numSlots.length === 0, reason: t("why.noFunction"), run: () => void this.copyNum() },
      ];
    return [];
  }

  // ---- Copy (docs/04 section 2.6): the Num table as CSV, full values
  copyText(view: ViewId): Promise<string | undefined> | undefined {
    if (view === "plot") {
      const l = this.copyLine();
      return l ? this.readoutFull(l) : undefined;
    }
    return view === "num" ? this.numCsv() : undefined;
  }
  /** The readout line the Copy key copies: the answer of the last analysis. */
  copyLine(): Readout["lines"][number] | undefined {
    return this.readout?.lines.find((l) => l.primary && l.cell?.ok);
  }
  /** A readout line's value with every confirmed digit (the engine's full value, up to 40). */
  async readoutFull(l: Readout["lines"][number]): Promise<string | undefined> {
    if (!l.cell) return undefined;
    const { copyFull } = await import("../../clipboard/impl.ts");
    return this.csvCell(l.cell, copyFull) || undefined;
  }
  /** Copy a readout line (long press, Menu): full, or as shown. */
  async copyReadout(l: Readout["lines"][number] | undefined, shown = false): Promise<void> {
    if (!l) return;
    const text = shown ? l.value : await this.readoutFull(l);
    if (text !== undefined) this.host.copy(text);
  }
  private async copyNum(): Promise<void> {
    const csv = await this.numCsv();
    if (csv !== undefined) this.host.copy(csv, tc("clip.copiedTable"));
  }
  /** The rows on screen: a header with x and the function names, then x and the full value of each function. */
  async numCsv(): Promise<string | undefined> {
    if (this.numSlots.length === 0) return undefined;
    const { copyFull, tableCsv } = await import("../../clipboard/impl.ts"); // not needed to start
    const header = ["x", ...this.numSlots.map((s) => this.slots.names[s] ?? "")];
    const rows = this.numXs.map((x, r) => [x, ...this.numSlots.map((_, c) => this.csvCell(this.numCell(r, c), copyFull))]);
    return tableCsv(header, rows);
  }
  private csvCell(c: Cell | undefined, copyFull: (i: CopySource) => string | undefined): string {
    if (!c || !c.ok) return "";
    if (/^[-+]?(infinity|inf|undef)$/.test(c.display)) return "NaN";
    return copyFull(numberSource(c.display, c)) ?? c.display;
  }

  // ---- Symb
  define(i: number, latex: string): void {
    const c = compileDefinition(latex, this.host.settings.angle, this.host.decimalComma);
    this.slots.set(i, latex, c.error === "not a function of x" ? t("function.notFunction") : c.error);
    const next = [...this.compiled];
    next[i] = c;
    this.compiled = next;
    this.marks = [];
    this.readout = undefined;
    this.save();
  }
  /** The drawing evaluators follow the angle mode (R64a): compile again when it has changed. True if they did. */
  syncAngle(): boolean {
    const angle = this.host.settings.angle;
    if (this.compiled.every((c) => c.angle === angle)) return false;
    this.compiled = this.slots.latex.map((l) => compileDefinition(l, angle, this.host.decimalComma));
    return true;
  }
  select(i: number): void {
    this.slots.select(i);
    this.host.setEntry(this.slots.latex[i] ?? "");
    this.save();
  }

  // ---- engine jobs
  /** Set when Cancel stopped a job; a queued re-run is then dropped. */
  private cancelled = false;
  private async job<T>(run: () => Promise<T>): Promise<T | undefined> {
    this.jobs++;
    this.cancelled = false;
    try {
      await this.host.calc.ready(); // a restored Plot or Num view asks before the engine has started
      return await run();
    } catch (e) {
      // Cancel: keep what is shown. A failed call: nothing to show (the cell or readout stays empty).
      if (e instanceof CalcCancelled) this.cancelled = true;
      else console.warn("function app:", e);
      return undefined;
    } finally {
      this.jobs--;
    }
  }
  private latest = new Map<string, number>();
  /** Run `run` unless a newer call with the same key started meanwhile; returns undefined if stale. */
  private async fresh<T>(key: string, run: () => Promise<T>): Promise<T | undefined> {
    const n = (this.latest.get(key) ?? 0) + 1;
    this.latest.set(key, n);
    const r = await this.job(run);
    return this.latest.get(key) === n ? r : undefined;
  }
  private flights = new Map<string, { again: boolean }>();
  /**
   * One engine call at a time per key: a request while one runs only marks it to run once more, with the
   * state as it is then (fast scrolling or tracing sends one call per settled screen, not one per key).
   */
  private async single(key: string, body: () => Promise<void>): Promise<void> {
    const f = this.flights.get(key);
    if (f) {
      f.again = true;
      return;
    }
    const st = { again: false };
    this.flights.set(key, st);
    try {
      do {
        st.again = false;
        await body();
      } while (st.again && !this.cancelled);
    } finally {
      this.flights.delete(key);
    }
  }

  // ---- Num
  editNum(which: "start" | "step"): void {
    this.num.edit = which;
    this.host.setEntry("");
  }
  scrollNum(rows: number): void {
    this.num.top += rows;
    void this.refreshNum();
  }
  setNumRows(n: number): void {
    if (n === this.num.rows || n < 1) return;
    this.num.rows = n;
    void this.refreshNum();
  }
  numX(k: number): string {
    const start = parseDec(this.num.start) as Dec;
    const step = parseDec(this.num.step) as Dec;
    return decText(addMul(start, k, step));
  }
  /** Engine rows by x for the current functions and angle unit (scrolling by a row asks for one row). */
  numCache = $state.raw<ReadonlyMap<string, Cell[]>>(new Map());
  private numSig = "";
  numCell(row: number, col: number): Cell | undefined {
    return this.numCache.get(this.numXs[row] ?? "")?.[col];
  }
  refreshNum(): Promise<void> {
    const slots = this.active;
    this.numXs = Array.from({ length: this.num.rows }, (_, i) => this.numX(this.num.top + i));
    this.numSlots = slots;
    const fns = slots.map((i) => this.compiled[i]?.giac ?? "");
    const sig = `${fns.join(" ; ")}|${this.host.settings.angle}`;
    if (sig !== this.numSig) {
      this.numSig = sig;
      this.numCache = new Map();
    }
    if (slots.length === 0) return Promise.resolve();
    return this.single("num", async () => {
      const sigNow = this.numSig;
      const want = this.numXs.filter((x) => !this.numCache.has(x));
      if (want.length === 0) return;
      const f = this.numSlots.map((i) => this.compiled[i]?.giac ?? "");
      const r = await this.job(() => this.fc.table({ fns: f, xs: want }, this.host.settings));
      if (!r || sigNow !== this.numSig) return;
      const next = new Map(this.numCache.size > 400 ? [] : this.numCache);
      want.forEach((x, i) => next.set(x, r[i] ?? []));
      this.numCache = next;
    });
  }

  // ---- Plot: window
  setWindow(w: PlotWindow): void {
    this.win = w;
    this.save();
  }
  defaultWindow(): void {
    this.win = null;
    this.marks = [];
    this.save();
  }
  /** 0.1 at the default window, as on the reference (G2 item 24); a 1-2-5 step for other widths (assumed). */
  get traceStep(): Dec {
    const w = this.win;
    const span = w ? w.xmax - w.xmin : DEFAULT_X[1] - DEFAULT_X[0];
    return niceStep(span / 200);
  }

  // ---- Plot: trace
  private fixTraceSlot(): void {
    const act = this.active;
    if (act.length > 0 && !act.includes(this.trace.slot)) this.trace.slot = act[0] as number;
  }
  get traceX(): number {
    return Number(this.trace.x);
  }
  moveTrace(dir: -1 | 1): void {
    const step = this.traceStep;
    const k = nearestK(this.traceX, step) + dir;
    let x = addMul({ m: 0n, scale: 0 }, k, step);
    // keep the trace inside the window: wrap to the edge
    const w = this.win;
    if (w && (decToNumber(x) < w.xmin || decToNumber(x) > w.xmax))
      x = addMul({ m: 0n, scale: 0 }, nearestK(dir < 0 ? w.xmax : w.xmin, step), step);
    this.trace.x = decText(x);
    this.readout = undefined;
    this.save();
    void this.refreshTrace();
  }
  /** Move the trace to x (a tap on the graph): snapped to the trace step. */
  traceTo(xNum: number): void {
    const step = this.traceStep;
    this.trace.x = decText(addMul({ m: 0n, scale: 0 }, nearestK(xNum, step), step));
    this.readout = undefined;
    this.save();
    void this.refreshTrace();
  }
  cycleTrace(dir: -1 | 1): void {
    const act = this.active;
    if (act.length === 0) return;
    const i = act.indexOf(this.trace.slot);
    this.trace.slot = act[(i + dir + act.length) % act.length] as number;
    this.readout = undefined;
    this.save();
    void this.refreshTrace();
  }
  /** The engine's y at the trace position, with the position and function it belongs to. */
  private traceAt = $state.raw<{ x: string; slot: number; y: Cell } | undefined>(undefined);
  get traceY(): Cell | undefined {
    const a = this.traceAt;
    return a && a.x === this.trace.x && a.slot === this.trace.slot ? a.y : undefined;
  }
  set traceY(y: Cell | undefined) {
    this.traceAt = y ? { x: this.trace.x, slot: this.trace.slot, y } : undefined;
  }
  refreshTrace(): Promise<void> {
    return this.single("trace", async () => {
      const slot = this.trace.slot;
      const x = this.trace.x;
      const f = this.compiled[slot]?.giac ?? "";
      if (f === "" || !this.active.includes(slot) || this.traceY) return;
      const r = await this.job(() => this.fc.table({ fns: [f], xs: [x] }, this.host.settings));
      const y = r?.[0]?.[0];
      if (y) this.traceAt = { x, slot, y };
    });
  }

  // ---- Plot: analysis (maths in the engine, gorge)
  private windowBounds(): { lo?: string; hi?: string } {
    const w = this.win;
    if (!w) return {};
    // bounds go to the engine as short decimals; they only limit the search
    return { lo: w.xmin.toPrecision(12), hi: w.xmax.toPrecision(12) };
  }
  /** Intersection asks for the second function: the others that are on, then the x-axis (G2 item 25). */
  private intersectionMenu(): SubMenu {
    const f = this.trace.slot;
    const name = (i: number): string => `${this.slots.names[i] ?? ""}(x)`;
    const items: MenuItem[] = this.active
      .filter((i) => i !== f)
      .map((i) => ({ id: `with-${i}`, label: name(i), run: () => void this.analyze("intersection", i) }));
    items.push({ id: "x-axis", label: t("fcn.xAxis"), run: () => void this.analyze("root") });
    return { title: t("fcn.intersectionOf", { f: name(f) }), items };
  }
  /** `other`: the second function of an intersection. */
  async analyze(kind: "root" | "extremum" | "intersection" | "slope", other?: number): Promise<void> {
    const f = this.compiled[this.trace.slot]?.giac ?? "";
    if (!f) return;
    const x0 = this.trace.x;
    let req: AnalysisRequest;
    if (kind === "intersection") {
      if (other === undefined || other === this.trace.slot || !this.active.includes(other)) return;
      req = { kind, f, g: this.compiled[other]?.giac ?? "", x0, ...this.windowBounds() };
    } else if (kind === "slope") req = { kind, f, x0 };
    else req = { kind, f, x0, ...this.windowBounds() };
    this.readout = { lines: [], info: t("history.working"), warn: false };
    const r = await this.fresh("analysis", () => this.fc.analyze(req, this.host.settings));
    if (!r) {
      this.readout = undefined;
      return;
    }
    this.showAnalysis(kind, r, other);
  }

  startArea(): void {
    this.areaStart = this.trace.x;
    this.readout = { lines: [{ label: t("fcn.areaFrom"), value: this.fmtX(this.trace.x) }], info: t("fcn.areaHint"), warn: false };
  }
  async finishArea(): Promise<void> {
    const a = this.areaStart;
    const f = this.compiled[this.trace.slot]?.giac ?? "";
    this.areaStart = undefined;
    if (a === undefined || !f) return;
    const b = this.trace.x;
    this.readout = { lines: [], info: t("history.working"), warn: false };
    const r = await this.fresh("analysis", () => this.fc.analyze({ kind: "area", f, a, b }, this.host.settings));
    if (!r) {
      this.readout = undefined;
      return;
    }
    this.showAnalysis("area", r, undefined, a, b);
  }

  private showAnalysis(kind: string, r: AnalysisOutcome, other?: number, a?: string, b?: string): void {
    if (!r.ok) {
      // e.g. a sign change at a pole: not a root. The engine's line says what it found.
      const msg = t(r.error === "no-root" && kind !== "area" ? "fcn.noResult" : "fcn.failed");
      this.readout = { lines: [], info: r.info ? `${msg} ${r.info}` : msg, warn: true };
      return;
    }
    const lines: Readout["lines"] = [];
    // M4-10: a number line is marked when the engine flagged the result or the cell shows more digits than confirmed
    const w = (c: Cell | undefined): boolean => r.warn || this.warned(c);
    const xn = cellNumber(r.x);
    const yn = cellNumber(r.y);
    if (kind === "area") {
      lines.push({ label: t("fcn.areaRange"), value: `${this.fmtX(a ?? "")} … ${this.fmtX(b ?? "")}` });
      lines.push({ label: t("fcn.area"), value: this.fmt(r.value), warn: w(r.value), cell: r.value, primary: true });
    } else {
      if (r.x) lines.push({ label: "x", value: this.fmt(r.x), warn: w(r.x), cell: r.x, primary: kind !== "slope" });
      if (r.y) lines.push({ label: "y", value: this.fmt(r.y), warn: w(r.y), cell: r.y });
      if (kind === "slope") lines.push({ label: t("fcn.slope"), value: this.fmt(r.value), warn: w(r.value), cell: r.value, primary: true });
      if (kind === "extremum" && r.extremum) lines.push({ label: t("fcn.kind"), value: t(`fcn.${r.extremum}`) });
    }
    this.readout = { lines, info: r.info, warn: r.warn };
    if (xn !== undefined && yn !== undefined && Number.isFinite(xn) && Number.isFinite(yn)) {
      this.marks = [...this.marks.slice(-7), { x: xn, y: yn, slot: other ?? this.trace.slot }];
      // the trace moves to the result, with the engine's x
      if (r.x?.value) {
        this.trace.x = r.x.display;
        this.traceY = r.y;
      }
    }
  }

  // ---- persistence
  async restore(): Promise<void> {
    const s = await this.host.kv.get<Partial<Stored>>("app.function");
    if (!s) return;
    this.slots.fromJSON(s.slots);
    this.compiled = this.slots.latex.map((l) => compileDefinition(l, this.host.settings.angle, this.host.decimalComma));
    if (s.win && [s.win.xmin, s.win.xmax, s.win.ymin, s.win.ymax].every(Number.isFinite) && s.win.xmax > s.win.xmin && s.win.ymax > s.win.ymin)
      this.win = s.win;
    if (s.num && parseDec(s.num.start ?? "") && parseDec(s.num.step ?? "")?.m) {
      this.num.start = s.num.start;
      this.num.step = s.num.step;
    }
    if (s.trace && typeof s.trace.slot === "number" && parseDec(s.trace.x ?? "")) {
      this.trace.slot = s.trace.slot;
      this.trace.x = s.trace.x;
    }
  }
  save(): void {
    this.saveTimer ??= setTimeout(() => this.flush(), 300);
  }
  flush(): void {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const s: Stored = {
      slots: this.slots.toJSON(),
      win: this.win ? { ...this.win } : null,
      num: { start: this.num.start, step: this.num.step },
      trace: { slot: this.trace.slot, x: this.trace.x },
    };
    void this.host.kv.set("app.function", s);
  }
}
