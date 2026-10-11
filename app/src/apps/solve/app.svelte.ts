// SPDX-License-Identifier: GPL-3.0-or-later
// The Solve app: equations E1…E9, E0 in Symb; in Num the unknowns of the equations that are on, each
// with a value that is the guess and, after a solve, the answer. All maths goes through Calc.solve
// (app/src/engine/solve.ts): every root is substituted back, and a failed check shows ⚠.
// Our defaults (docs/decisions.md; the reference's behaviour is G2 items 12-14, 20, 21):
//   - one equation on: Solve finds the selected unknown, the other unknowns keep their values;
//   - several equations on: Solve finds as many unknowns as there are equations, starting with the
//     selected one and then in list order; the rest keep their values;
//   - Polynomial roots lists every root (complex too) of the one equation in the selected unknown.
import { CalcCancelled, type Calc, type KnownValue, type SolveOutcome } from "../../calc/port.ts";
import { formatComplex } from "../../engine/format.ts";
import { mathJsonToGiac, SerializeError } from "../../input/emit.ts";
import { parseLatex } from "../../input/parse.ts";
import { t } from "../../i18n/index.ts";
import { parseDec, showDecimal } from "../decimal.ts";
import { slotNames, SlotsState, type SlotsJson } from "../slots.svelte.ts";
import type { AppHost, AppInstance, MenuItem, NavDir, ViewId } from "../types.ts";

/** A variable name the engine accepts (letters and digits; subscripts are not supported yet). */
const NAME = /^[A-Za-z][A-Za-z0-9]*$/;

export interface SolveReport {
  /** What was solved for, e.g. ["X", "Y"]. */
  names: string[];
  info: string;
  warn: boolean;
  ok: boolean;
  /** Polynomial roots, formatted (kind "poly" only). */
  roots?: string[];
}

interface Stored {
  slots: SlotsJson;
  values: Record<string, string>;
  selected: string;
}

/** An equation typed on the entry line as Giac text, or why it does not parse. */
export function compileEquation(latex: string): { giac: string; error: string } {
  if (latex.trim() === "") return { giac: "", error: "" };
  try {
    return { giac: mathJsonToGiac(parseLatex(latex)), error: "" };
  } catch (e) {
    return { giac: "", error: e instanceof SerializeError ? e.message : String(e) };
  }
}

/** The entry line as a plain decimal: "-0.5", "1.5\\times10^{3}" → "1.5e3"; undefined if it is not one. */
export function plainNumber(latex: string): string | undefined {
  const s = latex
    .replace(/\\times\s*10\^\{([^}]*)\}/, "e$1")
    .replace(/\\times\s*10\^(\d)/, "e$1")
    .replace(/[{}\s]/g, "");
  return parseDec(s) ? s : undefined;
}

/** A plain decimal as LaTeX for the entry line. */
const numberLatex = (s: string): string => s.replace(/[eE]([+-]?\d+)$/, "\\times10^{$1}");

export class SolveApp implements AppInstance {
  readonly id = "solve" as const;
  readonly views: readonly ViewId[] = ["symb", "num"];
  readonly slots = new SlotsState(slotNames("E"));
  giac = $state<string[]>([]);

  /** Unknowns of the equations that are on, in order of appearance. */
  unknowns = $state<string[]>([]);
  /** Value of each variable as a plain decimal (the guess, then the answer). Kept for names not shown. */
  values = $state<Record<string, string>>({});
  selected = $state("");
  report = $state<SolveReport | undefined>(undefined);

  private jobs = $state(0);
  private readonly host: AppHost;
  private readonly calc: Calc;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(host: AppHost) {
    this.host = host;
    this.calc = host.calc;
    this.giac = this.slots.names.map(() => "");
  }

  get busy(): boolean {
    return this.jobs > 0;
  }
  /** Giac text of the equations that are on and parse. */
  get active(): string[] {
    return this.slots.active.map((i) => this.giac[i] ?? "").filter((g) => g !== "");
  }
  value(name: string): string {
    return this.values[name] ?? "0";
  }
  fmtValue(name: string): string {
    const s = this.host.settings;
    return showDecimal(this.value(name), s.digits, s.format.toUpperCase() as "STD" | "SCI" | "ENG");
  }

  // ---- framework hooks
  entryLabel(view: ViewId): string | undefined {
    if (view === "symb") return `${this.slots.names[this.slots.selected]}:`;
    if (view === "num") return this.selected ? `${this.selected}=` : undefined;
    return undefined;
  }

  show(view: ViewId): void {
    if (view === "symb") this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
    if (view === "num") void this.refreshUnknowns();
  }

  enter(view: ViewId, latex: string): void {
    if (view === "symb") {
      this.define(this.slots.selected, latex);
      this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
    } else if (view === "num" && this.selected) {
      const v = plainNumber(latex);
      if (v === undefined) return;
      this.values = { ...this.values, [this.selected]: v };
      this.report = undefined;
      this.loadEntry();
      this.save();
    }
  }

  nav(view: ViewId, dir: NavDir, edited: boolean): boolean {
    if (edited || (dir !== "up" && dir !== "down")) return false;
    if (view === "symb") {
      this.slots.move(dir === "up" ? -1 : 1);
      this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
      this.save();
      return true;
    }
    if (view === "num") {
      const i = this.unknowns.indexOf(this.selected);
      const j = Math.min(this.unknowns.length - 1, Math.max(0, i + (dir === "up" ? -1 : 1)));
      if (this.unknowns[j] !== undefined) this.selectUnknown(this.unknowns[j] as string);
      return true;
    }
    return false;
  }

