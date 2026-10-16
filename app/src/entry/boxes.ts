// SPDX-License-Identifier: GPL-3.0-or-later
// The box model (docs/04 5.5, one box model; R43 moved it here from delete.ts): which atoms make a template, its boxes
// as offsets, and where a box starts and ends. ⌫ and Del (delete.ts), the cursor's stops and ▶ (stops.ts) read "a box"
// from here, so it is written once. Each section notes how MathLive keeps a template and what its own delete does with
// it; delete.ts does points 2-5 of "⌫ and Del keep a template whole" instead. Loaded with MathLive, outside the start
// chunk. Public MathLive API only: offsets and `getElementInfo`. Plain TS.
//
// How MathLive numbers a line: offset o is the cursor position after atom o. An atom's parts (a pair's body, a
// script's branches) come before the atom itself, one level deeper, and each branch starts with an empty sentinel.
// So in `5\sin\left(23\right)` the offsets are 0 (line start), 1 `5`, 2 `\sin`, 3 (body start), 4 `2`, 5 `3`,
// 6 the pair.
import type { MathfieldElement } from "mathlive";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset">;

export const PLACEHOLDER = "\\placeholder{}";
/** A function name a key inserts together with its pair: the name goes with the brackets. */
export const NAME =
  /^\\(?:operatorname\{(?:\\mathrm\{[^{}]*\}|[^{}]*)\}|(?:arc)?(?:sin|cos|tan|cot|sec|csc)h?|ln|log|lg|exp|lim|sum|prod|det|gcd|lcm|max|min|arg|Re|Im)(?![A-Za-z])/;
