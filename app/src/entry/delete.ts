// SPDX-License-Identifier: GPL-3.0-or-later
// ⌫ and Del at a template (R23, bug F10; decisions.md "⌫ at a bracket" and "⌫ and Del keep a template whole").
// MathLive's own delete at the start of a `\left…\right` body turns the opening bracket into `\left.` and is stuck
// there; this module takes those presses first. Public MathLive API only: offsets, `getElementInfo`, `selection`,
// `getValue`, `insert`. Plain TS; R26b–R26h extend it to every other template.
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
  /^\\(?:operatorname\{[^{}]*\}|(?:arc)?(?:sin|cos|tan|cot|sec|csc)h?|ln|log|lg|exp|lim|sum|prod|det|gcd|lcm|max|min|arg|Re|Im)(?![A-Za-z])/;
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
  const c = cursor(mf, dir);
  if (c === undefined) return false;
  const t = dir < 0 ? fromStart(mf, c) : fromEnd(mf, c);
  if (!t) return false;
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