  menu(view: ViewId): MenuItem[] {
    if (view !== "num") return [];
    const none = !this.selected || this.active.length === 0;
    return [
      { id: "solve", label: t("solve.solve"), disabled: none, run: () => void this.solve() },
      { id: "poly", label: t("solve.polyRoots"), disabled: none || this.active.length !== 1, run: () => void this.polyRoots() },
    ];
  }

  // ---- Symb
  define(i: number, latex: string): void {
    const c = compileEquation(latex);
    this.slots.set(i, latex, c.error);
    const next = [...this.giac];
    next[i] = c.giac;
    this.giac = next;
    this.report = undefined;
    this.save();
  }
  selectSlot(i: number): void {
    this.slots.select(i);
    this.host.setEntry(this.slots.latex[i] ?? "");
    this.save();
  }

  // ---- Num
  selectUnknown(name: string): void {
    this.selected = name;
    this.loadEntry();
    this.save();
  }
  private loadEntry(): void {
    if (this.selected) this.host.setEntry(numberLatex(this.value(this.selected)));
  }

  private async job<T>(run: () => Promise<T>): Promise<T | undefined> {
    this.jobs++;
    try {
      await this.calc.ready();
      return await run();
    } catch (e) {
      // Cancel: the values stay as they were.
      if (!(e instanceof CalcCancelled)) console.warn("solve app:", e);
      return undefined;
    } finally {
      this.jobs--;
    }
  }

  async refreshUnknowns(): Promise<void> {
    const eqs = this.active;
    const names = eqs.length ? await this.job(() => this.calc.unknowns(eqs)) : [];
    if (names === undefined) return;
    this.unknowns = names.filter((n) => NAME.test(n));
    if (!this.unknowns.includes(this.selected)) this.selected = this.unknowns[0] ?? "";
    this.loadEntry();
  }

  /** The unknowns to solve for: the selected one first, then in list order, one per equation. */
  targets(): string[] {
    const n = this.active.length;
    const rest = this.unknowns.filter((u) => u !== this.selected);
    return [this.selected, ...rest].slice(0, n);
  }

  async solve(): Promise<void> {
    const equations = this.active;
    const names = this.targets();
    if (!this.selected || equations.length === 0) return;
    if (names.length < equations.length) {
      this.report = { names, info: t("solve.tooFewUnknowns"), warn: true, ok: false };
      return;
    }
    const knowns: KnownValue[] = this.unknowns.filter((u) => !names.includes(u)).map((u) => ({ name: u, value: this.value(u) }));
    this.report = { names, info: t("history.working"), warn: false, ok: true };
    const r = await this.job(() =>
      this.calc.solve({ kind: "equations", equations, unknowns: names, guesses: names.map((u) => this.value(u)), knowns }, this.host.settings),
    );
    if (!r) {
      this.report = undefined;
      return;
    }
    this.apply(names, r);
  }

  async polyRoots(): Promise<void> {
    const [equation] = this.active;
    const name = this.selected;
    if (!equation || !name) return;
    const knowns: KnownValue[] = this.unknowns.filter((u) => u !== name).map((u) => ({ name: u, value: this.value(u) }));
    this.report = { names: [name], info: t("history.working"), warn: false, ok: true };
    const r = await this.job(() => this.calc.solve({ kind: "poly", equation, unknown: name, knowns }, this.host.settings));
    if (!r) {
      this.report = undefined;
      return;
    }
    const s = this.host.settings;
    const fmt = s.format.toUpperCase() as "STD" | "SCI" | "ENG";
    this.report = {
      names: [name],
      ok: r.ok,
      warn: r.warn || !r.ok,
      info: r.ok ? r.info : this.failText(r),
      roots: r.roots.map((x) => (x.result.value ? formatComplex(x.result.value, { format: fmt, digits: s.digits }).text : x.result.display)),
    };
    // A single real root becomes the value, like a solve.
    const real = r.roots.filter((x) => x.result.value && x.result.value.im.digits === "");
    if (r.ok && real.length === 1) this.setFromResult(name, real[0]!.result.display);
  }

  private failText(r: SolveOutcome): string {
    if (r.error === "no-root") return `${t("solve.noRoot")} (${r.info})`;
    if (r.error === "bad-input") return `${t("solve.badInput")} (${r.info})`;
    if (r.error === "syntax") return t("solve.syntax");
    return t("solve.failed");
  }

  private apply(names: string[], r: SolveOutcome): void {
    if (r.ok) for (const root of r.roots) if (root.name) this.setFromResult(root.name, root.result.display);
    // A failure is flagged like a failed residual check: nothing was substituted back successfully.
    this.report = { names, ok: r.ok, warn: r.warn || !r.ok, info: r.ok ? r.info : this.failText(r) };
    this.loadEntry();
    this.save();
  }
  private setFromResult(name: string, display: string): void {
    const v = display.replace("E", "e");
    if (parseDec(v)) this.values = { ...this.values, [name]: v };
  }

  // ---- persistence
  async restore(): Promise<void> {
    const s = await this.host.kv.get<Partial<Stored>>("app.solve");
    if (!s) return;
    this.slots.fromJSON(s.slots);
    this.giac = this.slots.latex.map((l) => compileEquation(l).giac);
    if (s.values && typeof s.values === "object")
      this.values = Object.fromEntries(Object.entries(s.values).filter(([k, v]) => NAME.test(k) && typeof v === "string" && parseDec(v)));
    if (typeof s.selected === "string" && NAME.test(s.selected)) this.selected = s.selected;
  }
  save(): void {
    this.saveTimer ??= setTimeout(() => this.flush(), 300);
  }
  flush(): void {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const s: Stored = { slots: this.slots.toJSON(), values: { ...this.values }, selected: this.selected };
    void this.host.kv.set("app.solve", s);
  }
}
