// SPDX-License-Identifier: GPL-3.0-or-later
// ⌫ and Del at a template (R23, bug F10; R26c, bug F15; R26d, bug F17; R26e, bug F18; decisions.md "⌫ at a bracket"
// and "⌫ and Del keep a template whole"; R26f, bug F19). MathLive's own delete at the start of a `\left…\right` body
// turns the opening bracket into `\left.` and is stuck there, right after a pair it turns the closing bracket into
// `\right.`, a deleted base leaves its exponent on whatever stands before it, a fraction or a root loses an emptied box
// or joins its parts, and lim, Σ, Π and ∫ lose their bounds and marks; this module takes those presses first. Public
// MathLive API only: offsets, `getElementInfo`, `selection`, `position`, `getValue`, `insert`. Plain TS; R26g–R26h
// extend it to the other templates.
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
/** lim, Σ, Π and ∫: an operator whose bounds are its scripts (R26f). */
const BIGOP = /^\\(?:lim|sum|prod|int)(?![A-Za-z])/;
const INT = /^\\int(?![A-Za-z])/;
/** ∫'s marks before its variable: a thin space and an upright d. */
const THIN = "\\,";
const DIFF = "\\mathrm{d}";

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
  if (deleteAtBoxes(mf, c, dir)) return true;
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
 * selected, as after the key, so the next press removes the template. A name with boxes of its own is not stepped
 * into here: lim's, Σ's and Π's bounds are deleteAtBoxes' (R26f), a log base is left to MathLive (R26h). True: handled.
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
  if (fillsRange(mf, p.start, p.q)) mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  else mf.executeCommand("deleteBackward");
  return true;
}

// ---- fractions and roots (R26e, F18) -------------------------------------------------------------------------------
// MathLive keeps a fraction or a root as one atom whose boxes (branches) come before it, one level deeper, each from
// its empty sentinel: `5\frac{2}{3}` is 1 `5`, 2 (numerator), 3 `2`, 4 (denominator), 5 `3`, 6 the fraction; an index
// comes before the radicand. Its own delete removes an emptied box (`\sqrt[3]{8}` minus the 3 is `\sqrt8`), joins
// the parts at the start of a denominator, leaves a root at the start of its index, and deletes ∂ marks alone.
// Points 2-5 of "⌫ and Del keep a template whole" instead, for ÷ and a b/c, √, ⁿ√, ∂ (its ∂ marks start its boxes)
// and the mixed number (its whole part, the digits or □ right before `\tfrac`, is its first box).

/**
 * One box, as positions: `from` its sentinel (or the mark or atom it starts after: lim's →, the = of Σ and Π, ∫'s
 * operator and d), `s` where its content starts (after a ∂ mark), `e` its last offset.
 */
interface Box {
  from: number;
  s: number;
  e: number;
}

/** A fraction or a root with its boxes, as offsets. */
interface BoxTemplate {
  /** The position before the template and the offset of its atom: the range that holds all of it. */
  start: number;
  end: number;
  boxes: Box[];
  /** True for the mixed number: its first box is the whole part, on the template's own level. */
  whole: boolean;
  /** The box whose content stays when ⌫ in the first box removes the template (point 4); none for ⁿ√ (brief R26e). */
  main?: number;
  /**
   * The box a #@ key took from the line (a fraction's numerator, a mixed number's whole part). When it alone holds
   * something, ⌫ at the start of any other box removes the template and keeps it: `5 ÷ ⌫` gives 5, one ⌫ per key
   * press, as an empty exponent on a typed base (the owner, 2026-10-15, R26d).
   */
  arg?: number;
  /** A plain fraction (÷, a b/c): ⌫ at the start of its denominator joins the parts, as on the G2 (item 47). */
  joins?: boolean;
  /**
   * Positions inside the template that are no box (lim's between its scripts and its bracket, ∫'s between `\,` and
   * d), each with the index of the box before it: ⌫ there steps to the end of that box, Del to the start of the next.
   */
  gaps?: Map<number, number>;
}

const DIGIT = /^\d$/;

