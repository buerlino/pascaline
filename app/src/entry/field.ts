// SPDX-License-Identifier: GPL-3.0-or-later
// The entry line's field once MathLive is up (R70f1): its set-up and listeners, and how a key acts on it. Everything
// here needs the field, so it loads with MathLive (EntryController.load), outside the start chunk; keys pressed before
// it is there are queued by the controller and replayed through runOnField.
import type { MathfieldElement } from "mathlive";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { deleteAtTemplate } from "./delete.ts";
import { EMARK, ENTRY_MACROS, isChipLatex } from "./macros.ts";
import { numberRunStart } from "./numberRun.ts";
import { nextBox, settle } from "./stops.ts";

/** The literal caret of the one-line mode, as MathLive serialises it (the parser reads it as a power). */
export const CARET = '\\char"5E ';

const FRAC = "\\frac{#@}{#?}";
/** An atom a bare ^ would not read as raising whole (L8): a fraction or a root. */
const COMPOUND = /^\\(?:[dt]?frac|sqrt)(?![A-Za-z])/;
const MIXED_FRAC = /^\\tfrac(?![A-Za-z])/;
/** A matrix or vector (an array environment): one atom MathLive's #@ does not take as the previous term (F68, R75). */
const MATRIX = /^\\begin\{[a-z]*matrix\}/;

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

/**
 * R68: the atom before the cursor ends no number, so ᴇ starts one: a box's sentinel (""), + − × ÷ ·, a relation, an
 * opening bracket or an argument separator, `,` or `;`. The decimal comma (R57) is MathLive's `{,}`, a group: it is not
 * in the list, so `3,ᴇ3` types no 1.
 */
