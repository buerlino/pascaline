// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once.
import type { MathfieldElement } from "mathlive";
import { constKey, pruneChips, resKey, type Chip, type ChipTable } from "../input/chips.ts";
import type { ActionBody, Layer } from "../keyboard/keyboard.ts";
import { mathlive } from "../render/mathlive.svelte.ts";
import { ANS_CHIP, EMARK, ENTRY_MACROS, constChip, isChipLatex, resChip } from "./macros.ts";

/** The literal caret of the one-line mode, as MathLive serialises it (the parser reads it as a power). */
export const CARET = '\\char"5E ';

const FRAC = "\\frac{#@}{#?}";
/** An atom a bare ^ would not read as raising whole (L8): a fraction or a root. */
const COMPOUND = /^\\(?:[dt]?frac|sqrt)(?![A-Za-z])/;
const MIXED_FRAC = /^\\tfrac(?![A-Za-z])/;

/** The ÷ / a/b template (stacked fraction); the one-line mode inserts \\div instead. */
function isDivide(a: ActionBody): boolean {
  return a.kind === "insert" && a.latex === FRAC;
}

/** True if `latex` has a superscript outside every {…} group and \left…\right pair. */
function hasOuterSup(latex: string): boolean {
  let depth = 0;
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === "\\") {
      if (latex.startsWith("\\left", i)) depth++;
      else if (latex.startsWith("\\right", i)) depth--;
      i++; // skip the escaped character (\{ \} \^ count as text)
    } else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "^" && depth === 0) return true;
  }
  return false;
}

/** A power key's template (R17): x², xʸ and x⁻¹ (`#@^…`), or the bare caret of the one-line mode. */
function isPower(a: ActionBody): boolean {
  return a.kind === "insert" && (a.latex.startsWith("#@^") || a.latex.startsWith(CARET));
}

/** DMS (Tmpl palette, R27a): its degrees are the key's argument (`#@`), as a power's base is. */
function isDms(a: ActionBody): boolean {
  return a.kind === "insert" && a.latex.startsWith("#@\\degree");
}

/** The 10ˣ key (Shift + LOG). */
const TEN_POW = "10^{#0}";

/** One plain term: a number, one letter or a chip. A power key raises it without brackets; anything else gets them. */
function isPlainTerm(latex: string): boolean {
  const l = latex.trim();
  return /^[\d.]+$/.test(l) || /^\p{L}$/u.test(l) || isChipLatex(l);
}

/** The exponent key (R14): the mark ᴇ, one token. */
function isEMark(a: ActionBody): boolean {
  return a.kind === "insert" && a.latex === EMARK;
}