/** The fraction, root, lim, Σ, Π or ∫ whose atom is at `q` (for lim, Σ and Π, also their bracket's), or undefined. */
function boxTemplate(mf: Field, q: number): BoxTemplate | undefined {
  if (q < 1 || q > mf.lastOffset) return undefined;
  const l = latexAt(mf, q);
  if (BIGOP.test(l)) return bigOp(mf, q);
  if (isPair(mf, q)) {
    const x = atomStart(mf, q);
    const t = x > 0 && depthAt(mf, x) === depthAt(mf, q) ? bigOp(mf, x) : undefined;
    return t?.end === q ? t : undefined;
  }
  if (!/^\\(?:t?frac|sqrt)(?![A-Za-z])/.test(l)) return undefined;
  const d = depthAt(mf, q);
  const a = atomStart(mf, q);
  const sentinels: number[] = [];
  for (let o = a + 1; o < q; o++) if (depthAt(mf, o) === d + 1 && latexAt(mf, o) === "") sentinels.push(o);
  if (sentinels.length === 0) return undefined;
  const boxes = sentinels.map((s, i) => ({ from: s, s, e: (sentinels[i + 1] ?? q) - 1 }));
  const t = { start: a, end: q, boxes, whole: false };
  if (l.startsWith("\\sqrt")) return boxes.length === 1 ? { ...t, main: 0 } : t;
  // ∂: both parts start with the mark, which belongs to the template
  if (boxes.length === 2 && boxes.every((b) => b.e > b.s && latexAt(mf, b.s + 1) === "\\partial")) {
    for (const b of boxes) b.s += 1;
    return { ...t, main: 0 };
  }
  if (l.startsWith("\\tfrac")) {
    // the mixed number's whole part: a □, or the digits before the fraction
    let s = a;
    if (latexAt(mf, a) === PLACEHOLDER) s = a - 1;
    else while (s > 0 && depthAt(mf, s) === d && DIGIT.test(latexAt(mf, s))) s--;
    // (no whole part at all, as when a mixed number went in on another's □: its whole box is empty, of no width)
    return { start: s, end: q, boxes: [{ from: s, s, e: a }, ...boxes], whole: true, main: 0, arg: 0 };
  }
  return { ...t, main: 0, arg: 0, joins: true };
}

/** The template owning the box sentinel at `o` (the first atom after it that sits higher up). */
function ownerOf(mf: Field, o: number): BoxTemplate | undefined {
  const d = depthAt(mf, o);
  if (d === 0 || latexAt(mf, o) !== "") return undefined;
  let q = o + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  const t = boxTemplate(mf, q);
  return t?.boxes.some((b) => b.from === o) ? t : undefined;
}

/**
 * The template with a box that holds position `c` (the innermost), and that box's index; `gap` when `c` is one of the
 * template's positions that are no box (`k` is then the box before it).
 */
function locate(mf: Field, c: number): { t: BoxTemplate; k: number; gap?: true } | undefined {
  const d = depthAt(mf, c);
  // a mixed number's whole part, on the template's own level: the digits or □ after c, then the fraction
  let o = c + 1;
  while (o <= mf.lastOffset && depthAt(mf, o) === d && (DIGIT.test(latexAt(mf, o)) || latexAt(mf, o) === PLACEHOLDER)) o++;
  const m = o <= mf.lastOffset && depthAt(mf, o) === d + 1 ? ownerOf(mf, o) : undefined;
  const w = m?.whole ? m.boxes[0] : undefined;
  if (m && w && c >= w.from && c <= w.e) return { t: m, k: 0 };
  // a gap of lim, Σ or Π, or ∫'s integrand or variable: on c's own level
  const op = onLevel(mf, c);
  if (op) return op;
  // the box below the line: its sentinel is the nearest offset at or before c on c's level
  if (d === 0) return undefined;
  o = c;
  while (o > 0 && !(depthAt(mf, o) === d && latexAt(mf, o) === "")) o--;
  const t = ownerOf(mf, o);
  const k = t ? t.boxes.findIndex((b) => c >= b.from && c <= b.e) : -1;
  return t && k >= 0 ? { t, k } : undefined;
}

/**
 * True if position `o` starts a box: its sentinel, the ∂ mark that opens a box of ∂, the → or = of lim, Σ and Π, or
 * ∫'s operator and d (its integrand and its variable start right after them, on the line itself).
 */
function startsBox(mf: Field, o: number): boolean {
  const d = depthAt(mf, o);
  const l = latexAt(mf, o);
  if (d > 0 && (l === "" || opMark(mf, o))) return true;
  if (d > 0 && l === "\\partial" && latexAt(mf, o - 1) === "" && depthAt(mf, o - 1) === d) return true;
  return INT.test(l) || l === DIFF;
}

const boxEmpty = (mf: Field, b: Box): boolean => b.e === b.s || (b.e === b.s + 1 && latexAt(mf, b.e) === PLACEHOLDER);

