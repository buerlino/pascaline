// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once.
import type { MathfieldElement } from "mathlive";
import { constKey, pruneChips, resKey, type Chip, type ChipTable } from "../input/chips.ts";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { mathlive } from "../render/mathlive.svelte.ts";
import { ANS_CHIP, CHIP_MACROS, constChip, isChipLatex, resChip } from "./macros.ts";

/** The literal caret of the one-line mode, as MathLive serialises it (the parser reads it as a power). */
export const CARET = '\\char"5E ';

const FRAC = "\\frac{#@}{#?}";
const MIXED = "\\tfrac{#?}{#?}";
/** A whole number right before the cursor (not part of a decimal, a name or a group). */
const WHOLE_BEFORE = /(?:^|[^\d.}A-Za-z_^])\d+$/;
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

/** The keys that join two terms: + − × ÷ and a/b. (−) is negation and stays where it is (a sign inside the exponent). */
function isBinaryOperator(a: ActionBody, keyId: string | undefined): boolean {
  if (keyId === "neg") return false;
  if (a.kind === "type") return a.text === "+" || a.text === "-";
  return a.kind === "insert" && (a.latex === "\\times" || a.latex === "\\div" || a.latex === FRAC);
}

export class EntryController {
  private mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  private queue: ActionBody[] = [];
  private pendingValue: string | undefined;
  /** The values of the chips on the line (docs/04 3.6); keys as in input/chips.ts. */
  private table: ChipTable = {};
  private nextRes = 1;
  /** Called for a physical Enter / Escape (desktop convenience). */
  onEnter: () => void = () => {};
  onEscape: () => void = () => {};
  /** One-line entry mode (settings): a typed ^ is a literal caret, not a raised exponent (L4). */
  lineMode = false;

  /** Resolves when the entry line is on the page and the queued keys have been replayed. */
  ready: Promise<void> = Promise.resolve();
  private started = false;

  /** The page element the field goes into (set by the shell). */
  setHost(host: HTMLElement): void {
    this.host = host;
  }

  /** Start loading MathLive; safe to call once. */
  load(): Promise<void> {
    if (this.started) return this.ready;
    this.started = true;
    this.ready = mathlive.load().then((m) => this.create(m.MathfieldElement));
    return this.ready;
  }

  private async create(Field: typeof MathfieldElement): Promise<void> {
    // Fonts come from mathlive/static.css (bundled by Vite), not from a fonts folder at run time.
    Field.fontsDirectory = null;
    Field.soundsDirectory = null;
    Field.plonkSound = null;
    Field.keypressSound = null;
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
    mf.macros = { ...mf.macros, ...CHIP_MACROS };
    const enforce = (): void => this.forceNoSystemKeyboard();
    void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
    mf.addEventListener("focusin", enforce);
    // Capture on the host runs before MathLive's own handler inside the shadow root.
    mf.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key !== "^" || !this.lineMode) return;
        ev.preventDefault();
        ev.stopPropagation();
        mf.insert(CARET, { format: "latex" });
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
    if (this.pendingValue !== undefined) mf.value = this.pendingValue;
    this.pendingValue = undefined;
    // Replay the queued keys one by one through the same path as a live keypress. Keys that arrive while
    // we replay (this.mf is set now) go straight in, so drain until the queue is empty.
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
    while (this.queue.length > 0) this.run(this.queue.shift() as ActionBody);
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
    this.table = {};
    this.nextRes = 1;
    if (this.mf) this.mf.value = "";
  }
  /** Put a previous entry back on the line, with the values of its chips. */
  set(latex: string, chips: ChipTable = {}): void {
    this.table = { ...chips };
    this.nextRes = 1 + Math.max(0, ...Object.keys(chips).map((k) => (k.startsWith("res:") ? Number(k.slice(4)) : 0)));
    if (!this.mf) {
      this.pendingValue = latex;
      this.queue = [];
      return;
    }
    this.mf.value = latex;
    this.mf.focus();
    this.mf.executeCommand("moveToMathfieldEnd");
  }
  /** Insert LaTeX at the cursor (a history result, L5). */
  insert(latex: string): void {
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

  /** The field value right after the a/b key made a fraction from a whole number (see run), else undefined. */
  private mixedAfter: string | undefined;

  /**
   * Run a type / insert / cmd action. Specials belong to the app and are not handled here.
   * `keyId` "frac" (a/b): pressed again right after it turned a whole number into a fraction's numerator,
   * it makes a mixed number instead (2 a/b a/b 1 ▶ 2 → 2½, as \tfrac; L2, assumed, G2 item 29, backlog G6).
   */
  run(a: ActionBody, keyId?: string): void {
    if (a.kind === "special") return;
    if (!this.mf) {
      this.queue.push(a);
      return;
    }
    const mf = this.mf;
    const isFrac = keyId === "frac" && isDivide(a);
    if (isFrac && this.mixedAfter !== undefined && this.mixedAfter === mf.value) {
      this.mixedAfter = undefined;
      mf.executeCommand("undo");
      mf.insert(MIXED, { selectionMode: "placeholder", format: "latex" });
      mf.focus();
      return;
    }
    if (isBinaryOperator(a, keyId)) this.endExponent(mf);
    const whole = isFrac && WHOLE_BEFORE.test(mf.getValue(0, mf.position, "latex"));
    if (a.kind === "insert" && a.latex.includes("#@") && this.selectChip(mf)) {
      // a chip is one term: ÷, a/b, x², xʸ, x⁻¹ take all of it, and it draws as one box, so no brackets
      this.apply(mf, a);
    } else if (a.kind === "insert" && a.latex.startsWith("#@^") && this.selectCompound(mf)) {
      this.apply(mf, { ...a, latex: `\\left(#@\\right)${a.latex.slice(2)}` });
    } else if (isDivide(a) && this.selectCompound(mf)) {
      // L9: with the term selected, #@ takes all of it as the numerator: \frac{\frac12}{□}
      this.apply(mf, a);
    } else this.apply(mf, a);
    this.mixedAfter = whole ? mf.value : undefined;
    mf.focus();
  }

  /**
   * The EEX key puts the cursor in the exponent of `×10^`. An operator typed there would become part of the exponent
   * (2.2E-9 × 4.7E3 read as 2.2E-42300, silently; decisions M4-2), so once the exponent holds a digit an operator key
   * first moves the cursor out of it. A sign typed before any digit stays in: it is the exponent's sign.
   */
  private endExponent(mf: MathfieldElement): void {
    if (!mf.selectionIsCollapsed) return;
    const depth = mf.getElementInfo(mf.position)?.depth ?? 0;
    if (depth === 0) return;
    // MathLive lists an atom's parts before the atom: the parent is the first later offset that sits higher up,
    // and the first offset of the exponent's own branch is the one after the last offset that sits higher up.
    let o = mf.position + 1;
    while (o <= mf.lastOffset && (mf.getElementInfo(o)?.depth ?? 0) >= depth) o++;
    const parent = mf.getElementInfo(o)?.latex ?? "";
    if (!parent.startsWith("^") || !/\d/.test(parent)) return; // `^3` or `^{-9}`: MathLive drops the braces round one character
    let first = mf.position;
    while (first > 0 && (mf.getElementInfo(first - 1)?.depth ?? 0) >= depth) first--;
    if (!/\\times10$/.test(mf.getValue(0, first, "latex"))) return;
    mf.executeCommand("moveAfterParent");
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
