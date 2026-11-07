// SPDX-License-Identifier: GPL-3.0-or-later
// R142 (ISO 80000-2): a variable is set in italic, a function, a unit, a number or a constant upright. A legend on the
// keypad is a variable exactly when its action types one letter: the Alpha letters, the Greek letters a key layer types,
// x and y on the x key. The flag comes from the action, never from the legend's text (a user key's legend follows the
// action it holds), and no mode changes it.
import type { ActionBody, Key } from "./keyboard.ts";

const LETTER = /^\p{L}$/u;

/** True if the action types one letter, so the legend that shows it is a variable (italic). */
export const typesVariable = (a: ActionBody | undefined): boolean => a?.kind === "type" && LETTER.test(a.text);

/** A key's `data-v` attribute: which layers type a letter, as p (tap), s (Shift), a (Alpha, which falls back to the tap).
 *  The keypad's CSS picks the face or legend that shows that layer. Absent when none does. */
export const varLayers = (k: Key): string | undefined => {
  const { primary: p, shift: s, alpha: a = p } = k.actions;
  return (typesVariable(p) ? "p" : "") + (typesVariable(s) ? "s" : "") + (typesVariable(a) ? "a" : "") || undefined;
};