/** The cursor at the end (start) of box `b`; a box that holds only □ gets it selected, as after the key. */
function toBox(mf: Field, b: Box, at: "start" | "end"): void {
  if (b.e === b.s + 1 && latexAt(mf, b.e) === PLACEHOLDER) mf.selection = { ranges: [[b.s, b.e]] };
  else mf.position = at === "start" ? b.s : b.e;
}

/**
 * ⌫ (dir −1) or Del (dir +1) at a fraction or a root. `c` is the cursor, or the edge of a selected □. True: handled.
 * - right after (Del: right before) the template: into its last (first) box, nothing deleted (point 5);
 * - at the start of a box but the first (Del: the end of a box but the last): to the end of the box before (the start
 *   of the next one), nothing deleted (point 3), unless only the key's argument holds something: then the template
 *   goes and the argument stays; a plain fraction joins its parts instead, the cursor between them (G2 item 47);
 * - at the start of the first box (Del: the end of the last): the template goes when every box is empty, keeps the
 *   main box's content when only it holds something, and is selected first otherwise (point 4);
 * - on a box's only atom: □ shows again, selected (point 2).
 * Anything else (a character inside a box with more than one) is MathLive's own delete.
 */
function deleteAtBoxes(mf: Field, c: number, dir: -1 | 1): boolean {
  const sel = !mf.selectionIsCollapsed;
  if (!sel) {
    if (dir < 0) {
      const t = boxTemplate(mf, c);
      if (t?.end === c) {
        toBox(mf, t.boxes[t.boxes.length - 1] as Box, "end");
        return true;
      }
    } else {
      // (a mixed number starts with its whole part: Del there deletes a typed digit, or acts in the □, below)
      const t = c < mf.lastOffset ? ownerOf(mf, c + 1) : undefined;
      if (t?.start === c && !t.whole) {
        toBox(mf, t.boxes[0] as Box, "start");
        return true;
      }
    }
  }
  const at = locate(mf, c);
  if (!at) return false;
  const { t, k } = at;
  if (at.gap) {
    // a position that is no box: as the start of the box after it (⌫) or the end of the box before it (Del)
    if (sel) return false;
    toBox(mf, t.boxes[dir < 0 ? k : k + 1] as Box, dir < 0 ? "end" : "start");
    return true;
  }
  const b = t.boxes[k] as Box;
  const n = t.boxes.length;
  const empty = boxEmpty(mf, b);
  if (dir < 0 && (c <= b.s || (empty && c <= b.e))) {
    // (a mixed number's typed whole part: the cursor before its digits is on the line, not in a box)
    if (t.whole && k === 0 && !empty && !sel) return false;
    if (k > 0) {
      if (t.joins) join(mf, t);
      else if (onlyArg(mf, t)) keep(mf, t, t.arg as number, "after");
      else toBox(mf, t.boxes[k - 1] as Box, "end");
    } else firstOrLast(mf, t, "before");
    return true;
  }
  if (dir > 0 && !sel && !empty && c < b.s) {
    // Del before a ∂ mark acts after it: the mark goes only with its template
    mf.position = b.s;
    if (!deleteAtTemplate(mf, 1)) mf.executeCommand("deleteForward");
    return true;
  }
  if (dir > 0 && (c === b.e || empty)) {
    if (k < n - 1 && t.joins) join(mf, t);
    else if (k < n - 1) toBox(mf, t.boxes[k + 1] as Box, "start");
    else firstOrLast(mf, t, "after");
    return true;
  }
  // the box's only atom: □ shows again
  if (sel || b.e !== b.s + 1 || atomStart(mf, b.e) !== b.s) return false;
  if (dir < 0 ? c !== b.e : c !== b.s) return false;
  mf.selection = { ranges: [[b.s, b.e]] };
  mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  return true;
}

/** True if the key's argument box holds something and every other box is empty. */
function onlyArg(mf: Field, t: BoxTemplate): boolean {
  return t.arg !== undefined && t.boxes.every((b, i) => (i === t.arg) !== boxEmpty(mf, b));
}

/** ⌫ at the start of the first box, or Del at the end of the last (point 4). */
function firstOrLast(mf: Field, t: BoxTemplate, mode: "before" | "after"): void {
  const held = t.boxes.map((b) => !boxEmpty(mf, b));
  if (!held.some(Boolean)) removeBoxes(mf, t);
  else if (t.main !== undefined && held.every((h, i) => h === (i === t.main))) keep(mf, t, t.main, mode);
  else mf.selection = { ranges: [[t.start, t.end]] };
}

