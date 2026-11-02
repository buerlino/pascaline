// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's state (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1–2.8). The formula is read-only, with a
// slot after every number and the end slot (input/unitFormula.ts); each slot is R24a's SlotModel, fed by the pad's
// presses (units/pad.ts emits them). Enter goes to the next slot and evaluates in the end slot, a flick up on Enter
// evaluates at once, ◀ ▶ move between slots. A slot reaches the field only through `write` (setPromptValue, units/
// open.ts), never through the entry line. Plain TS (no runes): a change calls `host.changed()`. Evaluation: the parser's units mode (R28) on the formula, the slots' tokens,
// then Calc.units(). Loaded with the unit view.
import type { ChipTable } from "../input/chips.ts";
import { chipUnit } from "../input/chipUnit.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { unitText } from "../i18n/enUnits.ts";
import { END, slotFormula, type SlotFormula } from "../input/unitFormula.ts";
import type { FormatOptions } from "../engine/format.ts";
import type { Alternative } from "./alternatives.ts";
import type { PadEmit } from "./pad.ts";
import { shownOf, type Shown } from "./result.ts";
import type { CellLeg } from "./userCells.svelte.ts";
import { SlotModel, type Reading, type SlotCatalogue } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest, UnitSlot } from "./types.ts";

export { shownOf, type Shown } from "./result.ts";

/** What the view needs from the page: the field, the engine, Find and the dead-key feedback. */
export interface ViewHost {
  /** Write a slot's LaTeX into its prompt (the field's setPromptValue). */
  write(id: string, latex: string): void;
  evaluate(req: UnitRequest): Promise<Quantity | UnitError>;
  /** Math: Find on units; a pick comes back through `apply`. `into`: an empty user cell was pressed (R24d), the pick sets it.
   *  `dim`: R62's "More…", only the units of that dimension. */
  find(into?: { key: string; leg: CellLeg }, dim?: string): void;
  /** R62: the format Home shows numbers in (the digits setting). */
  format(): FormatOptions;
  /** R62: the row of units the result can be shown in (units/alternatives.ts); none when it cannot be built. */
  alternatives(q: Quantity, req: UnitRequest): Promise<readonly Alternative[]>;
  /** R62: a tap on a chip: the unit last used for the dimension (`units.targets`). */
  remember(dim: string, slot: UnitSlot): Promise<void>;
  dead(): void;
  /** The active slot, the reading or what is shown changed: draw them (units/panel.ts). */
  changed(): void;
  /** R63: a result is in (as shown: the unit a tapped chip names): it becomes Home's history row of this visit. */
  result?(q: Quantity): void;
}

/** The active slot's look: drawn inline, since a class does not reach into the field's shadow root. */
const ACTIVE = "background:var(--pick);border-radius:4px";

/** The slots a line keeps (docs/04 4.3 "The way back": the units key shows them again), by the line's LaTeX. */
const kept = new Map<string, Readonly<Record<string, UnitSlot>>>();

/** R92: the line's text changed by a chip put on it from the units menu (a chip adds no slot, so the slot ids keep their
 *  order): the slots `from` kept go with the new text. */
export function carry(from: string, to: string): void {
  const s = kept.get(from);
  if (s && from !== to) kept.set(to, s);
}

export class UnitView {
  readonly line: string;
  readonly formula: SlotFormula;
  /** The slots' ids, then the end slot's. */
  readonly ids: readonly string[];
  readonly #models = new Map<string, SlotModel>();
  readonly #cat: SlotCatalogue;
  readonly #chips: ChipTable;
  readonly #host: ViewHost;
  #active = 0;
  #reading: Reading = { text: "", parts: [], marked: false };
  #shown: Shown = { kind: "none" };
  #run = 0;
  #row = -1;
  /** R62: "More…" opened Find on the end slot: the pick that completes it evaluates. */
  #more = false;
  /** R62: the chip last tapped: while the end slot is still its slot, the result reads the unit as the chip did ("ton", "cal"). */
  #picked: Alternative | undefined;
  #fit: number | undefined;

