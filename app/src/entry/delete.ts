// SPDX-License-Identifier: GPL-3.0-or-later
// ⌫ and Del at a template (R23, bug F10; R26c, bug F15; R26d, bug F17; decisions.md "⌫ at a bracket" and "⌫ and Del
// keep a template whole"). MathLive's own delete at the start of a `\left…\right` body turns the opening bracket into
// `\left.` and is stuck there, right after a pair it turns the closing bracket into `\right.`, and a deleted base leaves
// its exponent on whatever stands before it; this module takes those presses first. Public MathLive API only:
// offsets, `getElementInfo`, `selection`, `position`, `getValue`, `insert`. Plain TS; R26e–R26h extend it to every
// other template.
//
// How MathLive numbers a line: offset o is the cursor position after atom o. An atom's parts (a pair's body, a
// script's branches) come before the atom itself, one level deeper, and each branch starts with an empty sentinel.
// So in `5\sin\left(23\right)` the offsets are 0 (line start), 1 `5`, 2 `\sin`, 3 (body start), 4 `2`, 5 `3`,
// 6 the pair.
import type { MathfieldElement } from "mathlive";

type Field = Pick<
  MathfieldElement,
  "getElementInfo" | "lastOffset" | "selection" | "selectionIsCollapsed" | "position" | "getValue" | "insert" | "executeCommand"
>;

const PLACEHOLDER = "\\placeholder{}";
/** A function name a key inserts together with its pair: the name goes with the brackets. */
const NAME =
  /^\\(?:operatorname\{(?:\\mathrm\{[^{}]*\}|[^{}]*)\}|(?:arc)?(?:sin|cos|tan|cot|sec|csc)h?|ln|log|lg|exp|lim|sum|prod|det|gcd|lcm|max|min|arg|Re|Im)(?![A-Za-z])/;
