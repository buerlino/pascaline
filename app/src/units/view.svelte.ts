// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's state (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1–2.8). The formula is read-only, with a
// slot after every number and the end slot (input/unitFormula.ts); each slot is R24a's SlotModel, fed by the pad's
// presses (units/pad.ts emits them). Enter goes to the next slot and evaluates in the end slot, a flick up on Enter
// evaluates at once, ◀ ▶ move between slots. A slot reaches the field only through `write` (setPromptValue, units/
// open.ts), never through the entry line. Evaluation: the parser's units mode (R28) on the formula, the slots' tokens,
// then Calc.units(). Loaded with the unit view.
import type { ChipTable } from "../input/chips.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { unitText } from "../i18n/enUnits.ts";
import { END, slotFormula, type SlotFormula } from "../input/unitFormula.ts";
import { unitErrorMessage, unitNoteText, unitWhyText } from "./messages.ts";
import type { PadEmit } from "./pad.ts";
import { SlotModel, type Reading, type SlotCatalogue } from "./slot.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest, type UnitSlot } from "./types.ts";

/** What the view shows under the reading: nothing, a refusal (a slot's or the evaluator's), Working…, or a result. */
export type Shown =
  | { kind: "none" }
  | { kind: "message"; text: string }
  | { kind: "working" }
  | { kind: "result"; text: string; display: string; unit: string; mark: "=" | "≈"; warn: boolean; why?: string; note?: string };

/** What the view needs from the page: the field, the engine, Find and the dead-key feedback. */
export interface ViewHost {
  /** Write a slot's LaTeX into its prompt (the field's setPromptValue). */
  write(id: string, latex: string): void;
  evaluate(req: UnitRequest): Promise<Quantity | UnitError>;
  /** Math: Find on units; a pick comes back through `apply`. */
  find(): void;
  dead(): void;
}

/** The active slot's look: drawn inline, since a class does not reach into the field's shadow root. */
const ACTIVE = "background:var(--pick);border-radius:4px";

/** The slots a line keeps (docs/04 4.3 "The way back": the units key shows them again), by the line's LaTeX. */
const kept = new Map<string, Readonly<Record<string, UnitSlot>>>();

/** A result as the view shows it (the full result view is R62's; this is the Quantity as it returns). */
export function shownOf(q: Quantity | UnitError): Shown {
  if (isUnitError(q)) return { kind: "message", text: unitErrorMessage(q) };
  const why = q.unc?.why;
  return {
    kind: "result",
    text: q.unc ? q.unc.shown : q.value.display,
    display: q.value.display,
    unit: q.unit,
    mark: q.unc || q.value.approximate ? "≈" : "=",
    warn: why !== undefined,
    ...(why ? { why: unitWhyText(why) } : {}),
    ...(q.note ? { note: unitNoteText(q.note) } : {}),
  };
}

export class UnitView {
  readonly line: string;
  readonly formula: SlotFormula;
  /** The slots' ids, then the end slot's. */
  readonly ids: readonly string[];
  readonly #models = new Map<string, SlotModel>();
  readonly #chips: ChipTable;
  readonly #host: ViewHost;
  /** The active slot, an index into `ids`. */
  active = $state(0);
  reading = $state<Reading>({ text: "", parts: [], marked: false });
  shown = $state<Shown>({ kind: "none" });
  #run = 0;

  constructor(catalogue: SlotCatalogue, line: string, chips: ChipTable, host: ViewHost) {
    this.line = line;
    this.formula = slotFormula(line);
    this.ids = [...this.formula.slots, END];
    this.#chips = chips;
    this.#host = host;
    const from = kept.get(line);
    for (const id of this.ids) {
      let m: SlotModel;
      try {
        m = new SlotModel(catalogue, from?.[id]);
      } catch {
        m = new SlotModel(catalogue); // (a kept slot the catalogue no longer reads: empty)
      }
      this.#models.set(id, m);
    }
  }

  /** The field is up: draw every slot once. */
  start(): void {
    for (const id of this.ids) this.#draw(id);
    this.#read();
  }

  get activeId(): string {
    return this.ids[this.active] as string;
  }