export class EntryController {
  private mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  private queue: ActionBody[] = [];
  /** ⌫ and Del at a template (entry/delete.ts, R23): loaded with MathLive, outside the start chunk. */
  private deleteAt: typeof import("./delete.ts").deleteAtTemplate | undefined;
  /** Backspace, Delete and the printable keys of a hardware keyboard (entry/hwkeys.ts, R26b, R31): loaded with MathLive. */
  private hwKey: typeof import("./hwkeys.ts").hardwareKey | undefined;
  /** After an arrow step, step on to where a key types into a box (entry/stops.ts, R27b): loaded with MathLive. */
  private settle: typeof import("./stops.ts").settle | undefined;
  /** ▶ in a template: to the next empty box, or the end of the box it leaves (entry/stops.ts, R10, R43): loaded with MathLive. */
  private nextBox: typeof import("./stops.ts").nextBox | undefined;
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
  /** Called for a physical Enter / Escape (desktop convenience). */
  onEnter: () => void = () => {};
  onEscape: () => void = () => {};
  /** A keypad key pressed from a hardware keyboard (R31): the shell runs it as a tap in that layer. */
  onKey: (id: string, layer: Layer) => void = () => {};
  /** A letter typed on a hardware keyboard (R45): the shell's checks first, then the line. */
  onLetter: (ch: string) => void = () => {};
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
    this.ready = Promise.all([mathlive.load(), import("./delete.ts"), import("./hwkeys.ts"), import("./stops.ts"), line]).then(([m, d, h, s, l]) => {
      this.deleteAt = d.deleteAtTemplate;
      this.hwKey = h.hardwareKey;
      this.settle = s.settle;
      this.nextBox = s.nextBox;
      if (l !== null) this.touched = true;
      if (l && !this.keptStale) this.pendingValue = this.adopt(l.latex, l.chips) + (this.pendingValue ?? "");
      return this.create(m.MathfieldElement);
    });
    return this.ready;
  }

  private async create(Field: typeof MathfieldElement): Promise<void> {
    // Fonts come from mathlive/static.css (bundled by Vite), not from a fonts folder at run time.
    Field.fontsDirectory = null;
    Field.soundsDirectory = null;
    Field.plonkSound = null;
    Field.keypressSound = null;
    // Off: it refocuses the entry when the window regains focus, which opens the system keyboard on return (K0, F9).
    Field.restoreFocusWhenDocumentFocused = false;
    const mf = new Field();
    // MathLive only accepts options once the field is mounted, and it is only fully laid out a frame later.
    const mounted = new Promise<void>((resolve) => {
      mf.addEventListener("mount", () => resolve(), { once: true });
      setTimeout(resolve, 1000); // safety net if the event never comes
    });
    this.host?.append(mf);
    await mounted;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.mf = mf;
    mf.mathVirtualKeyboardPolicy = "manual"; // never open MathLive's own keyboard; ours is the only one
    mf.menuItems = [];
    mf.smartFence = true;
    mf.smartMode = false;
    mf.inlineShortcuts = {};
    mf.removeExtraneousParentheses = true;
    // R27c: a typed key takes no style from its neighbour. MathLive's default gave a 7 next to an upright letter that
    // letter's style, on the side its hidden style bias picked: 2\mathrm{i} 7 became \mathrm{i7}, one unknown name.
    mf.onInsertStyle = () => ({});
    mf.macros = { ...mf.macros, ...ENTRY_MACROS };
    const enforce = (): void => this.forceNoSystemKeyboard();
    void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
    mf.addEventListener("focusin", enforce);
    // Capture on the host runs before MathLive's own handler inside the shadow root.
    mf.addEventListener(
      "keydown",
      (ev) => {
        // R26b, R31 (F16, F27): Backspace, Delete and the printable keys take the keypad's path (entry/hwkeys.ts)
        if (!this.hwKey?.(ev, this)) return;
        ev.preventDefault();
        ev.stopPropagation();
      },
      { capture: true },
    );
    mf.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.onEnter();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        this.onEscape();
      }
    });
    this.keepTouchCaret(mf);
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

  /**
   * R42 (F33): MathLive places the caret on pointerdown and, for touch only, a second time on pointerup from atom bounds
   * that the first placement made stale (right of a fraction, root, power or bracket pair the second hit lands at the
   * start of the line or box). Remember the first (right) caret and put it back after the second. A selection (drag,
   * double tap) is left alone. A mouse click never needed this.
   */
  private keepTouchCaret(mf: MathfieldElement): void {
    let down: number | undefined;
    mf.addEventListener("pointerdown", (ev) => {
      down = undefined;
      if (ev.pointerType !== "touch") return;
      // A microtask runs after MathLive's own pointerdown handler (inside the shadow root) has placed the caret.
      queueMicrotask(() => {
        if (mf.selectionIsCollapsed) down = mf.position;
      });
    });
    window.addEventListener("pointerup", (ev) => {
      const want = down;
      down = undefined;
      if (want === undefined || ev.pointerType !== "touch") return;
      setTimeout(() => {
        if (mf.selectionIsCollapsed && mf.position !== want) mf.position = want;
      }, 0);
    });
  }

  /** The field's hidden textarea must never summon the system keyboard (inputmode=none, again after upgrade). */
  private forceNoSystemKeyboard(): void {
    for (const el of this.mf?.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
      el.setAttribute("inputmode", "none");
      el.setAttribute("virtualkeyboardpolicy", "manual");
    }
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
    this.touched = true;
    if (!this.mf) {
      this.queue.push(a);
      return;
    }
    const mf = this.mf;
    if (a.kind === "cmd" && a.name === "moveToNextChar" && this.nextBox?.(mf)) {
      mf.focus();
      return;
    }
    if (a.kind === "cmd" && (a.name === "deleteBackward" || a.name === "deleteForward")) {
      // R23 (F10): ⌫ and Del at a bracket keep the template whole (entry/delete.ts); else MathLive's own delete
      if (this.deleteAt?.(mf, a.name === "deleteBackward" ? -1 : 1)) {
        mf.focus();
        return;
      }
    }
    // R27b (F23): right after piecewise's `if ` MathLive would type text; our keys only ever type maths
    if (a.kind !== "cmd" && mf.mode === "text") mf.mode = "math";
    if (isEMark(a) && mf.value === "") {
      // the mark on an empty line gets a leading 1, as on the reference (1ᴇ; spec/mapping/vc-2026-10-11/keys.yaml r7c1)
      this.apply(mf, { kind: "insert", latex: `1${EMARK}` });
      mf.focus();
      return;
    }
    if (a.kind === "insert" && a.latex === TEN_POW && this.afterDigit(mf)) {
      // R27a (F22): after a digit its 10 would join the number (5 10ˣ 2 was 510²); the line says 5×10² instead
      this.apply(mf, { ...a, latex: `\\times${TEN_POW}` });
      mf.focus();
      return;
    }
    // R14: a number with an exponent mark is one term, so x², xʸ, x⁻¹, ÷ and a/b take all of it (1.5ᴇ-3 ÷ 2 is not 1.5ᴇ-3/2
    // with the 3 alone as the numerator); a power puts it in brackets below, since it is not a plain term
    if (a.kind === "insert" && a.latex.includes("#@")) this.selectENumber(mf);
    if (a.kind === "insert" && (isPower(a) || isDms(a)) && !mf.selectionIsCollapsed) {
      // R17: a selection is the base of a power key, in brackets unless it is one plain term (#@^{2} alone would raise
      // only its last character: 1+2 selected, x² gave 1+2² = 5); the same for DMS's degrees (1+2° is 1 + 2°)
      const rest = a.latex.startsWith("#@") ? a.latex.slice(2) : a.latex;
      const base = isPlainTerm(mf.getValue(mf.selection, "latex")) ? "#@" : "\\left(#@\\right)";
      this.apply(mf, { ...a, latex: base + rest });
    } else if (a.kind === "insert" && a.latex.includes("#@") && this.selectChip(mf)) {
      // a chip is one term: ÷, a/b, x², xʸ, x⁻¹ take all of it, and it draws as one box, so no brackets
      this.apply(mf, a);
    } else if (a.kind === "insert" && a.latex.startsWith("#@^") && this.selectCompound(mf)) {
      this.apply(mf, { ...a, latex: `\\left(#@\\right)${a.latex.slice(2)}` });
    } else if (isDivide(a) && this.selectCompound(mf)) {
      // L9: with the term selected, #@ takes all of it as the numerator: \frac{\frac12}{□}
      this.apply(mf, a);
    } else this.apply(mf, a);
    if (a.kind === "cmd") this.settle?.(mf, a.name); // R27b (F23): ◀ ▶ ▲ ▼ and the trackpad stop only at a box
    mf.focus();
  }

  /** True if the atom before the cursor (or the selection) is a digit or a decimal point. */
  private afterDigit(mf: MathfieldElement): boolean {
    const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
    const o = Math.min(a, b);
    return o > 0 && /^[\d.]$/.test(mf.getElementInfo(o)?.latex ?? "");
  }

  /**
   * If the term before the cursor is a number with an exponent mark (`1.5ᴇ-3`, at the cursor's own depth), select all
   * of it and return true. MathLive's own #@ would take only the digits after the mark. Offsets list an atom's parts
   * before the atom itself, so the mark's drawing (depth below the cursor's) is skipped on the way back.
   */
  private selectENumber(mf: MathfieldElement): boolean {
    if (!mf.selectionIsCollapsed) return false;
    const end = mf.position;
    const d = mf.getElementInfo(end)?.depth ?? 0;
    const at = (o: number, re: RegExp): boolean =>
      o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");
    let k = end;
    while (at(k, /^\d$/)) k--;
    if (k === end) return false;
    if (at(k, /^[+-]$/)) k--;
    if (!at(k, /^\\emark$/)) return false;
    k--;
    while (k > 0 && (mf.getElementInfo(k)?.depth ?? 0) > d) k--;
    const mantissa = k;
    while (at(k, /^[\d.]$/)) k--;
    if (k === mantissa) return false;
    mf.selection = { ranges: [[k, end]] };
    return true;
  }

  /** If a chip is right before the cursor, select it (MathLive's #@ does not take a macro by itself) and return true. */
  private selectChip(mf: MathfieldElement): boolean {
    if (!mf.selectionIsCollapsed || !isChipLatex(mf.getElementInfo(mf.position)?.latex ?? "")) return false;
    const end = mf.position;
    mf.executeCommand("moveToPreviousChar"); // a chip is one step (captureSelection)
    mf.selection = { ranges: [[mf.position, end]] };
    return true;
  }

  /**
   * L8 / L9: if the term before the cursor is a fraction, a root, a power or a mixed number, select all of it and
   * return true, so a #@^ key (x², xʸ, x⁻¹) raises the whole term in brackets and ÷ / a/b divide it. Inside a mixed number the term is
   * the whole number; inside a fraction's part the key raises the last term of that part (user, 2026-10-12).
   * MathLive offsets list an atom's parts before the atom itself, and getElementInfo gives each one's depth.
   */
  private selectCompound(mf: MathfieldElement): boolean {
    if (!mf.selectionIsCollapsed) return false;
    const latexAt = (o: number): string => mf.getElementInfo(o)?.latex ?? "";
    const depthAt = (o: number): number => mf.getElementInfo(o)?.depth ?? 0;
    let end = mf.position;
    const d = depthAt(end);
    if (d > 0) {
      // the parent atom is the first one after the cursor that sits higher up
      let o = end + 1;
      while (o <= mf.lastOffset && depthAt(o) >= d) o++;
      if (o <= mf.lastOffset && MIXED_FRAC.test(latexAt(o))) end = o;
    }
    const latex = latexAt(end);
    const de = depthAt(end);
    /** The offset before the atom at `o`, skipping its parts. */
    const before = (o: number): number => {
      let s = o - 1;
      while (s > 0 && depthAt(s) > de) s--;
      return s;
    };
    const digit = (o: number): boolean => o > 0 && depthAt(o) === de && /^[\d.]$/.test(latexAt(o));
    let start = before(end);
    if (MIXED_FRAC.test(latex)) {
      while (digit(start)) start--;
    } else if (latex.startsWith("^")) {
      // a power whose exponent is an atom of its own: the base comes before it
      if (digit(start)) while (digit(start)) start--;
      else if (start > 0) start = before(start);
      else return false;
    } else if (!COMPOUND.test(latex) && !hasOuterSup(latex)) return false;
    mf.selection = { ranges: [[start, end]] };
    return true;
  }

  private apply(mf: MathfieldElement, a: ActionBody): void {
    switch (a.kind) {
      case "type":
        mf.executeCommand(["typedText", a.text]);
        break;
      case "insert":
        mf.insert(a.latex, { selectionMode: "placeholder", format: "latex" });
        break;
      case "cmd":
        mf.executeCommand(a.name as never);
        break;
      case "special":
        break;
    }
  }
}