/** A name whose parts are letters, not boxes. */
const LETTERS = /^\\(?:operatorname|mathrm)\{/;
/** The marks between a template's boxes (evaluate-at, lim, Σ, Π): part of the template, never content. */
const MARK = /^(?:=|\\to)$/;

/** One template around a bracket pair: [name] pair [scripts], as offsets. */
interface Template {
  /** The position before the template and the offset of its last atom: the range that holds all of it. */
  start: number;
  end: number;
  /** The main box: the body up to its first comma (EQ), as a position range. */
  main: [number, number];
  /** True when every box but the main one is empty: the name's scripts, the scripts after the pair, the later cells. */
  othersEmpty: boolean;
}

/**
 * ⌫ (dir −1) at the start of a pair's body, or Del (dir +1) at its end. Removes the template and keeps the main
 * box's content, the cursor where the opening (closing) bracket was; an empty template goes whole, and a box it
 * leaves empty shows □ again. When another box holds something (a log base, a bound, an exponent on the pair, EQ's
 * second value), the first press selects the whole template instead and the next one deletes it, so nothing from two
 * boxes is joined. True: handled; false: MathLive's own delete applies.
 */
export function deleteAtTemplate(mf: Field, dir: -1 | 1): boolean {
  if (keepSelectedBox(mf)) return true;
  const c = cursor(mf, dir);
  if (c === undefined) return false;
  if (deleteAtPower(mf, c, dir)) return true;
  const t = dir < 0 ? fromStart(mf, c) : fromEnd(mf, c);
  if (t) return removeTemplate(mf, t, dir);
  if (!mf.selectionIsCollapsed) return false;
  return stepIn(mf, c, dir) || keepBox(mf, c, dir);
}

/** Remove template `t`, or select it when another box holds something (the R23 rule above). */
function removeTemplate(mf: Field, t: Template, dir: -1 | 1): boolean {
  mf.selection = { ranges: [[t.start, t.end]] };
  if (!t.othersEmpty) return true;
  const content = mf.getValue(t.main[0], t.main[1], "latex");
  if (content !== "" && content !== PLACEHOLDER) {
    mf.insert(content, { format: "latex", selectionMode: dir < 0 ? "before" : "after" });
  } else if (fillsBox(mf, t)) {
    mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  } else mf.executeCommand("deleteBackward");
  return true;
}

/**
 * ⌫ right after a pair (dir −1), or Del right before a pair or the function name that owns it (dir +1): the cursor
 * steps into the body, to its end (start), and nothing is deleted (point 5, F15). A body that holds only □ gets the □
 * selected, as after the key, so the next press removes the template. A name with boxes of its own (a log base,
 * lim's or Σ's bounds) is left to MathLive here (R26f, R26h). True: handled.
 */
function stepIn(mf: Field, c: number, dir: -1 | 1): boolean {
  let q: number;
  if (dir < 0) {
    q = c;
    if (q === 0 || !isPair(mf, q)) return false;
  } else {
    const d = depthAt(mf, c);
    let p = c + 1;
    while (p <= mf.lastOffset && depthAt(mf, p) > d) p++;
    if (p > mf.lastOffset || depthAt(mf, p) !== d || atomStart(mf, p) !== c) return false;
    if (isPair(mf, p)) q = p;
    else {
      const name = latexAt(mf, p);
      // the name must own no box: no parts, or only its letters
      if (!NAME.test(name) || (p !== c + 1 && !LETTERS.test(name))) return false;
      q = p + 1;
      while (q <= mf.lastOffset && depthAt(mf, q) > d) q++;
      if (q > mf.lastOffset || !isPair(mf, q) || atomStart(mf, q) !== p) return false;
    }
  }
  const s = atomStart(mf, q) + 1; // the body's sentinel
  if (q - 1 === s + 1 && latexAt(mf, q - 1) === PLACEHOLDER) mf.selection = { ranges: [[s, q - 1]] };
  else mf.position = dir < 0 ? q - 1 : s;
  return true;
}

/**
 * ⌫ right after (Del right before) the only atom of a pair's body: the body shows □ again instead of going empty
 * (point 2), with the □ selected, so the next press removes the template (R23) and a digit typed now fills the box.
 * A lone □ there is the empty body itself: the press removes the template. True: handled.
 */
function keepBox(mf: Field, c: number, dir: -1 | 1): boolean {
  const a = dir < 0 ? c : c + 1; // the atom the press would delete
  if (a < 2 || a >= mf.lastOffset) return false;
  const d = depthAt(mf, a);
  const s = a - 1;
  if (d === 0 || depthAt(mf, s) !== d || latexAt(mf, s) !== "") return false; // an atom with parts, or not the first
  if (!isPair(mf, a + 1) || depthAt(mf, a + 1) !== d - 1 || atomStart(mf, a + 1) + 1 !== s) return false;
  if (latexAt(mf, a) === PLACEHOLDER) {
    const t = dir < 0 ? fromStart(mf, s) : fromEnd(mf, a);
    return t ? removeTemplate(mf, t, dir) : false;
  }
  mf.selection = { ranges: [[s, a]] };
  mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  return true;
}

// ---- powers (R26d, F17) --------------------------------------------------------------------------------------------
// MathLive keeps an exponent as an atom of its own (latex `^…`) right after its base, its box one level deeper:
// `5^{23}` is 1 `5`, 2 (the exponent's sentinel), 3 `2`, 4 `3`, 5 `^{23}`. Deleting the base leaves the exponent on
// whatever stands before it, and a box emptied by ⌫ disappears. Points 3, 4 and 6 of "⌫ and Del keep a template
// whole": ⌫ at the start of the exponent steps to the end of the base (an empty exponent on a typed base goes alone,
// the owner 2026-10-15); a press that would empty the base leaves □;
// ⌫ in an empty base removes the power when its exponent is empty or the key's own (x², x⁻¹) and selects it first
// when the exponent holds typed content. The bases of eˣ and 10ˣ are the key's own marks and go with the exponent.

/** One power: its base and exponent, as offsets. */
interface Power {
  /** The position before the base, the base's last atom, and the exponent atom (`^…`). */
  start: number;
  base: number;
  q: number;
  /** "empty": □; "mark": eˣ's e or 10ˣ's 10; "pair": a bracket pair (its own rules apply); "typed": anything else. */
  kind: "empty" | "mark" | "pair" | "typed";
  /** "empty": □ or nothing; "own": a power key's fixed exponent (2, −1); "typed": anything else. */
  x: "empty" | "own" | "typed";
}

const isSup = (mf: Field, o: number): boolean => latexAt(mf, o).startsWith("^");
const isNumberPart = (l: string): boolean => /^[\d.]$/.test(l);

/** The power whose exponent atom is at `q`, or undefined when it has no base (the line or a box starts there). */
function powerAt(mf: Field, q: number): Power | undefined {
  const d = depthAt(mf, q);
  const b = atomStart(mf, q);
  if (b === 0 || depthAt(mf, b) !== d) return undefined;
  const bl = latexAt(mf, b);
  if (bl === "" || bl.startsWith("^") || bl.startsWith("_")) return undefined; // a box's start, or a script on a script
  let start = atomStart(mf, b);
  let kind: Power["kind"] = "typed";
  if (bl === PLACEHOLDER) kind = "empty";
  else if (isPair(mf, b)) kind = "pair";
  else if (bl === "\\exponentialE") kind = "mark";
  else if (bl === "0" && start === b - 1 && b - 1 > 0 && latexAt(mf, b - 1) === "1" && depthAt(mf, b - 1) === d) {
    kind = "mark"; // 10ˣ
    start = b - 2;
  }
  const xl = mf.getValue(b + 1, q - 1, "latex");
  const x = xl === "" || xl === PLACEHOLDER ? "empty" : kind !== "mark" && /^(?:2|-1|\{-1\})$/.test(xl) ? "own" : "typed";
  return { start, base: b, q, kind, x };
}

/** The power whose base ends at atom `b` (the exponent atom right after it), if any. */
function powerOfBase(mf: Field, b: number): Power | undefined {
  if (b < 1 || b > mf.lastOffset) return undefined;
  const d = depthAt(mf, b);
  let q = b + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) > d) q++;
  if (q > mf.lastOffset || depthAt(mf, q) !== d || !isSup(mf, q) || atomStart(mf, q) !== b) return undefined;
  const p = powerAt(mf, q);
  return p?.base === b ? p : undefined;
}

