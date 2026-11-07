// SPDX-License-Identifier: GPL-3.0-or-later
// R143 (owner, 2026-11-06): a legend whose layer opens a menu or grid instead of typing carries a mark (▾), so the big
// buttons the G2's layout spreads over the keypad can be told from the typing ones. The keys stay in their cells; the
// flag comes from the action, never from the legend's text, so a user key (Find's choice) follows what it holds.
import type { ActionBody, Special } from "./keyboard.ts";

/** The specials that open a sheet (a list or a grid): Vars, Math, Shift + Math, Tmpl, Shift + 6, Shift + 9, Shift + Fmt,
 *  Shift + Help, and what a user key may hold: the Apps sheet and the view's or the picked row's menu. */
export const OPENS_SHEET: ReadonlySet<Special> = new Set<Special>([
  "vars", "find", "memory", "tmpl", "relations", "symbols", "mode", "settings", "apps", "menu",
]);

/** Every other special: it does something else (a modifier, an edit, a place, a view, the unit view, nothing). A new
 *  special must be added to one of the two sets (keyboard.test.ts checks that together they are exactly `SPECIALS`). */
export const OPENS_NOTHING: ReadonlySet<Special> = new Set<Special>([
  "shift", "alpha", "enter", "clear", "esc", "fmt", "copy", "paste", "symb", "plot", "num", "home", "cas", "switch", "units", "none",
]);

/** True if the action opens a sheet; false for typing, a template, an editing command and every other special. */
export const opensSheet = (a: ActionBody | undefined): boolean => a?.kind === "special" && OPENS_SHEET.has(a.name);
