// SPDX-License-Identifier: GPL-3.0-or-later
// Prototype keyboard layout: 5 columns x 7 rows, one shift layer.
// Positions are OUR prototype choice; matching any real calculator's logical layout stays `assumed`
// until the owner checks spike/G2-CHECKLIST.md.

export type Action =
  /** Type characters as if from a physical keyboard (smart fences, auto-subscript rules apply). */
  | { kind: "type"; text: string }
  /** Insert a LaTeX template; #? marks a placeholder, #@ the selection or previous argument. */
  | { kind: "insert"; latex: string }
  /** A MathLive editing command (cursor moves, delete...). */
  | { kind: "cmd"; name: string }
  | { kind: "shift" }
  | { kind: "enter" }
  | { kind: "clear" };

export interface Key {
  id: string;
  label: string;
  action: Action;
  shiftLabel?: string;
  shiftAction?: Action;
  /** Visual class: "num", "op", "fn", "ctl", "enter". */
  cls: "num" | "op" | "fn" | "ctl" | "enter";
}

const fn = (id: string, label: string, name: string, shiftLabel: string, shiftName: string): Key => ({
  id,
  label,
  cls: "fn",
  action: { kind: "insert", latex: `\\${name}\\left(#?\\right)` },
  shiftLabel,
  shiftAction: { kind: "insert", latex: `\\${shiftName}\\left(#?\\right)` },
});
const num = (c: string): Key => ({ id: `d${c}`, label: c, cls: "num", action: { kind: "type", text: c } });
const op = (id: string, label: string, text: string): Key => ({ id, label, cls: "op", action: { kind: "type", text } });
const cmd = (id: string, label: string, name: string, shiftLabel?: string, shiftName?: string): Key => {
  const k: Key = { id, label, cls: "ctl", action: { kind: "cmd", name } };
  if (shiftLabel && shiftName) {
    k.shiftLabel = shiftLabel;
    k.shiftAction = { kind: "cmd", name: shiftName };
  }
  return k;
};

export const ROWS: Key[][] = [
  [
    { id: "shift", label: "shift", cls: "ctl", action: { kind: "shift" } },
    cmd("left", "◀", "moveToPreviousChar", "|◀", "moveToMathfieldStart"),
    cmd("right", "▶", "moveToNextChar", "▶|", "moveToMathfieldEnd"),
    cmd("up", "▲", "moveUp"),
    cmd("down", "▼", "moveDown"),
  ],
  [
    fn("sin", "sin", "sin", "sin⁻¹", "arcsin"),
    fn("cos", "cos", "cos", "cos⁻¹", "arccos"),
    fn("tan", "tan", "tan", "tan⁻¹", "arctan"),
    {
      id: "lpar",
      label: "(",
      cls: "op",
      action: { kind: "type", text: "(" },
      shiftLabel: ",",
      shiftAction: { kind: "type", text: "," },
    },
    {
      id: "rpar",
      label: ")",
      cls: "op",
      action: { kind: "type", text: ")" },
      shiftLabel: "|x|",
      shiftAction: { kind: "insert", latex: "\\left|#?\\right|" },
    },
  ],
  [
    {
      id: "pow",
      label: "xʸ",
      cls: "fn",
      action: { kind: "insert", latex: "#@^{#?}" },
      shiftLabel: "x²",
      shiftAction: { kind: "insert", latex: "#@^{2}" },
    },
    {
      id: "sqrt",
      label: "√",
      cls: "fn",
      action: { kind: "insert", latex: "\\sqrt{#0}" },
      shiftLabel: "ⁿ√",
      shiftAction: { kind: "insert", latex: "\\sqrt[#?]{#0}" },
    },
    {
      id: "frac",
      label: "a/b",
      cls: "fn",
      action: { kind: "insert", latex: "\\frac{#@}{#?}" },
      shiftLabel: "1/x",
      shiftAction: { kind: "insert", latex: "\\frac{1}{#@}" },
    },
    {
      id: "pi",
      label: "π",
      cls: "fn",
      action: { kind: "insert", latex: "\\pi" },
      shiftLabel: "e",
      shiftAction: { kind: "insert", latex: "\\exponentialE" },
    },
    cmd("bksp", "⌫", "deleteBackward", "AC", "deleteAll"),
  ],
  [
    num("7"),
    num("8"),
    num("9"),
    { id: "div", label: "÷", cls: "op", action: { kind: "insert", latex: "\\div" } },
    {
      id: "ln",
      label: "ln",
      cls: "fn",
      action: { kind: "insert", latex: "\\ln\\left(#?\\right)" },
      shiftLabel: "eˣ",
      shiftAction: { kind: "insert", latex: "\\exponentialE^{#?}" },
    },
  ],
  [
    num("4"),
    num("5"),
    num("6"),
    { id: "mul", label: "×", cls: "op", action: { kind: "insert", latex: "\\times" } },
    {
      id: "log",
      label: "log",
      cls: "fn",
      action: { kind: "insert", latex: "\\log\\left(#?\\right)" },
      shiftLabel: "10ˣ",
      shiftAction: { kind: "insert", latex: "10^{#?}" },
    },
  ],
  [
    num("1"),
    num("2"),
    num("3"),
    op("sub", "−", "-"),
    {
      id: "i",
      label: "i",
      cls: "fn",
      action: { kind: "insert", latex: "\\imaginaryI" },
      shiftLabel: "∞",
      shiftAction: { kind: "insert", latex: "\\infty" },
    },
  ],
  [
    num("0"),
    op("dot", ".", "."),
    {
      id: "x",
      label: "x",
      cls: "fn",
      action: { kind: "type", text: "x" },
      shiftLabel: "y",
      shiftAction: { kind: "type", text: "y" },
    },
    op("add", "+", "+"),
    { id: "enter", label: "Enter", cls: "enter", action: { kind: "enter" }, shiftLabel: "=", shiftAction: { kind: "type", text: "=" } },
  ],
];