/**
 * ⌫ at the start of a fraction's denominator, or Del at the end of its numerator: the fraction goes and its parts
 * stand side by side, the cursor between them (the owner's G2, item 47: 5/23 → 5‸23). An empty part adds nothing;
 * two empty parts remove the fraction (□ again where it filled a box).
 */
function join(mf: Field, t: BoxTemplate): void {
  const [num, den] = t.boxes as [Box, Box];
  const part = (b: Box): string => (boxEmpty(mf, b) ? "" : mf.getValue(b.s, b.e, "latex"));
  const a = part(num);
  const b = part(den);
  if (a === "" && b === "") {
    removeBoxes(mf, t);
    return;
  }
  // a control word that ends the numerator would take a letter that starts the denominator (\pi + x is not \pix)
  const gap = /\\[A-Za-z]+$/.test(a) && /^[A-Za-z]/.test(b) ? " " : "";
  mf.selection = { ranges: [[t.start, t.end]] };
  mf.insert(a + gap + b, { format: "latex", selectionMode: "after" });
  // the numerator's atoms keep their count of offsets, so the cursor goes right after them
  mf.position = t.start + (a === "" ? 0 : num.e - num.s);
}

/** Replace the template by the content of box `k`, the cursor before or after it. */
function keep(mf: Field, t: BoxTemplate, k: number, mode: "before" | "after"): void {
  const b = t.boxes[k] as Box;
  const content = mf.getValue(b.s, b.e, "latex");
  mf.selection = { ranges: [[t.start, t.end]] };
  mf.insert(content, { format: "latex", selectionMode: mode });
}

/** Remove the whole template; a box it filled shows □ again. */
function removeBoxes(mf: Field, t: BoxTemplate): void {
  mf.selection = { ranges: [[t.start, t.end]] };
  if (fillsRange(mf, t.start, t.end)) mf.insert(PLACEHOLDER, { format: "latex", selectionMode: "placeholder" });
  else mf.executeCommand("deleteBackward");
}

// ---- lim, Σ, Π and ∫ (R26f, F19) -----------------------------------------------------------------------------------
// MathLive keeps their bounds as the script branches of one operator atom, before it and one level deeper:
// `\lim_{x\to0}\left(2\right)` is 1 (the script's sentinel), 2 `x`, 3 `\to`, 4 `0`, 5 the operator, 6 (the body), 7 `2`,
// 8 the pair. A branch holds two boxes when a mark splits it (lim's →, the = of Σ and Π). lim, Σ and Π end with their
// bracket body, the main box. ∫'s integrand and variable are on the operator's own level: the integrand runs from the
// operator to its `\,` and d, and the variable is the one atom after the d. Its own delete removes an emptied bound,
// steps out in front of the operator at the start of a bound, and deletes the marks alone. Points 2-5 of "⌫ and Del
// keep a template whole" instead, through deleteAtBoxes, with two positions that are no box (gaps): between lim's (Σ's,
// Π's) scripts and its bracket, and between ∫'s `\,` and d, where ◀ and ▶ stop today (F23, R27b).

/** The lim, Σ, Π or ∫ whose operator atom is at `x`, or undefined (a ∫ that lost its d, a lim without its bracket). */
function bigOp(mf: Field, x: number): BoxTemplate | undefined {
  const l = latexAt(mf, x);
  if (!BIGOP.test(l)) return undefined;
  const d = depthAt(mf, x);
  const start = atomStart(mf, x);
  // the bounds: each branch from its sentinel, split at its first mark
  const froms: number[] = [];
  let marked = false;
  for (let o = start + 1; o < x; o++) {
    if (depthAt(mf, o) !== d + 1) continue;
    const lo = latexAt(mf, o);
    if (lo === "") {
      froms.push(o);
      marked = false;
    } else if (!marked && MARK.test(lo)) {
      froms.push(o);
      marked = true;
    }
  }
  const boxes: Box[] = froms.map((f, i) => ({ from: f, s: f, e: (froms[i + 1] ?? x) - 1 }));
  const gaps = new Map<number, number>();
  if (INT.test(l)) {
    const m = diffOf(mf, x);
    if (m === undefined) return undefined;
    const thin = m - 1 > x && latexAt(mf, m - 1) === THIN ? m - 1 : m;
    boxes.push({ from: x, s: x, e: thin - 1 });
    const main = boxes.length - 1;
    if (thin < m) gaps.set(thin, main);
    // the variable: the one atom after d, with no parts (□ or a letter)
    const v = m + 1;
    const e = v <= mf.lastOffset && depthAt(mf, v) === d && atomStart(mf, v) === m && !BIGOP.test(latexAt(mf, v)) ? v : m;
    boxes.push({ from: m, s: m, e });
    return { start, end: e, boxes, whole: false, main, gaps };
  }
  let p = x + 1;
  while (p <= mf.lastOffset && depthAt(mf, p) > d) p++;
  if (p > mf.lastOffset || !isPair(mf, p) || atomStart(mf, p) !== x) return undefined;
  if (boxes.length > 0) gaps.set(x, boxes.length - 1);
  boxes.push({ from: x + 1, s: x + 1, e: p - 1 });
  return { start, end: p, boxes, whole: false, main: boxes.length - 1, gaps };
}