/** The power whose exponent box starts at sentinel `s`, if any. */
function powerOfBox(mf: Field, s: number): Power | undefined {
  const d = depthAt(mf, s);
  if (d === 0 || latexAt(mf, s) !== "") return undefined;
  let q = s + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  if (q > mf.lastOffset || !isSup(mf, q) || atomStart(mf, q) + 1 !== s) return undefined;
  return powerAt(mf, q);
}

/**
 * ⌫ (dir −1) or Del (dir +1) at a power. `c` is the cursor, or the edge of a selected □ (cursor()). True: handled.
 * The atom the press would delete (or the □ it acts on) decides:
 * - the exponent's sentinel: ⌫ at the start of the exponent steps to the end of the base (point 3); Del at the end of
 *   the base steps into the exponent. An empty exponent on a □ base or a mark (eˣ, 10ˣ) is an empty template: it goes
 *   whole; on a typed base ⌫ removes it alone.
 * - the exponent atom: ⌫ right after the power steps into the exponent (point 5); Del at the end of the exponent, its
 *   last box, removes the empty or own exponent (the whole power on a □ base or a mark) and selects a typed one with
 *   its base first (point 4).
 * - the exponent's only atom: □ shows again (point 2); a □ there is the empty exponent (the two cases above).
 * - the base: an emptied base shows □ (point 6); a □ base or a mark removes the power, or selects it first when the
 *   exponent holds typed content (point 4). A digit of a longer number goes alone, so the number is the base.
 */
function deleteAtPower(mf: Field, c: number, dir: -1 | 1): boolean {
  const sel = !mf.selectionIsCollapsed; // then a □ is selected, and `c` is its edge on the side of the press
  const t = sel ? (dir < 0 ? c + 1 : c) : dir < 0 ? c : c + 1;
  if (t < 1 || t > mf.lastOffset) return false;
  const tl = latexAt(mf, t);

  // the exponent's sentinel: ⌫ at its start, or Del at the end of the base
  if (!sel && tl === "") {
    const p = powerOfBox(mf, t);
    if (!p) return false;
    if (p.x === "empty" && (p.kind === "empty" || p.kind === "mark")) return removePower(mf, p);
    if (dir < 0) exponentStart(mf, p);
    else toExponent(mf, p, "start");
    return true;
  }
  // the exponent atom: ⌫ right after the power, or Del at the end of its exponent
  if (!sel && isSup(mf, t)) {
    const p = powerAt(mf, t);
    if (!p) return false;
    if (dir < 0) toExponent(mf, p, "end");
    else exponentEnd(mf, p);
    return true;
  }
  // the exponent's only atom
  const box = powerOfBox(mf, t - 1);
  if (box && box.q === t + 1 && atomStart(mf, t) === t - 1) {
    if (tl === PLACEHOLDER) {
      if (box.x === "empty" && (box.kind === "empty" || box.kind === "mark")) return removePower(mf, box);
      if (dir < 0) exponentStart(mf, box);
      else exponentEnd(mf, box);
      return true;
    }
    if (sel) return false;
    mf.selection = { ranges: [[t - 1, t]] };
    mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
    return true;
  }
  // the base, or the 1 of 10ˣ's 10
  const ten = tl === "1" ? powerOfBase(mf, t + 1) : undefined;
  const p = powerOfBase(mf, t) ?? (ten?.kind === "mark" ? ten : undefined);
  if (!p || p.kind === "pair") return false;
  if (p.kind === "empty" || p.kind === "mark") {
    if (p.x === "empty" || (p.kind === "empty" && p.x === "own")) return removePower(mf, p);
    mf.selection = { ranges: [[p.start, p.q]] };
    return true;
  }
  // (a base with parts of its own, a root or a fraction, follows its own template's rules)
  if (sel || atomStart(mf, t) !== t - 1) return false;
  if (isNumberPart(tl) && isNumberPart(latexAt(mf, t - 1)) && depthAt(mf, t - 1) === depthAt(mf, t)) {
    // a digit of a longer number: delete it alone (MathLive's Del would take the exponent with it)
    mf.selection = { ranges: [[t - 1, t]] };
    mf.executeCommand("deleteBackward");
    return true;
  }
  mf.selection = { ranges: [[t - 1, t]] };
  mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  return true;
}

