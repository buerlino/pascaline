// SPDX-License-Identifier: GPL-3.0-or-later
// The Solve app: equations E1…E9, E0 in Symb; in Num the unknowns of the equations that are on, each
// with a value that is the guess and, after a solve, the answer. All maths goes through Calc.solve
// (app/src/engine/solve.ts): every root is substituted back, and a failed check shows ⚠.
// Our defaults (docs/decisions.md; the reference's behaviour is G2 items 12-14, 20, 21):
//   - one equation on: Solve finds the selected unknown, the other unknowns keep their values;
//   - several equations on: Solve finds as many unknowns as there are equations, starting with the
//     selected one and then in list order; the rest keep their values;
//   - Polynomial roots lists every root (complex too) of the one equation in the selected unknown.
import { CalcCancelled, engineFormat, IDENT, type Calc, type KnownValue, type SolveOutcome } from "../../calc/port.ts";
import { confirmedText, isWarned } from "../../calc/shown.ts";
import { EMARK } from "../../entry/macros.ts";
import { mathJsonToGiac } from "../../input/emit.ts";
import { DEFAULT_USER_FUNCTIONS, userFunctionsOf } from "../../input/latex-to-giac.ts";
import { parseFailText } from "../../input/errors.ts";
import { parseLatex } from "../../input/parse.ts";
import { tc } from "../../clipboard/strings.ts";
import { t } from "../../i18n/index.ts";
import { parseDec, plainNumber, showDecimal } from "../decimal.ts";
import { slotNames, SlotsState, type SlotsJson } from "../slots.svelte.ts";
import type { AppHost, AppInstance, MenuItem, NavDir, ViewId } from "../types.ts";

export interface SolveReport {
  /** What was solved for, e.g. ["X", "Y"]. */
  names: string[];
  info: string;
  warn: boolean;
  ok: boolean;
  /** Polynomial roots, formatted (kind "poly" only). */
  roots?: string[];
  /** Per root: fewer digits are confirmed than shown (⚠, docs/04 2.4). */
  rootWarns?: boolean[];
}

interface Stored {
  slots: SlotsJson;
  values: Record<string, string>;
  selected: string;
  /** M4-10: the ⚠ of each answer, kept across a reload */
  warned?: Record<string, boolean>;
  /** The full value (Copy, docs/04 2.6) of the unknowns a solve answered; an edit drops it. */
  copies?: Record<string, string>;
}

/** An equation typed on the entry line as Giac text, or why it does not parse. */
export function compileEquation(latex: string, userFunctions: ReadonlySet<string> = DEFAULT_USER_FUNCTIONS): { giac: string; error: string } {
  if (latex.trim() === "") return { giac: "", error: "" };
  try {
    return { giac: mathJsonToGiac(parseLatex(latex, { userFunctions }), { realOddRoots: true, userFunctions }), error: "" };
  } catch (e) {
    return { giac: "", error: parseFailText(e) };
  }
}

