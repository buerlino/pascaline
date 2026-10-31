// SPDX-License-Identifier: GPL-3.0-or-later
// R31 (F27): the keys of a hardware keyboard (a desktop, a Bluetooth keyboard on the phone or the Tab One) take the
// keypad's path, so the line they leave parses as the same keys pressed on the keypad. Before, MathLive took them with
// its own rules: `1e-3` was 1·e − 3, `*` stayed a bare star, `\` started a LaTeX command and `|` swallowed the rest of
// the line.
// - Backspace and Delete are ⌫ and Del (R26b, F16); the arrows are the pad's keys (R45, F38).
// - A character a keypad key types runs that key (in that layer) through the shell, as a tap would: digits, `.`, `+`,
//   `-` (the − key: on an empty line it starts with Ans), `,`, space, and `=` `_` (Shift) and `#` `:` `;` (Alpha).
// - `*` is ×, `/` is ÷ (a stacked fraction in textbook entry), `^` is xʸ, `(` is the bracket pair ( ) and `|` the
//   absolute value |x|; `)` and a second `|` leave the pair they close.
// - `e` or `E` right after a number's digits (or its point) is the exponent key ᴇ.
// - `<`, `>` and `!` insert the Shift palettes' own symbols (Shift + 6, Shift + 9).
// - Other letters stay name letters. A function's name is reached through Find (R4a), as on the phone.
// - Every other character (`\ [ ] { } ' " $ % & ? @ ~` and the backtick) does nothing: no key types it.
// Loaded with MathLive (EntryController.load), outside the start chunk. Ctrl, Alt and Meta combinations stay with
// MathLive (copy, paste, select all); AltGr characters count as typed.
import type { MathfieldElement } from "mathlive";
import { numberRunStart } from "./numberRun.ts";
import type { ActionBody, Layer } from "../keyboard/keyboard.ts";

/** What the entry line (EntryController) lets the handler do. */
export interface HwTarget {
  readonly field: MathfieldElement | undefined;
  /** R57: the decimal comma is on. */
  readonly decimalComma: boolean;
  /** The entry line's own path for an action. */
  run(a: ActionBody): void;
  /** Press a keypad key in a layer, as a tap would (the shell's path: Ans first, one-line forms, open sheets). */
  onKey(id: string, layer: Layer): void;
  /** A typed letter, through the shell's checks (open sheet, picked row, apps) before it reaches the line. */
  onLetter(ch: string): void;
  /** A key that does nothing here (docs/05 3.7). */
  onDead(): void;
}

/** The keypad key that types each character, and its layer. */
const KEYS: Readonly<Record<string, readonly [string, Layer]>> = {
  ...Object.fromEntries([..."0123456789"].map((d) => [d, [`d${d}`, "primary"] as const])),
  ".": ["dot", "primary"],
  "+": ["add", "primary"],
  "-": ["sub", "primary"],
  "*": ["mul", "primary"],
  "/": ["div", "primary"],
  "^": ["pow", "primary"],
  "(": ["paren", "primary"],
  ",": ["comma", "primary"],
  " ": ["space", "primary"],
  "=": ["dot", "shift"],
  "_": ["space", "shift"],
  "#": ["d3", "alpha"],
  ":": ["sub", "alpha"],
  ";": ["add", "alpha"],
};
/** The arrow keys and the keypad keys they press (R45, controlKey). */
const ARROWS: Readonly<Record<string, string>> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
/** The Shift palettes' symbols that are one ASCII character (spec/keyboard.yaml `relations` lt, gt; `symbols` fact). */
const PALETTE = new Set(["<", ">", "!"]);

/** The keypad key and layer a hardware control key presses (R45, F38): Backspace is ⌫, Delete is Shift + ⌫ (Del), the
 *  arrows are the pad's arrow keys, Enter is Enter and Escape is Esc. Shift + an arrow is none (MathLive's selection on
 *  the entry line), nor are Home and End. One map for the entry line and the unit view's field (R24c). */