/** The cursor at the end of the base; a □ base is selected, as after the key. */
function toBase(mf: Field, p: Power): void {
  if (p.kind === "empty") mf.selection = { ranges: [[p.base - 1, p.base]] };
  else mf.position = p.base;
}

/** The cursor at the start or the end of the exponent; an exponent that holds only □ gets it selected. */
function toExponent(mf: Field, p: Power, at: "start" | "end"): void {
  const s = p.base + 1;
  if (p.q - 1 === s + 1 && latexAt(mf, p.q - 1) === PLACEHOLDER) mf.selection = { ranges: [[s, s + 1]] };
  else mf.position = at === "start" ? s : p.q - 1;
}

/** Del at the end of the exponent (its last box): see deleteAtPower. */
function exponentEnd(mf: Field, p: Power): void {
  if (p.x === "typed") mf.selection = { ranges: [[p.start, p.q]] };
  else if (p.kind === "empty" || p.kind === "mark") removePower(mf, p);
  else removeExponent(mf, p);
}

/**
 * ⌫ at the start of the exponent: an empty one on a typed base goes alone, the cursor after the base (the owner,
 * 2026-10-15: `5 xʸ ⌫` gives 5, one ⌫ per key press); any other steps to the end of the base. A bracket base steps
 * too: its pair may be the key's own (the one-line x⁻¹, `\left(#@\right)^{-1}`), and alone it would be a lone mark.
 */
function exponentStart(mf: Field, p: Power): void {
  if (p.x === "empty" && p.kind === "typed") removeExponent(mf, p);
  else toBase(mf, p);
}

/** Remove the exponent and keep the base, the cursor after it. */
function removeExponent(mf: Field, p: Power): void {
  mf.selection = { ranges: [[p.base, p.q]] };
  mf.executeCommand("deleteBackward");
}

/** Remove the whole power; a box it filled shows □ again. */
function removePower(mf: Field, p: Power): true {
  mf.selection = { ranges: [[p.start, p.q]] };
  const d = depthAt(mf, p.q);
  const fills = d > 0 && latexAt(mf, p.start) === "" && (p.q === mf.lastOffset || depthAt(mf, p.q + 1) < d);
  if (fills) mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  else mf.executeCommand("deleteBackward");
  return true;
}

/**
 * A selection that is all of a box below the line (a template the first press selected inside a bracket body, an
 * exponent or a fraction's part): ⌫ and Del leave □ there, selected (point 2). MathLive's own delete of such a
 * selection can take the box's owner with it: `\left(\left(□\right)^{-1}\right)^{-1}` with the inner power selected
 * left `^{-1}` (R26d). True: handled.
 */
function keepSelectedBox(mf: Field): boolean {
  if (mf.selectionIsCollapsed) return false;
  const r = mf.selection.ranges;
  if (r.length !== 1 || !r[0]) return false;
  const a = Math.min(...r[0]);
  const b = Math.max(...r[0]);
  const d = depthAt(mf, a);
  if (d === 0 || latexAt(mf, a) !== "" || b <= a || depthAt(mf, b) !== d) return false;
  if (b !== mf.lastOffset && depthAt(mf, b + 1) >= d) return false;
  for (let o = a + 1; o < b; o++) if (depthAt(mf, o) < d) return false;
  if (mf.getValue(a, b, "latex") === PLACEHOLDER) return false;
  mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  return true;
}

