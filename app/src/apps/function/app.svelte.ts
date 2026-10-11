// SPDX-License-Identifier: GPL-3.0-or-later
// The Function app: up to ten functions of x (F1…F9, F0) in Symb, drawn in Plot, tabulated in Num.
// Drawing uses our own JS evaluator (D7); every number shown (trace, table, analysis) comes from the engine.
import { CalcCancelled, type Calc } from "../../calc/port.ts";
import { formatComplex, type ComplexValue, type DecimalValue } from "../../engine/format.ts";
import { t } from "../../i18n/index.ts";
import { addMul, decText, decToNumber, nearestK, niceStep, parseDec, showDecimal, type Dec } from "../decimal.ts";
import { slotNames, SlotsState, type SlotsJson } from "../slots.svelte.ts";
import type { AppHost, AppInstance, MenuItem, NavDir, ViewId } from "../types.ts";
import { compileDefinition, type Compiled } from "./compile.ts";
import type { AnalysisOutcome, AnalysisRequest, Cell } from "./engineApi.ts";

/** Curve colours (our own palette, readable on dark and light backgrounds). */
export const CURVE_COLORS = ["#e8743b", "#3fa7d6", "#59c36a", "#d65db1", "#f2c14e", "#8f7ee6", "#e05d5d", "#4fc1b5", "#b0b8c4", "#c4884f"];

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
  lines: { label: string; value: string }[];
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
  traceY = $state<Cell | undefined>(undefined);
  marks = $state.raw<Mark[]>([]);
  readout = $state<Readout | undefined>(undefined);
  /** Start of a signed area, waiting for the end position (Enter). */
  areaStart = $state<string | undefined>(undefined);

  num = $state({ start: "0", step: "1", top: 0, rows: 12, edit: "start" as "start" | "step" });
  numXs = $state.raw<string[]>([]);
  numCells = $state.raw<Cell[][]>([]);
  numSlots = $state.raw<number[]>([]);

  private jobs = $state(0);
  private readonly host: AppHost;
  private readonly fc: Calc;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(host: AppHost) {
    this.host = host;
    this.fc = host.calc;
    this.compiled = this.slots.names.map(() => ({ giac: "", error: "" }));
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
    if (!c.ok || /^[-+]?(infinity|inf|undef)$/.test(c.display)) return t("function.undefined");
    return c.value ? this.fmtValue(c.value) : c.display;
  }
  fmtValue(v: ComplexValue): string {
    const s = this.host.settings;
    return formatComplex(v, { format: s.format.toUpperCase() as "STD" | "SCI" | "ENG", digits: s.digits }).text;
  }
  fmtX(x: string): string {
    return showDecimal(x, this.host.settings.digits, this.host.settings.format.toUpperCase() as "STD" | "SCI" | "ENG");
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
      this.fixTraceSlot();
      void this.refreshTrace();
    }
  }

  enter(view: ViewId, latex: string): void {
    if (view === "symb") {
      this.define(this.slots.selected, latex);
      this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
    } else if (view === "num") {
      const d = parseDec(plainNumber(latex));
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
      const two = this.active.length < 2;
      return [
        { id: "root", label: t("fcn.root"), disabled: none, run: () => void this.analyze("root") },
        { id: "extremum", label: t("fcn.extremum"), disabled: none, run: () => void this.analyze("extremum") },
        { id: "intersection", label: t("fcn.intersection"), disabled: two, run: () => void this.analyze("intersection") },
        { id: "slope", label: t("fcn.slope"), disabled: none, run: () => void this.analyze("slope") },
        { id: "area", label: t("fcn.area"), disabled: none, run: () => this.startArea() },
        { id: "default", label: t("plot.defaultWindow"), run: () => this.defaultWindow() },
      ];
    }
    if (view === "num")
      return [
        { id: "start", label: t("num.setStart"), run: () => this.editNum("start") },
        { id: "step", label: t("num.setStep"), run: () => this.editNum("step") },
      ];
    return [];
  }

  // ---- Symb
  define(i: number, latex: string): void {
    const c = compileDefinition(latex);
    this.slots.set(i, latex, c.error === "not a function of x" ? t("function.notFunction") : c.error);
    const next = [...this.compiled];
    next[i] = c;
    this.compiled = next;
    this.marks = [];
    this.readout = undefined;
    this.save();
  }
  select(i: number): void {
    this.slots.select(i);
    this.host.setEntry(this.slots.latex[i] ?? "");
    this.save();
  }

  // ---- engine jobs (one at a time per kind; a newer request replaces a waiting one)
  private async job<T>(run: () => Promise<T>): Promise<T | undefined> {
    this.jobs++;
    try {
      await this.host.calc.ready(); // a restored Plot or Num view asks before the engine has started
      return await run();
    } catch (e) {
      // Cancel: keep what is shown. A failed call: nothing to show (the cell or readout stays empty).
      if (!(e instanceof CalcCancelled)) console.warn("function app:", e);
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
  async refreshNum(): Promise<void> {
    const slots = this.active;
    const xs = Array.from({ length: this.num.rows }, (_, i) => this.numX(this.num.top + i));
    this.numXs = xs;
    this.numSlots = slots;
    if (slots.length === 0) {
      this.numCells = [];
      return;
    }
    const fns = slots.map((i) => this.compiled[i]?.giac ?? "");
    const r = await this.fresh("num", () => this.fc.table({ fns, xs }, this.host.settings));
    if (r) this.numCells = r;
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
  get traceStep(): Dec {
    const w = this.win;
    const span = w ? w.xmax - w.xmin : DEFAULT_X[1] - DEFAULT_X[0];
    return niceStep(span / 100);
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
  async refreshTrace(): Promise<void> {
    const f = this.compiled[this.trace.slot]?.giac ?? "";
    if (f === "" || !this.active.includes(this.trace.slot)) {
      this.traceY = undefined;
      return;
    }
    this.traceY = undefined;
    const r = await this.fresh("trace", () => this.fc.table({ fns: [f], xs: [this.trace.x] }, this.host.settings));
    if (r) this.traceY = r[0]?.[0];
  }

  // ---- Plot: analysis (maths in the engine, gorge)
  private windowBounds(): { lo?: string; hi?: string } {
    const w = this.win;
    if (!w) return {};
    // bounds go to the engine as short decimals; they only limit the search
    return { lo: w.xmin.toPrecision(12), hi: w.xmax.toPrecision(12) };
  }
  async analyze(kind: "root" | "extremum" | "intersection" | "slope"): Promise<void> {
    const f = this.compiled[this.trace.slot]?.giac ?? "";
    if (!f) return;
    const x0 = this.trace.x;
    let req: AnalysisRequest;
    let other: number | undefined;
    if (kind === "intersection") {
      // with the next function that is on (assumed; the reference asks which one)
      const act = this.active;
      other = act[(act.indexOf(this.trace.slot) + 1) % act.length];
      if (other === undefined || other === this.trace.slot) return;
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
      this.readout = { lines: [], info: t(r.error === "no-root" ? "fcn.noResult" : "fcn.failed"), warn: true };
      return;
    }
    const lines: Readout["lines"] = [];
    const xn = cellNumber(r.x);
    const yn = cellNumber(r.y);
    if (kind === "area") {
      lines.push({ label: t("fcn.areaRange"), value: `${this.fmtX(a ?? "")} … ${this.fmtX(b ?? "")}` });
      lines.push({ label: t("fcn.area"), value: this.fmt(r.value) });
    } else {
      if (r.x) lines.push({ label: "x", value: this.fmt(r.x) });
      if (r.y) lines.push({ label: "y", value: this.fmt(r.y) });
      if (kind === "slope") lines.push({ label: t("fcn.slope"), value: this.fmt(r.value) });
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
    this.compiled = this.slots.latex.map((l) => compileDefinition(l));
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

/** The entry line as a plain number: "-0.5", "1.5\\times10^{3}" → "1.5e3". */
function plainNumber(latex: string): string {
  return latex
    .replace(/\\times10\^\{([^}]*)\}/, "e$1")
    .replace(/\\times10\^(\d)/, "e$1")
    .replace(/[{}\s]/g, "");
}