/** A plain decimal as LaTeX for the entry line, its exponent as the exponent key types it (R14): 1.5e-3 → 1.5ᴇ-3. */
const numberLatex = (s: string): string => s.replace(/[eE]\+?(-?\d+)$/, `${EMARK}$1`);

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
  /** Variables whose answer has fewer confirmed digits than shown: the table marks them ⚠ (docs/04 2.4). */
  warned = $state<Record<string, boolean>>({});
  report = $state<SolveReport | undefined>(undefined);
  /** The full value of each answered unknown, as Copy gives it (every confirmed digit, up to 40); absent = the stored value. */
  copies = $state<Record<string, string>>({});

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
  /** G68: what an unknown carries into the engine: every confirmed digit of an answer (typed values stay exact), its facts. */
  known(name: string): KnownValue {
    const full = this.copies[name];
    if (full === undefined) return { name, value: this.value(name) };
    const digits = full.replace(/E.*$/, "").replace(/\D/g, "").replace(/^0+/, "").length;
    return { name, value: full.replace("E", "e"), digits: Math.max(1, digits), ...(this.warned[name] ? { warn: true } : {}) };
  }
  value(name: string): string {
    return this.values[name] ?? "0";
  }
  fmtValue(name: string): string {
    const s = this.host.settings;
    return showDecimal(this.value(name), s.digits, engineFormat(s.format));
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
      this.dropCopy(this.selected);
      this.warned = { ...this.warned, [this.selected]: false };
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

  // ---- Copy (docs/04 section 2.6): the full value of a root; Menu: as shown
  copyText(view: ViewId): Promise<string | undefined> | undefined {
    return view === "num" && this.selected ? this.fullOf(this.selected) : undefined;
  }
  /** Every confirmed digit of the unknown's value (the engine's, when a solve gave it), else the stored value. */
  async fullOf(name: string): Promise<string> {
    await this.settling; // the answer's full text is still being made (the copy code loads on first use)
    return this.copies[name] ?? this.value(name);
  }
  async copyValue(name: string, shown = false): Promise<void> {
    this.host.copy(shown ? this.fmtValue(name) : await this.fullOf(name));
  }
  private settling: Promise<void> = Promise.resolve();
  private dropCopy(name: string): void {
    if (!(name in this.copies)) return;
    const { [name]: _gone, ...rest } = this.copies;
    this.copies = rest;
  }
  /** Keep the full value of an answer next to the stored one (lazy: the copy code is not in the start chunk). */
  private async keepFull(name: string, display: string, r: Parameters<typeof isWarned>[0] & { full?: string }): Promise<void> {
    const { copyFull } = await import("../../clipboard/impl.ts");
    const text = copyFull({
      latex: "",
      status: "done",
      text: display,
      ...(r.value ? { value: r.value } : {}),
      ...(r.full !== undefined ? { full: r.full } : {}),
      ...(r.reliableDigits !== undefined ? { reliableDigits: r.reliableDigits } : {}),
    });
    if (text !== undefined && this.values[name] === display.replace("E", "e")) {
      this.copies = { ...this.copies, [name]: text };
      this.save();
    }
  }

  menu(view: ViewId): MenuItem[] {
    if (view !== "num") return [];
    const none = !this.selected || this.active.length === 0;
    const noValue = !this.selected;
    return [
      { id: "solve", label: t("solve.solve"), disabled: none, reason: t("why.noEquation"), run: () => void this.solve() },
      {
        id: "poly",
        label: t("solve.polyRoots"),
        disabled: none || this.active.length !== 1,
        reason: none ? t("why.noEquation") : t("why.oneEquation"),
        run: () => void this.polyRoots(),
      },
      { id: "copy", label: tc("clip.copy"), disabled: noValue, reason: t("why.noEquation"), run: () => void this.copyValue(this.selected) },
      { id: "shown", label: tc("clip.asShown"), disabled: noValue, reason: t("why.noEquation"), run: () => void this.copyValue(this.selected, true) },
    ];
  }

  // ---- Symb
  define(i: number, latex: string): void {
    const c = compileEquation(latex, this.userSet());
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

  /** The single letters that are calls now: f, g, h and the user's functions (R56b). */
  private userSet(): ReadonlySet<string> {
    return userFunctionsOf(this.host.userNames);
  }
  /** Compile the equations again from their LaTeX, so a function defined (or read after a relaunch) since counts. */
  private recompile(): void {
    const user = this.userSet();
    this.giac = this.slots.latex.map((l) => compileEquation(l, user).giac);
  }

  async refreshUnknowns(): Promise<void> {
    this.recompile();
    const eqs = this.active;
    const names = eqs.length ? await this.job(() => this.calc.unknowns(eqs)) : [];
    if (names === undefined) return;
    const fns = new Set(this.host.userNames.filter((u) => u.kind === "fn").map((u) => u.name));
    this.unknowns = names.filter((n) => IDENT.test(n) && !fns.has(n));
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
    this.recompile();
    const equations = this.active;
    const names = this.targets();
    if (!this.selected || equations.length === 0) return;
    if (names.length < equations.length) {
      this.report = { names, info: t("solve.tooFewUnknowns"), warn: true, ok: false };
      return;
    }
    const knowns: KnownValue[] = this.unknowns.filter((u) => !names.includes(u)).map((u) => this.known(u));
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
    this.recompile();
    const [equation] = this.active;
    const name = this.selected;
    if (!equation || !name) return;
    const knowns: KnownValue[] = this.unknowns.filter((u) => u !== name).map((u) => this.known(u));
    this.report = { names: [name], info: t("history.working"), warn: false, ok: true };
    const r = await this.job(() => this.calc.solve({ kind: "poly", equation, unknown: name, knowns }, this.host.settings));
    if (!r) {
      this.report = undefined;
      return;
    }
    const s = this.host.settings;
    this.report = {
      names: [name],
      ok: r.ok,
      warn: r.warn || !r.ok,
      info: r.ok ? r.info : this.failText(r),
      roots: r.roots.map((x) => confirmedText(x.result, s) ?? x.result.display),
      rootWarns: r.roots.map((x) => isWarned(x.result, s)),
    };
    // A single real root becomes the value, like a solve.
    const real = r.roots.filter((x) => x.result.value && x.result.value.im.digits === "");
    if (r.ok && real.length === 1) {
      this.setFromResult(name, real[0]!.result.display, isWarned(real[0]!.result, s));
      this.settling = this.keepFull(name, real[0]!.result.display, real[0]!.result);
    }
  }

  private failText(r: SolveOutcome): string {
    if (r.error === "no-root") return `${t("solve.noRoot")} (${r.info})`;
    if (r.error === "bad-input") return `${t("solve.badInput")} (${r.info})`;
    if (r.error === "syntax") return t("solve.syntax");
    return t("solve.failed");
  }

  private apply(names: string[], r: SolveOutcome): void {
    if (r.ok)
      for (const root of r.roots)
        if (root.name) {
          this.setFromResult(root.name, root.result.display, isWarned(root.result, this.host.settings));
          this.settling = Promise.all([this.settling, this.keepFull(root.name, root.result.display, root.result)]).then(() => undefined);
        }
    // A failure is flagged like a failed residual check: nothing was substituted back successfully.
    this.report = { names, ok: r.ok, warn: r.warn || !r.ok, info: r.ok ? r.info : this.failText(r) };
    this.loadEntry();
    this.save();
  }
  private setFromResult(name: string, display: string, warn = false): void {
    const v = display.replace("E", "e");
    if (parseDec(v)) {
      this.values = { ...this.values, [name]: v };
      this.warned = { ...this.warned, [name]: warn };
      this.dropCopy(name);
    }
  }

  // ---- persistence
  async restore(): Promise<void> {
    const s = await this.host.kv.get<Partial<Stored>>("app.solve");
    if (!s) return;
    this.slots.fromJSON(s.slots);
    this.recompile();
    if (s.values && typeof s.values === "object")
      this.values = Object.fromEntries(Object.entries(s.values).filter(([k, v]) => IDENT.test(k) && typeof v === "string" && parseDec(v)));
    if (typeof s.selected === "string" && IDENT.test(s.selected)) this.selected = s.selected;
    if (s.warned && typeof s.warned === "object")
      this.warned = Object.fromEntries(Object.entries(s.warned).filter(([k, v]) => v === true && k in this.values));
    if (s.copies && typeof s.copies === "object")
      this.copies = Object.fromEntries(Object.entries(s.copies).filter(([k, v]) => k in this.values && typeof v === "string" && /^-?\d[\d.]*(E-?\d+)?$/.test(v)));
  }
  save(): void {
    this.saveTimer ??= setTimeout(() => this.flush(), 300);
  }
  flush(): void {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const s: Stored = { slots: this.slots.toJSON(), values: { ...this.values }, selected: this.selected, warned: { ...this.warned }, copies: { ...this.copies } };
    void this.host.kv.set("app.solve", s);
  }
}