  /** A slot's model (tests and the e2e read its tokens). */
  model(id: string): SlotModel | undefined {
    return this.#models.get(id);
  }

  /** A pad press (units/pad.ts emits it). */
  apply(e: PadEmit): void {
    switch (e.do) {
      case "find":
        return this.#host.find();
      case "next":
        return void this.next();
      case "evaluate":
        return void this.evaluate();
      case "times":
        return; // units in a row multiply: × changes nothing
      default: {
        const m = this.#models.get(this.activeId) as SlotModel;
        const r = m.apply(e);
        if (!r.ok) {
          this.shown = { kind: "message", text: r.message };
          return this.#host.dead();
        }
        this.shown = { kind: "none" };
        this.#draw(this.activeId);
        this.#read();
      }
    }
  }

  /** Enter: the next slot; in the end slot, evaluate. */
  next(): Promise<void> {
    if (this.active === this.ids.length - 1) return this.evaluate();
    this.#move(1);
    return Promise.resolve();
  }

  /** ◀ (-1) and ▶ (+1): the slot before or after; none there is a dead key. */
  move(by: -1 | 1): void {
    if (this.active + by < 0 || this.active + by >= this.ids.length) return this.#host.dead();
    this.#move(by);
  }

  #move(by: -1 | 1): void {
    if (!this.#leavable()) return;
    const was = this.activeId;
    this.active += by;
    this.#draw(was);
    this.#draw(this.activeId);
    this.#read();
  }

  /** A slot with a prefix or √ alone, or a ÷ with nothing after it, cannot be left: its refusal shows. */
  #leavable(): boolean {
    const r = (this.#models.get(this.activeId) as SlotModel).check();
    if (r.ok) return true;
    this.shown = { kind: "message", text: r.message };
    this.#host.dead();
    return false;
  }

  /** The request for Calc.units(): the formula with the filled slots only (an empty slot means no unit), parsed in
   *  units mode. Throws the parser's error. */
  request(): UnitRequest {
    let latex = this.formula.latex;
    for (const id of this.ids) {
      if (!(this.#models.get(id) as SlotModel).empty) continue;
      latex = latex.replace(id === END ? `\\to\\placeholder[${END}]{}` : `\\placeholder[${id}]{}`, "");
    }
    const r = latexToGiacInfo(latex, { units: true, chips: this.#chips });
    const u = r.units ?? { slots: [], consts: [] };
    const slot = (id: string): UnitSlot => (this.#models.get(id) as SlotModel).slot;
    return { formula: r.giac, slots: u.slots.map(slot), ...(u.consts.length ? { consts: u.consts } : {}), ...(u.end ? { end: slot(u.end) } : {}) };
  }

  /** Evaluate from any slot: every slot must be complete. */
  async evaluate(): Promise<void> {
    for (const id of this.ids) {
      const r = (this.#models.get(id) as SlotModel).check();
      if (!r.ok) {
        this.shown = { kind: "message", text: r.message };
        return this.#host.dead();
      }
    }
    let req: UnitRequest;
    try {
      req = this.request();
    } catch (e) {
      this.shown = { kind: "message", text: e instanceof Error ? e.message : String(e) };
      return;
    }
    const run = ++this.#run;
    this.shown = { kind: "working" };
    try {
      const q = await this.#host.evaluate(req);
      if (run === this.#run) this.shown = shownOf(q);
    } catch (e) {
      if (run === this.#run) this.shown = { kind: "message", text: unitText("units.engine") };
    }
  }

  /** Esc: the line keeps its slots. */
  keep(): void {
    const slots: Record<string, UnitSlot> = {};
    for (const id of this.ids) {
      const m = this.#models.get(id) as SlotModel;
      if (!m.empty && m.check().ok) slots[id] = m.slot;
    }
    if (Object.keys(slots).length) kept.set(this.line, slots);
    else kept.delete(this.line);
  }

  #draw(id: string): void {
    const m = this.#models.get(id) as SlotModel;
    const body = m.empty ? "" : m.latex;
    this.#host.write(id, id === this.activeId ? `\\htmlStyle{${ACTIVE}}{${body || "\\square"}}` : body);
  }

  #read(): void {
    this.reading = (this.#models.get(this.activeId) as SlotModel).reading;
  }
}