/** The cursor, or the edge of a selected □ that fills a box (where a template's insert leaves the selection). */
function cursor(mf: Field, dir: -1 | 1): number | undefined {
  if (mf.selectionIsCollapsed) return mf.position;
  const r = mf.selection.ranges;
  if (r.length !== 1 || !r[0]) return undefined;
  const a = Math.min(...r[0]);
  const b = Math.max(...r[0]);
  if (mf.getValue(a, b, "latex") !== PLACEHOLDER) return undefined;
  return dir < 0 ? a : b;
}

const depthAt = (mf: Field, o: number): number => mf.getElementInfo(o)?.depth ?? 0;
const latexAt = (mf: Field, o: number): string => mf.getElementInfo(o)?.latex ?? "";

/** The position before atom `o` (its parts skipped). */
function atomStart(mf: Field, o: number): number {
  const d = depthAt(mf, o);
  let s = o - 1;
  while (s > 0 && depthAt(mf, s) > d) s--;
  return s;
}

const isPair = (mf: Field, o: number): boolean => latexAt(mf, o).startsWith("\\left");

/** ⌫ at `c`: the start of a pair's body, or of the first box of a named pair (a log base, lim's bounds). */
function fromStart(mf: Field, c: number): Template | undefined {
  const d = depthAt(mf, c);
  if (d === 0 || latexAt(mf, c) !== "") return undefined;
  let p = c + 1;
  while (p <= mf.lastOffset && depthAt(mf, p) >= d) p++;
  if (p > mf.lastOffset || atomStart(mf, p) + 1 !== c) return undefined;
  if (isPair(mf, p)) return template(mf, p);
  // the first box of the name's scripts
  const name = latexAt(mf, p);
  if (!NAME.test(name) || LETTERS.test(name)) return undefined;
  let q = p + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) > depthAt(mf, p)) q++;
  if (q > mf.lastOffset || !isPair(mf, q) || atomStart(mf, q) !== p) return undefined;
  return template(mf, q);
}

/** Del at `c`: the end of a pair's body. */
function fromEnd(mf: Field, c: number): Template | undefined {
  const p = c + 1;
  if (p > mf.lastOffset || !isPair(mf, p) || depthAt(mf, c) !== depthAt(mf, p) + 1) return undefined;
  return template(mf, p);
}

/** True if every offset in [from, to] is a sentinel, a □ or a mark. */
function empty(mf: Field, from: number, to: number): boolean {
  for (let o = from; o <= to; o++) {
    const l = latexAt(mf, o);
    if (l !== "" && l !== PLACEHOLDER && !MARK.test(l) && l !== ",") return false;
  }
  return true;
}

/** The template around the pair at offset `q`: a function name before it, and the scripts after it. */
function template(mf: Field, q: number): Template {
  const de = depthAt(mf, q);
  const ps = atomStart(mf, q);
  const body = ps + 1;
  let start = ps;
  let othersEmpty = true;
  const name = ps > 0 && depthAt(mf, ps) === de ? latexAt(mf, ps) : "";
  const named = NAME.test(name);
  if (named) {
    start = atomStart(mf, ps);
    if (!LETTERS.test(name)) othersEmpty = empty(mf, start + 1, ps - 1);
  }
  // scripts on the pair: the evaluate-at bounds, or an exponent (x² on a bracket)
  let end = q;
  for (;;) {
    let s = end + 1;
    while (s <= mf.lastOffset && depthAt(mf, s) > de) s++;
    if (s === end + 1 || s > mf.lastOffset || depthAt(mf, s) !== de || !/^[_^]/.test(latexAt(mf, s))) break;
    othersEmpty &&= empty(mf, end + 1, s - 1);
    end = s;
  }
  // a function's later cells (EQ(a, b)): the main box ends at the first comma
  let mainEnd = q - 1;
  if (named) {
    for (let o = body + 1; o < q; o++) {
      if (depthAt(mf, o) === de + 1 && latexAt(mf, o) === ",") {
        mainEnd = o - 1;
        othersEmpty &&= empty(mf, o, q - 1);
        break;
      }
    }
  }
  return { start, end, main: [body, mainEnd], othersEmpty };
}

/** True if the template is all of a box below the line (a fraction's part, an outer body): it leaves □ behind. */
function fillsBox(mf: Field, t: Template): boolean {
  const d = depthAt(mf, t.end);
  if (d === 0 || depthAt(mf, t.start) !== d || latexAt(mf, t.start) !== "") return false;
  return t.end === mf.lastOffset || depthAt(mf, t.end + 1) < d;
}
