// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once. What acts on the
// field itself (its set-up, and how a key changes it) is entry/field.ts, loaded with MathLive (R70f1).
import type { MathfieldElement } from "mathlive";
import { constKey, pruneChips, resKey, type Chip, type ChipTable } from "../input/chips.ts";
import type { ActionBody, Layer } from "../keyboard/keyboard.ts";
import { mathlive } from "../render/mathlive.svelte.ts";
import { ANS_CHIP, constChip, resChip } from "./macros.ts";

export class EntryController {
  private mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  private queue: ActionBody[] = [];
  /** How a key acts on the field (entry/field.ts: ⌫ and Del at a template, ᴇ, 10ˣ, a power's base, the stops): loaded with MathLive. */
  private onField: typeof import("./field.ts").runOnField | undefined;
  /** Backspace, Delete and the printable keys of a hardware keyboard (entry/hwkeys.ts, R26b, R31): loaded with MathLive. */
  private hwKey: typeof import("./hwkeys.ts").hardwareKey | undefined;
  private pendingValue: string | undefined;
  /** R34: the line was set or cleared before the field was up, so a line kept from before a kill no longer applies. */
  private keptStale = false;
  /**
   * R34: the line on the field is the user's to store: the kept-line read answered within the 1 s cap (the kept line,
   * if any, went on the field), or the line was typed or set since start.
   */
  private touched = false;
  /** The values of the chips on the line (docs/04 3.6); keys as in input/chips.ts. */
  private table: ChipTable = {};
  private nextRes = 1;
  /** R57: the decimal comma is on; a hardware `,` or `.` types the decimal mark, and ᴇ reads `{,}` as part of a number. */
  decimalComma = false;
  /** Called for a physical Enter / Escape (desktop convenience). The hardware hooks' last argument is
   *  KeyboardEvent.repeat: a held key's auto-repeat acts again but is no new press (docs/04 5.2, R70f1). */
  onEnter: (repeat: boolean) => void = () => {};
  onEscape: (repeat: boolean) => void = () => {};
  /** A keypad key pressed from a hardware keyboard (R31): the shell runs it as a tap in that layer. */
  onKey: (id: string, layer: Layer, repeat: boolean) => void = () => {};
  /** A letter typed on a hardware keyboard (R45): the shell's checks first, then the line. */
  onLetter: (ch: string, repeat: boolean) => void = () => {};
  /** A hardware key that does nothing (R31): the shell's dead-key feedback. */
  onDead: () => void = () => {};
  /** The line was emptied (Enter, Esc, an app view): main.ts clears the kept line (R34). */
  onClear: () => void = () => {};

  /** Resolves when the entry line is on the page and the queued keys have been replayed. */
  ready: Promise<void> = Promise.resolve();
  private started = false;

  /** The page element the field goes into (set by the shell). */
  setHost(host: HTMLElement): void {
    this.host = host;
  }

  /**
   * Start loading MathLive; safe to call once. `kept` is the line kept from before a kill (R34): it goes on the line
   * before the queued keys are replayed, unless the line was set or cleared meanwhile. A store that never answers
   * delays the field by at most a second; its line then stays stored for the next start (`settled`).
   */
  load(kept?: Promise<{ latex: string; chips: ChipTable } | undefined>): Promise<void> {
    if (this.started) return this.ready;
    this.started = true;
    const line = Promise.race([kept, new Promise<null>((resolve) => setTimeout(resolve, 1000, null))]).catch(() => null);
    this.ready = Promise.all([mathlive.load(), import("./field.ts"), import("./hwkeys.ts"), line]).then(([m, f, h, l]) => {
      this.onField = f.runOnField;
      this.hwKey = h.hardwareKey;
      if (l !== null) this.touched = true;
      if (l && !this.keptStale) this.pendingValue = this.adopt(l.latex, l.chips) + (this.pendingValue ?? "");
      return this.create(f.makeField, m.MathfieldElement);
    });
    return this.ready;
  }

  private async create(make: typeof import("./field.ts").makeField, Field: typeof MathfieldElement): Promise<void> {
    const mf = await make(Field, this.host, {
      key: (ev) => this.hwKey?.(ev, this) ?? false,
      enter: (repeat) => this.onEnter(repeat),
      escape: (repeat) => this.onEscape(repeat),
    });
    this.mf = mf;
    if (this.pendingValue !== undefined) mf.value = this.pendingValue;
    this.pendingValue = undefined;
    // Replay the queued keys one by one through the same path as a live keypress. Keys that arrive while
    // we replay (this.mf is set now) go straight in, so drain until the queue is empty.
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
    while (this.queue.length > 0) this.run(this.queue.shift() as ActionBody);
    // what MathLive edits itself (a paste, a character outside ASCII); a set of the value is silent
    mf.addEventListener("input", () => (this.touched = true));
  }