  /** R62: how many of the row's chips fit (the panel measures); undefined: all. A smaller number moves a focus on a hidden chip to "More…". */
  get fit(): number | undefined {
    return this.#fit;
  }
  set fit(n: number | undefined) {
    this.#fit = n;
    if (this.#row > this.chips) this.#row = this.chips;
  }

  /** The active slot, an index into `ids`. */
  get active(): number {
    return this.#active;
  }
  set active(n: number) {
    this.#active = n;
    this.#host.changed();
  }
  get reading(): Reading {
    return this.#reading;
  }
  set reading(r: Reading) {
    this.#reading = r;
    this.#host.changed();
  }
  get shown(): Shown {
    return this.#shown;
  }
  set shown(s: Shown) {
    this.#shown = s;
    this.#row = -1;
    this.#fit = undefined;
    this.#host.changed();
  }
  /** R62: the focused chip of the alternatives row (0 … chips, the last being "More…"), or -1: the row is not entered. */
  get row(): number {
    return this.#row;
  }
  /** The chips on screen, "More…" not counted. */
  get chips(): number {
    const s = this.#shown;
    return s.kind === "result" && s.dimension !== "" ? Math.min(s.alts.length, this.#fit ?? s.alts.length) : 0;
  }

  /** `seed`: the slots to start with (a picked unit row's, R63); else the ones this line kept. A slot after a result
   *  chip that neither fills starts with the chip's unit (R63, r17 section 2), which the user can change. */
  constructor(catalogue: SlotCatalogue, line: string, chips: ChipTable, host: ViewHost, seed?: Readonly<Record<string, UnitSlot>>) {
    this.line = line;
    this.formula = slotFormula(line);
    this.ids = [...this.formula.slots, END];
    this.#cat = catalogue;
    this.#chips = chips;
    this.#host = host;
    const from = seed ?? kept.get(line);
    const after = this.formula.chips ?? {};
    for (const id of this.ids) {
      let m: SlotModel;
      try {
        const key = after[id];
        m = new SlotModel(catalogue, from?.[id] ?? (key !== undefined ? chipUnit(chips[key])?.slot : undefined));
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
        return this.#host.find(e.into);
      case "next":
        return void this.next();
      case "evaluate":
        this.#more = false;
        return void this.evaluate();
      case "times":
        return; // units in a row multiply: × changes nothing
      default: {
        // A slot press (a pick from Find too): an evaluation still running answers for the slots it was asked with,
        // so its result is dropped (R24cf1).
        this.#run++;
        this.#picked = undefined;
        const m = this.#models.get(this.activeId) as SlotModel;
        const r = m.apply(e);
        if (!r.ok) {
          this.shown = { kind: "message", text: r.message };
          return this.#host.dead();
        }
        this.shown = { kind: "none" };
        this.#draw(this.activeId);
        this.#read();
        if (this.#more && this.activeId === END && m.check().ok) void this.evaluate();
      }
    }
  }

  /** Enter: on a chip of the row, pick it; else the next slot; in the end slot, evaluate. */
  next(): Promise<void> {
    if (this.#row >= 0) return this.pick(this.#row);
    this.#more = false;
    if (this.active === this.ids.length - 1) return this.evaluate();
    this.#move(1);
    return Promise.resolve();
  }

  /** ◀ (-1) and ▶ (+1): the slot before or after; none there is a dead key. */
  move(by: -1 | 1): void {
    if (this.#row >= 0) {
      const to = this.#row + by;
      if (to < 0 || to > this.chips) return this.#host.dead();
      this.#row = to;
      return this.#host.changed();
    }
    if (this.active + by < 0 || this.active + by >= this.ids.length) return this.#host.dead();
    this.#move(by);
  }

  /** ▼: from a result with a row into it (the first chip); anywhere else a dead key. */
  down(): void {
    if (this.#row >= 0 || this.#shown.kind !== "result" || this.#shown.dimension === "") return this.#host.dead();
    this.#row = 0;
    this.#host.changed();
  }

  /** ▲: out of the row; anywhere else a dead key. */
  up(): void {
    if (this.#row < 0) return this.#host.dead();
    this.#row = -1;
    this.#host.changed();
  }

  /** Esc in the row leaves it (true); otherwise nothing is taken (false) and the caller leaves the view. */
  escape(): boolean {
    if (this.#row < 0) return false;
    this.#row = -1;
    this.#host.changed();
    return true;
  }

  /** A chip of the row (or "More…", the one after the last): its unit is written into the end slot (setPromptValue), the
   *  dimension remembers it (`units.targets`) and the request runs again. */
  async pick(i: number): Promise<void> {
    const s = this.#shown;
    if (s.kind !== "result") return;
    const alt = s.alts[i];
    if (!alt || i >= this.chips) return this.more(s.dimension);
    return this.#use(alt, s.dimension);
  }

  /** R92's Tools › the SI form: a chip of the shown result's row, whether it fits on screen or not. */
  pickAlt(alt: Alternative): Promise<void> {
    const s = this.#shown;
    return s.kind === "result" && s.alts.includes(alt) ? this.#use(alt, s.dimension) : Promise.resolve();
  }

  async #use(alt: Alternative, dimension: string): Promise<void> {
    const was = this.activeId;
    let m: SlotModel;
    try {
      m = new SlotModel(this.#cat, alt.slot);
    } catch {
      return this.#host.dead(); // (a unit the catalogue does not read)
    }
    this.#more = false;
    this.#picked = alt;
    this.#models.set(END, m);
    this.active = this.ids.length - 1;
    this.#draw(was);
    this.#draw(END);
    this.#read();
    await this.#host.remember(dimension, alt.slot).catch(() => undefined);
    await this.evaluate();
  }

  /** R92's Tools › the end slot: it becomes the active slot (from a slot that cannot be left, its refusal shows). */
  toEnd(): void {
    const end = this.ids.length - 1;
    if (this.#row >= 0) this.up();
    if (this.active === end || !this.#leavable()) return;
    const was = this.activeId;
    this.active = end;
    this.#draw(was);
    this.#draw(END);
    this.#read();
  }

  /** "More…": the end slot is cleared and Find opens on this dimension's units; the pick evaluates. */
  more(dimension: string): void {
    const was = this.activeId;
    this.#models.set(END, new SlotModel(this.#cat));
    this.active = this.ids.length - 1;
    this.#run++;
    this.#picked = undefined;
    this.shown = { kind: "none" };
    this.#draw(was);
    this.#draw(END);
    this.#read();
    this.#more = true;
    this.#host.find(undefined, dimension);
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
    this.#more = false; // (the evaluation More… started has begun)
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
      const got = await this.#host.evaluate(req);
      const alts = "error" in got ? [] : await this.#host.alternatives(got, req).catch(() => []);
      // the chip's own text is the unit (the index's symbol for ton is s_ton)
      const p = this.#picked;
      const q = !("error" in got) && p && got.shownSlot && JSON.stringify(got.shownSlot) === JSON.stringify(p.slot) ? { ...got, unit: p.text } : got;
      if (run !== this.#run) return;
      this.shown = shownOf(q, this.#host.format(), alts);
      if (!("error" in q)) this.#host.result?.(q);
    } catch (e) {
      if (run === this.#run) this.shown = { kind: "message", text: unitText("units.engine") };
    }
  }

  /** Esc: the line keeps its slots. */
  keep(): void {
    const slots = this.filled();
    if (Object.keys(slots).length) kept.set(this.line, slots);
    else kept.delete(this.line);
  }

  /** The complete, filled slots and end slot by prompt id. */
  filled(): Record<string, UnitSlot> {
    const slots: Record<string, UnitSlot> = {};
    for (const id of this.ids) {
      const m = this.#models.get(id) as SlotModel;
      if (!m.empty && m.check().ok) slots[id] = m.slot;
    }
    return slots;
  }

  /** R63: the request as a history row draws it: each filled slot's unit after its number, then → and the end slot's;
   *  an empty slot (no unit) is left out. */
  drawn(): string {
    let latex = this.formula.latex;
    for (const id of this.ids) {
      const m = this.#models.get(id) as SlotModel;
      const body = m.empty || !m.check().ok ? "" : `\\,${m.latex}`;
      latex = latex.replace(id === END ? `\\to\\placeholder[${END}]{}` : `\\placeholder[${id}]{}`, () => (id === END && body ? `\\to${body}` : body));
    }
    return latex;
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
