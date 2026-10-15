// SPDX-License-Identifier: GPL-3.0-or-later
// Where the cursor stops (R27b, bug F23). MathLive's ◀ and ▶ visit every atom boundary, so the arrows and every
// trackpad step also stopped where no key can type into a box: a 7 between sin and its bracket gave `sin 7(2)`, read
// as sin(7·2) with no mark, and one inside EQ, approx, NOT, AND, the `if ` of piecewise or the d of ∫ broke the name.
// After an arrow step the controller calls `settle`, which keeps stepping the same way while the cursor is not at a
// stop (▲ and ▼ settle to the left: before the name they landed in). Loaded with MathLive, outside the start chunk.
// Public MathLive API only; offsets as in delete.ts (an atom's parts come before it, one level deeper).
import type { MathfieldElement } from "mathlive";
import { NAME } from "./delete.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset" | "position" | "selectionIsCollapsed" | "executeCommand">;

/** The atom right after the cursor is a mark, not a box: piecewise's `if `, ∫'s d, ∂, the evaluate-at subscript. */
const MARK_AHEAD = /^(?:\\text\{|\\mathrm\{|\\partial(?![A-Za-z])|_)/;
/** A name drawn from letters: the cursor never goes between them. */
const LETTERS = /^\\operatorname\{/;

const latexAt = (mf: Field, o: number): string => mf.getElementInfo(o)?.latex ?? "";
const depthAt = (mf: Field, o: number): number => mf.getElementInfo(o)?.depth ?? 0;

/** The atom right after position `c` on its level, or "" where its box ends (a next box starts with "" too). */
function atomAfter(mf: Field, c: number): string {
  const d = depthAt(mf, c);
  for (let p = c + 1; p <= mf.lastOffset; p++) {
    const dp = depthAt(mf, p);
    if (dp < d) return "";
    if (dp === d) return latexAt(mf, p);
  }
  return "";
}

/** The atom whose part holds position `c` (the first later offset one level up), or "" on the line. */
function owner(mf: Field, c: number): string {
  const d = depthAt(mf, c);
  if (d === 0) return "";
  for (let p = c + 1; p <= mf.lastOffset; p++) if (depthAt(mf, p) < d) return latexAt(mf, p);
  return "";
}

/**
 * True if a key typed at position `c` lands in a box. Not a stop: inside a name (`\operatorname`), right after ∫'s
 * upright d (a digit there joins it: `\mathrm{d7}`), right before a mark (`if `, ∫'s `\,` d, ∂, the evaluate-at
 * subscript), and between a function name and its bracket (G2 item 50).
 */
export function isStop(mf: Field, c: number): boolean {
  if (LETTERS.test(owner(mf, c))) return false;
  const before = latexAt(mf, c);
  if (before.startsWith("\\mathrm{")) return false;
  const next = atomAfter(mf, c);
  if (MARK_AHEAD.test(next)) return false;
  return !(NAME.test(before) && next.startsWith("\\left"));
}

const STEP: Readonly<Record<string, "moveToNextChar" | "moveToPreviousChar">> = {
  moveToNextChar: "moveToNextChar",
  moveToPreviousChar: "moveToPreviousChar",
  moveUp: "moveToPreviousChar",
  moveDown: "moveToPreviousChar",
};

/** After the arrow command `cmd`: step on while the cursor is not at a stop (or until it cannot move). */
export function settle(mf: Field, cmd: string): void {
  const step = STEP[cmd];
  if (!step) return;
  for (let k = 0; k < 64 && mf.selectionIsCollapsed && !isStop(mf, mf.position); k++) {
    const at = mf.position;
    mf.executeCommand(step);
    if (mf.position === at) return;
  }
}