const OPENS_TERM = /^(?:|[-+=<>,;([]|\\(?:times|div|cdot|lt|gt|le|leq|ge|geq|ne|neq|lbrack|lbrace|\{)(?![A-Za-z]))$/;

/** The exponent key (R14): the mark ᴇ, one token. */
function isEMark(a: ActionBody): boolean {
  return a.kind === "insert" && a.latex === EMARK;
}

/** What the field's own listeners hand back to the entry line (EntryController). */
export interface FieldEvents {
  /** A keydown, before MathLive sees it (entry/hwkeys.ts). True: handled, and the event stops. */
  key(ev: KeyboardEvent): boolean;
  /** A physical Enter or Escape; `repeat` is KeyboardEvent.repeat (a held key's auto-repeat, docs/04 5.2). */
  enter(repeat: boolean): void;
  escape(repeat: boolean): void;
}

/** Make the field in `host`, set its options and listeners; resolves with it once it is mounted and laid out. */
export async function makeField(Field: typeof MathfieldElement, host: HTMLElement | undefined, on: FieldEvents): Promise<MathfieldElement> {
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
  host?.append(mf);
  await mounted;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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
  const enforce = (): void => forceNoSystemKeyboard(mf);
  void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
  mf.addEventListener("focusin", enforce);
  // Capture on the host runs before MathLive's own handler inside the shadow root.
  mf.addEventListener(
    "keydown",
    (ev) => {
      // R26b, R31 (F16, F27): Backspace, Delete and the printable keys take the keypad's path (entry/hwkeys.ts)
      if (!on.key(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
    },
    { capture: true },
  );
  mf.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      on.enter(ev.repeat);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      on.escape(ev.repeat);
    }
  });
  keepTouchCaret(mf);
  return mf;
}

/**
 * R42 (F33): MathLive places the caret on pointerdown and, for touch only, a second time on pointerup from atom bounds
 * that the first placement made stale (right of a fraction, root, power or bracket pair the second hit lands at the
 * start of the line or box). Remember the first (right) caret and put it back after the second. A mouse click never
 * needed this. R47 (F39): then, for touch and mouse alike, a caret where ◀ ▶ cannot stop (between a function's name
 * and its bracket, inside a name) moves forward to the next stop, as ▶ would settle (stops.ts). A selection (drag,
 * double tap) is left alone.
 */
function keepTouchCaret(mf: MathfieldElement): void {
  let down: number | undefined;
  let onField = false;
  mf.addEventListener("pointerdown", (ev) => {
    down = undefined;
    onField = true;
    if (ev.pointerType !== "touch") return;
    // A microtask runs after MathLive's own pointerdown handler (inside the shadow root) has placed the caret.
    queueMicrotask(() => {
      if (mf.selectionIsCollapsed) down = mf.position;
    });
  });
  window.addEventListener("pointercancel", () => {
    onField = false;
    down = undefined;
  });
  window.addEventListener("pointerup", (ev) => {
    const want = down;
    down = undefined;
    if (!onField) return;
    onField = false;
    setTimeout(() => {
      if (!mf.selectionIsCollapsed) return;
      if (want !== undefined && ev.pointerType === "touch" && mf.position !== want) mf.position = want;
      settle(mf, "moveToNextChar");
    }, 0);
  });
}

/** The field's hidden textarea must never summon the system keyboard (inputmode=none, again after upgrade). */
function forceNoSystemKeyboard(mf: MathfieldElement): void {
  for (const el of mf.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
    el.setAttribute("inputmode", "none");
    el.setAttribute("virtualkeyboardpolicy", "manual");
  }
}

/** A type / insert / cmd action on the field (EntryController.run once the field is up). */
export function runOnField(mf: MathfieldElement, a: ActionBody): void {
  if (a.kind === "cmd" && a.name === "moveToNextChar" && nextBox(mf)) {
    mf.focus();
    return;
  }
  if (a.kind === "cmd" && (a.name === "deleteBackward" || a.name === "deleteForward")) {
    // R23 (F10): ⌫ and Del at a bracket keep the template whole (entry/delete.ts); else MathLive's own delete
    if (deleteAtTemplate(mf, a.name === "deleteBackward" ? -1 : 1)) {
      mf.focus();
      return;
    }
  }
  // R27b (F23): right after piecewise's `if ` MathLive would type text; our keys only ever type maths
  if (a.kind !== "cmd" && mf.mode === "text") mf.mode = "math";
  if (isEMark(a) && noNumberBefore(mf)) {
    // where no number can come before the mark it gets a leading 1, as on the reference: on an empty line (1ᴇ;
    // spec/mapping/vc-2026-10-11/keys.yaml r7c1) and after an operator (2×1ᴇ; G2 item 40, R68)
    apply(mf, { kind: "insert", latex: `1${EMARK}` });
    mf.focus();
    return;
  }
  if (a.kind === "insert" && a.latex === TEN_POW && afterDigit(mf)) {
    // R27a (F22): after a digit its 10 would join the number (5 10ˣ 2 was 510²); the line says 5×10² instead
    apply(mf, { ...a, latex: `\\times${TEN_POW}` });
    mf.focus();
    return;
  }
  // R14: a number with an exponent mark is one term, so x², xʸ, x⁻¹, ÷ and a/b take all of it (1.5ᴇ-3 ÷ 2 is not 1.5ᴇ-3/2
  // with the 3 alone as the numerator); a power puts it in brackets below, since it is not a plain term
  if (a.kind === "insert" && a.latex.includes("#@")) selectENumber(mf);
  if (a.kind === "insert" && (isPower(a) || isDms(a)) && !mf.selectionIsCollapsed) {
    // R17: a selection is the base of a power key, in brackets unless it is one plain term (#@^{2} alone would raise
    // only its last character: 1+2 selected, x² gave 1+2² = 5); the same for DMS's degrees (1+2° is 1 + 2°)
    const rest = a.latex.startsWith("#@") ? a.latex.slice(2) : a.latex;
    const sel = mf.getValue(mf.selection, "latex");
    // R43b: DMS on one lone □ takes it bare (sin(□°□′□″)), so ▶ out of the degrees goes to the minutes; the power keys bracket it
    // (not on the degrees □ of another DMS: there the bare form reads as a different number, so it keeps the bracket)
    const bare = isPlainTerm(sel) || (isDms(a) && sel.trim() === "\\placeholder{}" && !beforeDegree(mf));
    const base = bare ? "#@" : "\\left(#@\\right)";
    apply(mf, { ...a, latex: base + rest });
  } else if (a.kind === "insert" && a.latex.includes("#@") && selectChip(mf)) {
    // a chip is one term: ÷, a/b, x², xʸ, x⁻¹ take all of it, and it draws as one box, so no brackets
    apply(mf, a);
  } else if (a.kind === "insert" && a.latex.includes("#@") && selectMatrix(mf)) {
    // R75 (F68): a matrix is one term, as a bracket group is: x², xʸ, x⁻¹ raise all of it and ÷ divides it, no brackets
    apply(mf, a);
  } else if (a.kind === "insert" && a.latex.startsWith("#@^") && selectCompound(mf)) {
    apply(mf, { ...a, latex: `\\left(#@\\right)${a.latex.slice(2)}` });
  } else if (isDivide(a) && selectCompound(mf)) {
    // L9: with the term selected, #@ takes all of it as the numerator: \frac{\frac12}{□}
    apply(mf, a);
  } else apply(mf, a);
  if (a.kind === "cmd") settle(mf, a.name); // R27b (F23): ◀ ▶ ▲ ▼ and the trackpad stop only at a box
  mf.focus();
}

/** True if the selection is followed by a ° (it is the degrees box of a DMS). */
function beforeDegree(mf: MathfieldElement): boolean {
  const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
  return mf.getValue(Math.max(a, b), mf.lastOffset, "latex").trimStart().startsWith("\\degree");
}

/**
 * R68 (G2 item 40): no number can stand before the cursor, so ᴇ types 1ᴇ. True at a box's start (the line's too: an
 * empty line) and after an operator, a relation, an opening bracket or an argument comma; with a lone □ selected (a
 * template's empty box), at its start. After a digit, a letter, a closing bracket or a chip it is false: the mark stays
 * bare there and Enter refuses it, where 1ᴇ3 would be a silent factor of an implicit product.
 */
function noNumberBefore(mf: MathfieldElement): boolean {
  const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
  const o = Math.min(a, b);
  if (a !== b && mf.getValue(o, Math.max(a, b), "latex") !== "\\placeholder{}") return false;
  return o <= 0 || OPENS_TERM.test(mf.getElementInfo(o)?.latex ?? "");
}

/** True if the atom before the cursor (or the selection) is a digit or a decimal mark. */
function afterDigit(mf: MathfieldElement): boolean {
  const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
  const o = Math.min(a, b);
  return o > 0 && /^(?:[\d.]|\{,\})$/.test(mf.getElementInfo(o)?.latex ?? "");
}

/**
 * If the term before the cursor is a number with an exponent mark (`1.5ᴇ-3`, at the cursor's own depth), select all
 * of it and return true. MathLive's own #@ would take only the digits after the mark. Offsets list an atom's parts
 * before the atom itself, so the mark's drawing (depth below the cursor's) is skipped on the way back.
 */
function selectENumber(mf: MathfieldElement): boolean {
  if (!mf.selectionIsCollapsed) return false;
  const end = mf.position;
  const d = mf.getElementInfo(end)?.depth ?? 0;
  const at = (o: number, re: RegExp): boolean => o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");
  let k = end;
  while (at(k, /^\d$/)) k--;
  if (k === end) return false;
  if (at(k, /^[+-]$/)) k--;
  if (!at(k, /^\\emark$/)) return false;
  k--;
  while (k > 0 && (mf.getElementInfo(k)?.depth ?? 0) > d) k--;
  const mantissa = k;
  k = numberRunStart(mf, k, d); // digits, a point or the decimal comma `{,}` (R57)
  if (k === mantissa) return false;
  mf.selection = { ranges: [[k, end]] };
  return true;
}

/** If a chip is right before the cursor, select it (MathLive's #@ does not take a macro by itself) and return true. */
function selectChip(mf: MathfieldElement): boolean {
  if (!mf.selectionIsCollapsed || !isChipLatex(mf.getElementInfo(mf.position)?.latex ?? "")) return false;
  const end = mf.position;
  mf.executeCommand("moveToPreviousChar"); // a chip is one step (captureSelection)
  mf.selection = { ranges: [[mf.position, end]] };
  return true;
}

/**
 * R75 (F68): if a matrix or vector is right before the cursor, select it whole and return true. MathLive's #@ takes
 * only the atom types of its isImplicitArg (mathlive.mjs, 0.111.1), and an array is not one of them, so the template
 * would open on an empty base after it. Its cells are listed before it, one level deeper.
 */
function selectMatrix(mf: MathfieldElement): boolean {
  if (!mf.selectionIsCollapsed) return false;
  const end = mf.position;
  const info = mf.getElementInfo(end);
  if (end <= 0 || !MATRIX.test(info?.latex ?? "")) return false;
  const d = info?.depth ?? 0;
  let start = end - 1;
  while (start > 0 && (mf.getElementInfo(start)?.depth ?? 0) > d) start--;
  mf.selection = { ranges: [[start, end]] };
  return true;
}

/**
 * L8 / L9: if the term before the cursor is a fraction, a root, a power or a mixed number, select all of it and
 * return true, so a #@^ key (x², xʸ, x⁻¹) raises the whole term in brackets and ÷ / a/b divide it. Inside a mixed number the term is
 * the whole number; inside a fraction's part the key raises the last term of that part (user, 2026-10-12).
 * MathLive offsets list an atom's parts before the atom itself, and getElementInfo gives each one's depth.
 */
function selectCompound(mf: MathfieldElement): boolean {
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

function apply(mf: MathfieldElement, a: ActionBody): void {
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