/** The d of the ∫ at `x`: the first one on its level that no ∫ inside its integrand takes, within its box. */
function diffOf(mf: Field, x: number): number | undefined {
  const d = depthAt(mf, x);
  let open = 0;
  for (let o = x + 1; o <= mf.lastOffset; o++) {
    const od = depthAt(mf, o);
    if (od < d) return undefined;
    if (od > d) continue;
    const l = latexAt(mf, o);
    if (l === "") return undefined; // the next box of the template the ∫ stands in
    if (INT.test(l)) open++;
    else if (l === DIFF) {
      if (open === 0) return o;
      open--;
    }
  }
  return undefined;
}

/** The innermost lim, Σ, Π or ∫ on c's level with a gap at `c` or a box there that holds it (∫'s integrand, variable). */
function onLevel(mf: Field, c: number): { t: BoxTemplate; k: number; gap?: true } | undefined {
  const d = depthAt(mf, c);
  let best: { t: BoxTemplate; k: number; gap?: true } | undefined;
  for (let x = 1; x <= c && x <= mf.lastOffset; x++) {
    if (depthAt(mf, x) !== d || !BIGOP.test(latexAt(mf, x))) continue;
    const t = bigOp(mf, x);
    if (!t) continue;
    const g = t.gaps?.get(c);
    if (g !== undefined) best = { t, k: g, gap: true };
    else {
      const k = t.boxes.findIndex((b) => c >= b.from && c <= b.e);
      if (k >= 0) best = { t, k };
    }
  }
  return best;
}

/** True if `o` is the → of lim or the = of Σ or Π: a mark that starts a box. */
function opMark(mf: Field, o: number): boolean {
  const d = depthAt(mf, o);
  if (d === 0 || !MARK.test(latexAt(mf, o))) return false;
  let q = o + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  return q <= mf.lastOffset && depthAt(mf, q) === d - 1 && BIGOP.test(latexAt(mf, q)) && !INT.test(latexAt(mf, q));
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
  if (!startsBox(mf, a) || b <= a || depthAt(mf, b) !== d) return false;
  if (!endsBox(mf, b)) return false;
  for (let o = a + 1; o < b; o++) if (depthAt(mf, o) < d) return false;
  // (one box only: no mark of lim, Σ, Π or ∫ inside the selection)
  for (let o = a + 1; o <= b; o++) if (depthAt(mf, o) === d && (opMark(mf, o) || isIntMark(mf, o))) return false;
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

/**
 * True if offset `o` is the last of its box: the line ends, the level drops, or the next box of the same template
 * starts (its sentinel, on the same level: a numerator's last atom is followed by the denominator's sentinel; the → of
 * lim, the = of Σ and Π; ∫'s `\,` and d after its integrand).
 */
function endsBox(mf: Field, o: number): boolean {
  if (o >= mf.lastOffset) return true;
  const d = depthAt(mf, o);
  const n = depthAt(mf, o + 1);
  if (n !== d) return n < d;
  return (d > 0 && (latexAt(mf, o + 1) === "" || opMark(mf, o + 1))) || isIntMark(mf, o + 1);
}

/** True if `o` is ∫'s `\,` or d (only ∫ inserts them). */
function isIntMark(mf: Field, o: number): boolean {
  const l = latexAt(mf, o);
  return l === DIFF || (l === THIN && latexAt(mf, o + 1) === DIFF);
}

/** True if the range from position `start` to offset `end` is all of a box: a template there leaves □ behind. */
function fillsRange(mf: Field, start: number, end: number): boolean {
  return depthAt(mf, start) === depthAt(mf, end) && startsBox(mf, start) && endsBox(mf, end);
}
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

/** True if the template is all of a box (a fraction's part, an outer body, ∫'s integrand): it leaves □ behind. */
function fillsBox(mf: Field, t: Template): boolean {
  return fillsRange(mf, t.start, t.end);
}
