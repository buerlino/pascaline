// SPDX-License-Identifier: GPL-3.0-or-later
// R143 (owner, 2026-11-06): a legend whose layer opens a menu or grid instead of typing carries a mark (▾), so the big
// buttons the G2's layout spreads over the keypad can be told from the typing ones. The keys stay in their cells; the
// flag comes from the action, never from the legend's text, so a user key (Find's choice) follows what it holds.
import { OPENS_SHEET, type ActionBody } from "./keyboard.ts";

/** True if the action opens a sheet (OPENS_SHEET: Vars, Math, Shift + Math, Tmpl, Shift + 6, Shift + 9, Shift + Fmt, Shift +
 *  Help, and what a user key may hold: the Apps sheet and the view's or the picked row's menu); false for typing, a
 *  template, an editing command and every other special. */
export const opensSheet = (a: ActionBody | undefined): boolean => a?.kind === "special" && OPENS_SHEET.includes(a.name);
