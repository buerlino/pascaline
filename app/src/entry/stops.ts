// SPDX-License-Identifier: GPL-3.0-or-later
// Where the cursor stops (R27b, bug F23). MathLive's ◀ and ▶ visit every atom boundary, so the arrows and every
// trackpad step also stopped where no key can type into a box: a 7 between sin and its bracket gave `sin 7(2)`, read
// as sin(7·2) with no mark, and one inside EQ, approx, NOT, AND, the `if ` of piecewise or the d of ∫ broke the name.
// After an arrow step the controller calls `settle`, which keeps stepping the same way while the cursor is not at a
// stop (▲ and ▼ settle to the left: before the name they landed in). Loaded with MathLive, outside the start chunk.
// ▶ in a template goes on to the next empty box (R10), but stops first at the end of the box that holds the template it
// leaves (R43, bug F34): `nextBox`. Public MathLive API only; offsets and boxes as in boxes.ts (an atom's parts come
// before it, one level deeper).
import type { MathfieldElement } from "mathlive";
import { DIFF, NAME, THIN, depthAt, dmsMark, endsBox, latexAt } from "./boxes.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset" | "position" | "selectionIsCollapsed" | "executeCommand" | "getValue">;

/** The atom right after the cursor is a mark, not a box: piecewise's `if `, ∂, the evaluate-at subscript (∫'s d: `intD`). */
const MARK_AHEAD = /^(?:\\text\{|\\partial(?![A-Za-z])|_)/;
/** An atom with parts but no box: a name drawn from letters, the i and eˣ keys' upright letter. The cursor never goes in. */
const NO_BOX = /^\\(?:operatorname\{|imaginaryI$|exponentialE$)/;
// (∫'s d is the template's `\,\mathrm{d}`, THIN and DIFF; another upright letter, an i or e in a recalled line, is an atom.)

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

/** The atom ending at offset `o` is ∫'s d: `\mathrm{d}` right after `\,` on the same level. */
const intD = (mf: Field, o: number): boolean =>
  latexAt(mf, o) === DIFF && latexAt(mf, o - 1) === THIN && depthAt(mf, o - 1) === depthAt(mf, o);

/**
 * True if a key typed at position `c` lands in a box. Not a stop: inside a name (`\operatorname`, the i and eˣ atoms), right
 * after ∫'s upright d (a digit there joins it: `\mathrm{d7}`), right before a mark (`if `, ∫'s `\,` d, ∂, the evaluate-at
 * subscript), and between a function name and its bracket (G2 item 50).
 */
export function isStop(mf: Field, c: number): boolean {
  if (NO_BOX.test(owner(mf, c))) return false;
  if (intD(mf, c)) return false;
  const before = latexAt(mf, c);
  const next = atomAfter(mf, c);
  if (MARK_AHEAD.test(next)) return false;
  if (before === THIN && next === DIFF) return false;
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

/**
 * ▶ in a template (R10): while an empty box is still ahead of the cursor, ▶ goes to it, as the arrows walk the boxes on
 * the reference. MathLive's own step would stop on every mark between boxes (∂, d, the evaluate-at bar, the brackets
 * of a body) and type into the wrong place. With no empty box ahead, ▶ is the plain step (false: not handled here).
 * R43 (F34): a step that leaves the template the cursor is in and lands at the end of the box that holds it stops there
 * first: ÷ x xʸ 2 ▶ + 1 is (x²+1)/□, no longer x²/(+1); the next ▶ goes on to the empty box. True: moved.
 */
export function nextBox(mf: Field): boolean {
  // (an empty box the cursor stands in is not part of what follows it: an empty box is skipped, as on the reference)
  const c = mf.position;
  if (!mf.getValue(c, mf.lastOffset, "latex").includes("\\placeholder")) return false;
  if (leavesToBoxEnd(mf, c)) mf.position = c + 1;
  else mf.executeCommand("moveToNextPlaceholder");
  return true;
}

/**
 * True if the plain step from `c` (the cursor, or the end of a selected □) leaves the template `c` is in and lands at
 * the end of a box (endsBox: before the next box's sentinel, a mark such as EQ's comma, ∫'s `\,` d or a DMS mark, or
 * where the level drops). That step goes over the template's own atom, which comes right after its last box: a
 * fraction, a root, a power, a bracket pair or a script, one level up (the depth drops), or DMS's ″ on its own level.
 * Elsewhere R10's jump stays: in `\frac{x^{2}+1}{□}` the + follows the power in the same box.
 */
function leavesToBoxEnd(mf: Field, c: number): boolean {
  const p = c + 1;
  if (p > mf.lastOffset || !endsBox(mf, p)) return false;
  return depthAt(mf, p) < depthAt(mf, c) || dmsMark(mf, p)?.end === p;
}
