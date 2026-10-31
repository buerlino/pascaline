// SPDX-License-Identifier: GPL-3.0-or-later
// R4a: Find's words (its title, the categories of the empty query, the marks and the preview). A table of its own,
// loaded with Find's chunk (find/finder.ts), so the start chunk does not carry it. English only so far.
export const enFind = {
  "title": "Find",
  "cat.arith": "Arithmetic",
  "cat.powers": "Powers and logarithms",
  "cat.trig": "Trigonometry",
  "cat.calculus": "Calculus",
  "cat.algebra": "Algebra and solving",
  "cat.matrix": "Matrices and vectors",
  "cat.stats": "Probability and statistics",
  "cat.eng": "Engineering",
  "cat.const": "Constants",
  "cat.units": "Units and prefixes",
  "vars.title": "Vars",
  "memory.title": "Memory",
  "memory.clear": "Clear all",
  "memory.sure": "Enter again clears {n}",
  "memory.fn": "function",
  "slot.title": "Your key",
  "keys.title": "Your keys",
  "keys.none": "None set",
  "keys.some": "{n} set",
  "keys.empty": "Empty",
  "keys.find": "Find…",
  "keys.menu": "Menu",
  "keys.emptyDo": "Empty this slot",
  "keys.reset": "Reset all your keys",
  "keys.unitCells": "Unit pad cells",
  "keys.default": "Back to the default",
  "keys.resetCells": "Reset the unit pad cells",
  "convertsOnly": "converts only",
  "noFactor": "no exact factor",
  "notChecked": "not checked",
  "exact": "exact",
  "factor": "× {si} SI",
} as const;

export type FindMessageKey = keyof typeof enFind;

/** A Find message; `{name}` placeholders are filled from `vars`. */
export function findText(key: FindMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enFind[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