/** A name whose parts are letters, not boxes. */
export const LETTERS = /^\\(?:operatorname|mathrm)\{/;
/** The marks between a template's boxes (evaluate-at, lim, Σ, Π): part of the template, never content. */
export const MARK = /^(?:=|\\to)$/;
/** lim, Σ, Π and ∫: an operator whose bounds are its scripts (R26f). */
const BIGOP = /^\\(?:lim|sum|prod|int)(?![A-Za-z])/;
const INT = /^\\int(?![A-Za-z])/;
/** ∫'s marks before its variable: a thin space and an upright d. */
export const THIN = "\\,";
export const DIFF = "\\mathrm{d}";
/** A matrix, a vector or piecewise: a table whose cells are its boxes (R26g). */
const ARRAY = /^\\begin\{(?:[pbvBV]?matrix|cases)\}/;
/** Piecewise's mark at the start of each condition cell: the letters of `\text{if }`. */
const IF_MARK = ["\\text{i}", "\\text{f}", "\\text{ }"];
/** A log with a base: the name's subscript is the base box (R26h). */
export const LOG_BASE = /^\\(?:log|ln)_/;
/** EQ's name: a comma splits its bracket into two boxes (R26h). */
const EQ_NAME = /^\\operatorname\{(?:\\mathrm\{EQ\}|EQ)\}$/;
/** DMS's marks: degrees ° minutes ′ seconds ″ (R26h). */
const DEG = "\\degree";
const MIN = "\\prime";
const SEC = "\\doubleprime";
/** What stands before a ° without being its degrees: a box's start, an operator, a relation, another mark. */
const NOT_DEGREES = /^(?:|[+\-=,<>:]|\\(?:times|div|cdot|pm|mp|le|ge|ne|leq|geq|neq|to|degree|prime|doubleprime))$/;

/** A digit or a decimal point: part of a number. */
export const isNumberPart = (l: string): boolean => /^[\d.]$/.test(l);

// ---- fractions and roots (R26e, F18) -------------------------------------------------------------------------------
// MathLive keeps a fraction or a root as one atom whose boxes (branches) come before it, one level deeper, each from
// its empty sentinel: `5\frac{2}{3}` is 1 `5`, 2 (numerator), 3 `2`, 4 (denominator), 5 `3`, 6 the fraction; an index
// comes before the radicand. Its own delete removes an emptied box (`\sqrt[3]{8}` minus the 3 is `\sqrt8`), joins
// the parts at the start of a denominator, leaves a root at the start of its index, and deletes ∂ marks alone.
// Points 2-5 of "⌫ and Del keep a template whole" instead, for ÷ and a b/c, √, ⁿ√, ∂ (its ∂ marks start its boxes)
// and the mixed number (its whole part, the digits or □ right before `\tfrac`, is its first box).

/**
 * One box, as positions: `from` its sentinel (or the mark or atom it starts after: lim's →, the = of Σ and Π, ∫'s
 * operator and d), `s` where its content starts (after a ∂ mark or piecewise's `if`), `e` its last offset.
 */
export interface Box {
  from: number;
  s: number;
  e: number;
}

/** A fraction, a root, lim, Σ, Π, ∫ or a table with its boxes, as offsets. */
export interface BoxTemplate {
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
  /**
   * ∫: its last box, the variable, ends on the line with nothing to close it. Del at its end with more on the line
   * after it acts on what follows, as after any template; at the end of the line it is the end of the last box.
   */
  open?: boolean;
}

const DIGIT = /^\d$/;

/**
 * The fraction, root, lim, Σ, Π, ∫, table, log base, EQ, DMS or evaluate-at whose atom is at `q` (for lim, Σ, Π, the
 * log base, EQ and evaluate-at, also their bracket's; for EQ its name's; for evaluate-at its subscript's; for DMS its
 * ″), or undefined.
 */
export function boxTemplate(mf: Field, q: number): BoxTemplate | undefined {
  if (q < 1 || q > mf.lastOffset) return undefined;
  const l = latexAt(mf, q);
  if (BIGOP.test(l)) return bigOp(mf, q);
  if (ARRAY.test(l)) return table(mf, q);
  if (LOG_BASE.test(l)) return logBase(mf, q);
  if (l === SEC) return dmsEndingAt(mf, q);
  if (EQ_NAME.test(l)) {
    const p = pairAfter(mf, q);
    return p === undefined ? undefined : equation(mf, q, p);
  }
  if (l.startsWith("_")) {
    const p = atomStart(mf, q);
    return p > 0 && isEvalPair(mf, p) ? evalAt(mf, p) : undefined;
  }
  if (isPair(mf, q)) {
    if (isEvalPair(mf, q)) return evalAt(mf, q);
    const x = atomStart(mf, q);
    if (x < 1 || depthAt(mf, x) !== depthAt(mf, q)) return undefined;
    const xl = latexAt(mf, x);
    const t = LOG_BASE.test(xl) ? logBase(mf, x) : EQ_NAME.test(xl) ? equation(mf, x, q) : bigOp(mf, x);
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
export function ownerOf(mf: Field, o: number): BoxTemplate | undefined {
  const d = depthAt(mf, o);
  if (d === 0 || latexAt(mf, o) !== "") return undefined;
  let q = o + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  const t = boxTemplate(mf, q);
  return t?.boxes.some((b) => b.from === o) ? t : undefined;
}

/**
 * The template with a box that holds position `c` (the innermost), and that box's index; `gap` when `c` is one of the
 * template's positions that are no box (`k` is then the box before it). `onLine`: a collapsed ⌫, for which the start of
 * DMS's typed degrees is a place on the line, not in the template (its first box has no left edge; as a mixed number's
 * whole part).
 */
export function locate(mf: Field, c: number, onLine: boolean): { t: BoxTemplate; k: number; gap?: true } | undefined {
  const d = depthAt(mf, c);
  // a mixed number's whole part, on the template's own level: the digits or □ after c, then the fraction
  let o = c + 1;
  while (o <= mf.lastOffset && depthAt(mf, o) === d && (DIGIT.test(latexAt(mf, o)) || latexAt(mf, o) === PLACEHOLDER)) o++;
  const m = o <= mf.lastOffset && depthAt(mf, o) === d + 1 ? ownerOf(mf, o) : undefined;
  const w = m?.whole ? m.boxes[0] : undefined;
  if (m && w && c >= w.from && c <= w.e) return { t: m, k: 0 };
  // a gap of lim, Σ, Π or evaluate-at, ∫'s integrand or variable, a box of DMS: on c's own level
  const op = onLevel(mf, c, onLine);
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
 * True if position `o` starts a box: its sentinel, the ∂ mark that opens a box of ∂, the → or = of lim, Σ, Π and
 * evaluate-at, EQ's comma, ∫'s operator and d (its integrand and its variable start right after them, on the line
 * itself), DMS's ° and ′. DMS's degrees have no mark at their start: isDegrees.
 */
export function startsBox(mf: Field, o: number): boolean {
  const d = depthAt(mf, o);
  const l = latexAt(mf, o);
  if (d > 0 && (l === "" || boxMark(mf, o))) return true;
  if (d > 0 && l === "\\partial" && latexAt(mf, o - 1) === "" && depthAt(mf, o - 1) === d) return true;
  if (d > 0 && ifMarkEnd(mf, o)) return true;
  // DMS: its ° and ′ start the minutes and the seconds (its degrees: isDegrees)
  if ((l === DEG || l === MIN) && dmsMark(mf, o)) return true;
  return INT.test(l) || l === DIFF;
}

export const boxEmpty = (mf: Field, b: Box): boolean => b.e === b.s || (b.e === b.s + 1 && latexAt(mf, b.e) === PLACEHOLDER);

// ---- matrices, vectors and piecewise (R26g, F20) ----------------------------------------------------------------------
// MathLive keeps a table as one atom whose cells are its branches, before it and one level deeper, in reading order
// (row by row), each from its empty sentinel: `5\begin{pmatrix}2 & □\\ □ & □\end{pmatrix}` is 1 `5`, 2 (cell 1), 3 `2`,
// 4 (cell 2), 5 □, 6 (cell 3), 7 □, 8 (cell 4), 9 □, 10 the table. Piecewise's condition cells start with the three
// letters of `\text{if }`, the template's mark. Its own delete removes the □ of an emptied cell (a cell with nothing in
// it, then stuck), does nothing at the start of a cell (only a multiline array's row goes, through `deleteRow`), and
// deletes a filled table whole from right after it. Points 2-5 of "⌫ and Del keep a template whole" instead, through
// deleteAtBoxes: every cell is a box, none is the main one (a filled table is selected first), and no row is removed:
// the table keeps the shape its key gave it (the brief's default; G2 item 51 to confirm).

/** The table whose atom is at `q`: one box per cell, a condition's from after its `if` mark. */
function table(mf: Field, q: number): BoxTemplate | undefined {
  const d = depthAt(mf, q);
  const a = atomStart(mf, q);
  const sentinels: number[] = [];
  for (let o = a + 1; o < q; o++) if (depthAt(mf, o) === d + 1 && latexAt(mf, o) === "") sentinels.push(o);
  if (sentinels.length === 0) return undefined;
  const boxes = sentinels.map((f, i) => {
    const e = (sentinels[i + 1] ?? q) - 1;
    const s = f + IF_MARK.length <= e && ifMarkEnd(mf, f + IF_MARK.length) ? f + IF_MARK.length : f;
    return { from: f, s, e };
  });
  return { start: a, end: q, boxes, whole: false };
}

/** True if `o` is the last letter of piecewise's `if` mark, right after a cell's sentinel. */
function ifMarkEnd(mf: Field, o: number): boolean {
  const n = IF_MARK.length;
  const d = depthAt(mf, o);
  if (o - n < 0 || latexAt(mf, o - n) !== "" || depthAt(mf, o - n) !== d) return false;
  return IF_MARK.every((m, i) => latexAt(mf, o - n + 1 + i) === m && depthAt(mf, o - n + 1 + i) === d);
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
    return { start, end: e, boxes, whole: false, main, gaps, open: true };
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

/**
 * The innermost template on c's level with a gap at `c` or a box there that holds it: lim, Σ, Π or ∫ (∫'s integrand and
 * variable), evaluate-at (its gap between the bar and the bounds), DMS (all its boxes; see locate for `onLine`).
 */
function onLevel(mf: Field, c: number, onLine: boolean): { t: BoxTemplate; k: number; gap?: true } | undefined {
  const d = depthAt(mf, c);
  let best: { t: BoxTemplate; k: number; gap?: true } | undefined;
  const consider = (t: BoxTemplate | undefined): void => {
    if (!t || (best && best.t.end - best.t.start <= t.end - t.start)) return;
    const g = t.gaps?.get(c);
    if (g !== undefined) best = { t, k: g, gap: true };
    else {
      const k = t.boxes.findIndex((b) => c >= b.from && c <= b.e);
      const first = t.boxes[0] as Box;
      if (k < 0 || (k === 0 && onLine && t.whole && c === first.s && !boxEmpty(mf, first))) return;
      best = { t, k };
    }
  };
  for (let x = 1; x <= mf.lastOffset; x++) {
    if (depthAt(mf, x) !== d) continue;
    const l = latexAt(mf, x);
    if (x <= c && BIGOP.test(l)) consider(bigOp(mf, x));
    else if (x === c && isEvalPair(mf, x)) consider(evalAt(mf, x));
    else if (l === DEG) consider(dmsAt(mf, x));
  }
  return best;
}

// ---- log base, EQ and evaluate-at (R26h, F21) ------------------------------------------------------------------------
// A log base is the subscript of the `\log_{…}` name, before it and one level deeper: `\log_{16}\left(□\right)` is
// 1 (the base's sentinel), 2 `1`, 3 `6`, 4 the name, 5 (the bracket's body), 6 □, 7 the pair; the bracket holds the
// main box (#0). EQ's bracket holds two boxes split by its first comma, a mark. Evaluate-at is a pair `\left.…\right|`
// (its body the main box) and a subscript atom right after it whose = splits it into the variable and the value:
// `\left.2\right|_{x=3}` is 1 (body), 2 `2`, 3 the pair, 4 (subscript), 5 `x`, 6 `=`, 7 `3`, 8 the subscript; position 3,
// between the bar and the subscript, is no box (a gap). MathLive's own delete removes the whole log on any ⌫ in its
// base, deletes the comma and the = as plain atoms and the □ as an atom (`EQ(,□)`, `_{x=}`), and leaves the subscript
// without its bar. Points 2-5 of "⌫ and Del keep a template whole" instead, through deleteAtBoxes.

/** The log with a base whose name atom is at `x`: the base, then the bracket's body (the main box). */
function logBase(mf: Field, x: number): BoxTemplate | undefined {
  const d = depthAt(mf, x);
  const start = atomStart(mf, x);
  if (start + 1 >= x || depthAt(mf, start + 1) !== d + 1) return undefined;
  const q = pairAfter(mf, x);
  if (q === undefined) return undefined;
  const boxes = [
    { from: start + 1, s: start + 1, e: x - 1 },
    { from: x + 1, s: x + 1, e: q - 1 },
  ];
  return { start, end: q, boxes, whole: false, main: 1 };
}

/** EQ with its name at `x` and its pair at `q`: two boxes, split by the first comma of the body. */
function equation(mf: Field, x: number, q: number): BoxTemplate | undefined {
  const d = depthAt(mf, q);
  if (atomStart(mf, q) !== x) return undefined;
  const body = x + 1;
  let comma = -1;
  for (let o = body + 1; o < q; o++) {
    if (depthAt(mf, o) === d + 1 && latexAt(mf, o) === ",") {
      comma = o;
      break;
    }
  }
  if (comma < 0) return undefined;
  const boxes = [
    { from: body, s: body, e: comma - 1 },
    { from: comma, s: comma, e: q - 1 },
  ];
  return { start: atomStart(mf, x), end: q, boxes, whole: false, main: 0 };
}

const isEvalPair = (mf: Field, o: number): boolean => {
  const l = latexAt(mf, o);
  return l.startsWith("\\left.") && l.endsWith("\\right|");
};

/** Evaluate-at with its pair at `p`: the body, then the variable and the value of the subscript after it. */
function evalAt(mf: Field, p: number): BoxTemplate | undefined {
  const d = depthAt(mf, p);
  let s = p + 1;
  while (s <= mf.lastOffset && depthAt(mf, s) > d) s++;
  if (s === p + 1 || s > mf.lastOffset || depthAt(mf, s) !== d || !latexAt(mf, s).startsWith("_")) return undefined;
  if (atomStart(mf, s) !== p) return undefined;
  let eq = -1;
  for (let o = p + 2; o < s; o++) {
    if (depthAt(mf, o) === d + 1 && latexAt(mf, o) === "=") {
      eq = o;
      break;
    }
  }
  if (eq < 0) return undefined;
  const a = atomStart(mf, p);
  const boxes = [
    { from: a + 1, s: a + 1, e: p - 1 },
    { from: p + 1, s: p + 1, e: eq - 1 },
    { from: eq, s: eq, e: s - 1 },
  ];
  return { start: a, end: s, boxes, whole: false, main: 0, gaps: new Map([[p, 0]]) };
}

/** The pair right after the atom at `x` (on its level), or undefined. */
function pairAfter(mf: Field, x: number): number | undefined {
  const d = depthAt(mf, x);
  let q = x + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) > d) q++;
  return q <= mf.lastOffset && depthAt(mf, q) === d && isPair(mf, q) && atomStart(mf, q) === x ? q : undefined;
}

/** The atom right after position `c` on its level (its parts skipped), or 0 when there is none. */
export function atomAfter(mf: Field, c: number): number {
  const d = depthAt(mf, c);
  let p = c + 1;
  while (p <= mf.lastOffset && depthAt(mf, p) > d) p++;
  return p <= mf.lastOffset && depthAt(mf, p) === d && atomStart(mf, p) === c ? p : 0;
}

// ---- DMS (R26h, F21) ------------------------------------------------------------------------------------------------
// DMS stands on the line itself, its marks plain atoms: `23\degree4\prime6\doubleprime` is 1 `2`, 2 `3`, 3 °, 4 `4`,
// 5 ′, 6 `6`, 7 ″. The minutes and the seconds lie between the marks. The degrees have no left edge: they are the
// number (or □) right before the °. The key takes a number typed before it as its degrees (`#@`, R27a: `5 DMS 2` is
// 5°2′), the box a #@ key took, as a mixed number's whole part.
// A DMS inserted on another's □ fills that box: `□°□′□″°□′□″` is a DMS whose degrees are a DMS. MathLive's own delete
// takes each mark and each □ as an atom (`°□′□″` on an empty line). Points 2-5 of "⌫ and Del keep a template whole"
// instead, through deleteAtBoxes: no box is the main one (as a table), and the start of typed degrees is a place on
// the line, not in the template (as a mixed number's whole part): ⌫ there deletes what stands before.

/** The DMS whose ° is at `x`: ° box ′ box ″ on one level, its degrees before the °; undefined for a lone mark. */
function dmsAt(mf: Field, x: number): BoxTemplate | undefined {
  if (latexAt(mf, x) !== DEG) return undefined;
  const d = depthAt(mf, x);
  let m = -1;
  for (let o = x + 1; o <= mf.lastOffset; o++) {
    const od = depthAt(mf, o);
    if (od < d) return undefined;
    if (od > d) continue;
    const l = latexAt(mf, o);
    if (l === "") return undefined; // the next box of the template the DMS stands in
    if (l === DEG) {
      const inner = dmsAt(mf, o); // a DMS in the minutes or the seconds
      if (inner) o = inner.end;
    } else if (l === MIN) {
      if (m >= 0) return undefined;
      m = o;
    } else if (l === SEC) {
      if (m < 0) return undefined;
      const first = degreesOf(mf, x);
      const boxes = [first, { from: x, s: x, e: m - 1 }, { from: m, s: m, e: o - 1 }];
      // the degrees are the key's argument (#@, R27a): when only they hold something, ⌫ in another box keeps them
      return { start: first.s, end: o, boxes, whole: true, arg: 0 };
    }
  }
  return undefined;
}

/** The degrees box of the ° at `x`: a □, the digits before it, a whole DMS, or one other atom; empty after an operator. */
function degreesOf(mf: Field, x: number): Box {
  const b = x - 1;
  const l = latexAt(mf, b);
  const inner = l === SEC ? dmsEndingAt(mf, b) : undefined;
  if (inner) return { from: inner.start, s: inner.start, e: b };
  if (b < 1 || NOT_DEGREES.test(l)) return { from: b, s: b, e: b };
  if (l === PLACEHOLDER) return { from: b - 1, s: b - 1, e: b };
  const d = depthAt(mf, x);
  if (isNumberPart(l)) {
    let i = b;
    while (i > 1 && depthAt(mf, i - 1) === d && isNumberPart(latexAt(mf, i - 1))) i--;
    return { from: i - 1, s: i - 1, e: b };
  }
  const s = atomStart(mf, b);
  return { from: s, s, e: b };
}

/** The DMS whose ″ is at `q`. */
function dmsEndingAt(mf: Field, q: number): BoxTemplate | undefined {
  if (latexAt(mf, q) !== SEC) return undefined;
  const d = depthAt(mf, q);
  for (let y = q - 1; y > 0; y--) {
    const yd = depthAt(mf, y);
    if (yd < d) break;
    if (yd > d) continue;
    const l = latexAt(mf, y);
    if (l === "") break;
    if (l === DEG) {
      const t = dmsAt(mf, y);
      if (t?.end === q) return t;
    }
  }
  return undefined;
}

/** The DMS whose ° ′ or ″ is at `o`, or undefined (a lone mark, typed by its own key). */
export function dmsMark(mf: Field, o: number): BoxTemplate | undefined {
  const l = latexAt(mf, o);
  if (l === DEG) return dmsAt(mf, o);
  if (l !== MIN && l !== SEC) return undefined;
  const d = depthAt(mf, o);
  for (let y = o - 1; y > 0; y--) {
    const yd = depthAt(mf, y);
    if (yd < d) break;
    if (yd > d) continue;
    const yl = latexAt(mf, y);
    if (yl === "") break;
    if (yl === DEG) {
      const t = dmsAt(mf, y);
      if (t && (t.end === o || t.boxes[2]?.from === o)) return t;
    }
  }
  return undefined;
}

/** True if the range from position `s` to offset `e` is all of a DMS's degrees (its ° right after `e`). */
export function isDegrees(mf: Field, s: number, e: number): boolean {
  return e < mf.lastOffset && depthAt(mf, e + 1) === depthAt(mf, s) && dmsAt(mf, e + 1)?.start === s;
}

/** True if `o` is a mark that starts a box below the line: lim's →, the = of Σ, Π and evaluate-at, EQ's comma. */
export function boxMark(mf: Field, o: number): boolean {
  const d = depthAt(mf, o);
  const l = latexAt(mf, o);
  if (d === 0 || !(MARK.test(l) || l === ",")) return false;
  let q = o + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  if (q > mf.lastOffset || depthAt(mf, q) !== d - 1) return false;
  return boxTemplate(mf, q)?.boxes.some((b) => b.from === o) ?? false;
}

export const depthAt = (mf: Field, o: number): number => mf.getElementInfo(o)?.depth ?? 0;

/**
 * True if offset `o` is the last of its box: the line ends, the level drops, or the next box of the same template
 * starts (its sentinel, on the same level: a numerator's last atom is followed by the denominator's sentinel; the → of
 * lim, the = of Σ, Π and evaluate-at, EQ's comma; ∫'s `\,` and d after its integrand; a mark of DMS).
 */
export function endsBox(mf: Field, o: number): boolean {
  if (o >= mf.lastOffset) return true;
  const d = depthAt(mf, o);
  const n = depthAt(mf, o + 1);
  if (n !== d) return n < d;
  return (d > 0 && (latexAt(mf, o + 1) === "" || boxMark(mf, o + 1))) || isIntMark(mf, o + 1) || dmsMark(mf, o + 1) !== undefined;
}

/** True if `o` is ∫'s `\,` or d (only ∫ inserts them). */
export function isIntMark(mf: Field, o: number): boolean {
  const l = latexAt(mf, o);
  return l === DIFF || (l === THIN && latexAt(mf, o + 1) === DIFF);
}

/** True if the range from position `start` to offset `end` is all of a box: a template there leaves □ behind. */
export function fillsRange(mf: Field, start: number, end: number): boolean {
  if (depthAt(mf, start) !== depthAt(mf, end)) return false;
  return (startsBox(mf, start) && endsBox(mf, end)) || isDegrees(mf, start, end);
}
export const latexAt = (mf: Field, o: number): string => mf.getElementInfo(o)?.latex ?? "";

/** The position before atom `o` (its parts skipped). */
export function atomStart(mf: Field, o: number): number {
  const d = depthAt(mf, o);
  let s = o - 1;
  while (s > 0 && depthAt(mf, s) > d) s--;
  return s;
}

export const isPair = (mf: Field, o: number): boolean => latexAt(mf, o).startsWith("\\left");