  /** The field itself (undefined until MathLive has loaded). */
  get field(): MathfieldElement | undefined {
    return this.mf;
  }
  /**
   * R34: the line may be stored on a hide, over the line kept from before a kill. Not while the field loads (its
   * value is still empty, the kept line not on it yet) unless the line was set or cleared meanwhile; and not after the
   * store answered too late for the kept line to go on the field, until the line is typed, set or cleared.
   */
  get settled(): boolean {
    return this.keptStale || (this.mf !== undefined && this.touched);
  }
  get value(): string {
    return this.mf ? this.mf.value : (this.pendingValue ?? "");
  }
  /** The chip table of the line: only the chips still on it. */
  get chips(): ChipTable {
    return pruneChips(this.table, this.value);
  }
  clear(): void {
    this.queue = [];
    this.pendingValue = undefined;
    this.keptStale = true;
    this.onClear();
    // The chip table and the counter stay (R16): Shift + Cancel undoes Esc and Enter, and the chips it brings back must
    // still be worth what they were. The `chips` getter only hands out the chips on the line.
    if (this.mf) this.mf.value = "";
  }
  /** Put a previous entry back on the line, with the values of its chips. */
  set(latex: string, chips: ChipTable = {}): void {
    this.touched = true;
    latex = this.adopt(latex, chips);
    if (!this.mf) {
      this.pendingValue = latex;
      this.queue = [];
      this.keptStale = true;
      return;
    }
    this.mf.value = latex;
    this.mf.focus();
    this.mf.executeCommand("moveToMathfieldEnd");
  }
  /** Take a line's chips into the table; returns the line with any renumbered result chips. */
  private adopt(latex: string, chips: ChipTable): string {
    // R16: a result key that already holds another value (an entry an undo can still bring back) is never
    // overwritten: the recalled chip gets a fresh number, in the LaTeX and in the table.
    const top = Math.max(0, ...Object.keys(chips).map((k) => (k.startsWith("res:") ? Number(k.slice(4)) : 0)));
    this.nextRes = Math.max(this.nextRes, top + 1);
    for (const [key, chip] of Object.entries(chips)) {
      const old = this.table[key];
      const same = old && old.value === chip.value && old.exact === chip.exact && old.unc === chip.unc;
      if (old && !same && key.startsWith("res:")) {
        const k = this.nextRes++;
        latex = latex.replaceAll(`\\res{${key.slice(4)}}`, `\\res{${k}}`);
        this.table[resKey(k)] = chip;
      } else this.table[key] = chip;
    }
    return latex;
  }
  /** Insert LaTeX at the cursor (a history result, L5). */
  insert(latex: string): void {
    this.touched = true;
    if (!this.mf) {
      this.pendingValue = (this.pendingValue ?? "") + latex;
      return;
    }
    this.mf.insert(latex, { format: "latex", selectionMode: "after" });
    this.mf.focus();
  }
  /** A history result as a chip (docs/04 2.8): drawn as `shown` (its display LaTeX), worth `chip.value`. */
  insertResult(shown: string, chip: Chip): void {
    const k = this.nextRes++;
    this.table[resKey(k)] = chip;
    this.insert(resChip(k, shown));
  }
  /** A constant as a chip (Find, docs/04 3.6): `symbol` is LaTeX, the value and uncertainty come with it. */
  insertConst(id: string, symbol: string, chip: Chip): void {
    this.table[constKey(id)] = chip;
    this.insert(constChip(id, symbol));
  }
  /** Ans: the view's last result, read when Enter is pressed. */
  insertAns(): void {
    this.insert(ANS_CHIP);
  }
  focus(): void {
    this.mf?.focus();
  }

  /**
   * Run a type / insert / cmd action. Specials belong to the app and are not handled here. (The a b/c key's
   * empty-line cycle is the app's: here it is the stacked fraction. The mixed number is in the Tmpl palette, R10.)
   */
  run(a: ActionBody): void {
    if (a.kind === "special") return;
    if (a.kind === "insert" && a.chip) this.table[a.chip.key] = a.chip.chip; // a constant on a free key (R4b)
    this.touched = true;
    if (!this.mf) {
      this.queue.push(a);
      return;
    }
    this.onField?.(this.mf, a);
  }
}
