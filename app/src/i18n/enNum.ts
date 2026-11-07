// SPDX-License-Identifier: GPL-3.0-or-later
// R99: why the Num entry of Solve and Function refused a value, and the words the apps' views draw (moved out of en.ts by R145f1). A table of its own, loaded with the apps' chunks, so the
// start chunk does not carry it (R91's pin, docs/04 section 8.3). English only so far.
export const enNum = {
  "num.notNumber": "Not a number",
  "num.zeroStep": "The step cannot be 0",
  "solve.empty": "Enter an equation in Symb (e.g. X²+Y²=4) to see its unknowns here.",
  "solve.warnTitle": "Substituting the answer back leaves a large residual: check it.",
  "symb.label": "Definitions",
  "symb.toggle": "Show or hide",
  "num.empty": "Switch on a function in Symb to see its table.",
  "plot.empty": "Define a function in Symb to draw it.",
  "plot.loading": "Loading the graph…",
  "plot.label": "Graph",
} as const;

export type NumKey = keyof typeof enNum;

export const numText = (key: NumKey): string => enNum[key];