export function controlKey(ev: Pick<KeyboardEvent, "key" | "shiftKey">): readonly [string, Layer] | undefined {
  const k = ev.key;
  if (k === "Backspace" || k === "Delete") return ["bksp", k === "Backspace" ? "primary" : "shift"];
  if (k === "Enter") return ["enter", "primary"];
  if (k === "Escape") return ["esc", "primary"];
  const arrow = ARROWS[k];
  return arrow && !ev.shiftKey ? [arrow, "primary"] : undefined;
}

/** The keypad key (and its layer) that types `ch` (R24c: the unit view's field takes the same path). */
export function keypadKeyOf(ch: string, decimalComma: boolean): readonly [string, Layer] | undefined {
  return KEYS[decimalComma && ch === "," ? "." : ch];
}

/** Handle a keydown on the entry line. True: handled, and the caller stops the event. */
export function hardwareKey(ev: KeyboardEvent, t: HwTarget): boolean {
  const ch = ev.key;
  const mf = t.field;
  if (!mf || ev.isComposing) return false;
  if ((ev.ctrlKey || ev.metaKey || ev.altKey) && !ev.getModifierState("AltGraph")) return false;
  // R45 (F38): Backspace, Delete and the arrows through the shell's path (controlKey). Enter and Escape are left to the
  // controller's own listener (onEnter, onEscape), which presses the same keys.
  const ctl = ch === "Enter" || ch === "Escape" ? undefined : controlKey(ev);
  if (ctl) {
    t.onKey(ctl[0], ctl[1]);
    return true;
  }
  if (ch.length !== 1) return false;
  // a character outside ASCII (é, µ, π from a keyboard layout) is left to MathLive, as before
  if (ch < " " || ch > "~") return false;
  if ((ch === "e" || ch === "E") && afterNumber(mf)) {
    t.onKey("emark", "primary");
    return true;
  }
  if (ch === ")" || ch === "|") {
    if (leave(mf, ch === ")" ? "(" : "|")) mf.focus();
    else if (ch === "|") t.onKey("neg", "shift");
    else t.onDead();
    return true;
  }
  // R57: with the decimal comma both `.` and `,` type the decimal mark (the keypad's `.` key); `;` stays the separator
  const k = KEYS[t.decimalComma && ch === "," ? "." : ch];
  if (k) t.onKey(k[0], k[1]);
  else if (PALETTE.has(ch)) t.run({ kind: "insert", latex: ch });
  else if (/^[A-Za-z]$/.test(ch)) t.onLetter(ch);
  else t.onDead();
  return true;
}

/** The cursor stands right after a number's digits or its point (not after a name such as x2). */
function afterNumber(mf: MathfieldElement): boolean {
  if (!mf.selectionIsCollapsed) return false;
  const p = mf.position;
  const d = mf.getElementInfo(p)?.depth ?? 0;
  const at = (o: number, re: RegExp): boolean =>
    o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");
  let k = numberRunStart(mf, p, d); // digits, a point or the decimal comma (R57)
  return k < p && !at(k, /^\p{L}$/u);
}

/** `)` or `|`: put the cursor after the innermost pair around it that this character closes. False: none. */
function leave(mf: MathfieldElement, open: "(" | "|"): boolean {
  const depthAt = (o: number): number => mf.getElementInfo(o)?.depth ?? 0;
  let pos = mf.position;
  let d = depthAt(pos);
  while (d > 0) {
    // the parent atom is the first one after the cursor that sits higher up (offsets list an atom's parts first)
    let o = pos + 1;
    while (o <= mf.lastOffset && depthAt(o) >= d) o++;
    if (o > mf.lastOffset) return false;
    if ((mf.getElementInfo(o)?.latex ?? "").startsWith(`\\left${open}`)) {
      mf.position = o;
      return true;
    }
    pos = o;
    d = depthAt(o);
  }
  return false;
}
