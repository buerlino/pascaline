// SPDX-License-Identifier: GPL-3.0-or-later
// Symb view slots (Function F1…F9, F0; Solve E1…E9, E0): an entry each, an on/off toggle and a selection.
// Plain runes state; apps store it with toJSON/fromJSON.

/** Slot names as on the keys: 1…9, then 0. */
export const slotNames = (prefix: string, n = 10): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${(i + 1) % 10}`);

export interface SlotsJson {
  latex: string[];
  enabled: boolean[];
  selected: number;
}

export class SlotsState {
  readonly names: readonly string[];
  latex = $state<string[]>([]);
  enabled = $state<boolean[]>([]);
  selected = $state(0);
  /** Per-slot problem shown under the slot (e.g. a parse error); empty when fine. Not stored. */
  errors = $state<string[]>([]);

  constructor(names: readonly string[]) {
    this.names = names;
    this.latex = names.map(() => "");
    this.enabled = names.map(() => true);
    this.errors = names.map(() => "");
  }

  get count(): number {
    return this.names.length;
  }
  /** Indices of slots that have an entry and are switched on. */
  get active(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.names.length; i++) if (this.enabled[i] && (this.latex[i] ?? "").trim() !== "") out.push(i);
    return out;
  }

  select(i: number): void {
    if (i >= 0 && i < this.names.length) this.selected = i;
  }
  move(delta: number): void {
    this.select(Math.min(this.names.length - 1, Math.max(0, this.selected + delta)));
  }
  /** Store an entry; an empty entry clears the slot. A new entry is switched on. */
  set(i: number, latex: string, error = ""): void {
    const was = this.latex[i] ?? "";
    this.latex[i] = latex.trim() === "" ? "" : latex;
    if (was === "" && latex !== "") this.enabled[i] = true;
    this.errors[i] = error;
  }
  toggle(i: number): void {
    this.enabled[i] = !this.enabled[i];
  }

  toJSON(): SlotsJson {
    return { latex: [...this.latex], enabled: [...this.enabled], selected: this.selected };
  }
  fromJSON(j: Partial<SlotsJson> | undefined): void {
    if (!j) return;
    const n = this.names.length;
    if (Array.isArray(j.latex)) this.latex = this.names.map((_, i) => (typeof j.latex?.[i] === "string" ? (j.latex[i] as string) : ""));
    if (Array.isArray(j.enabled)) this.enabled = this.names.map((_, i) => j.enabled?.[i] !== false);
    if (typeof j.selected === "number" && j.selected >= 0 && j.selected < n) this.selected = j.selected;
  }
}
