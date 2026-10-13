// SPDX-License-Identifier: GPL-3.0-or-later
// The Tmpl palette (R10; spec/keyboard.yaml `templates:`) as items for the grid sheet: each cell drawn as its template
// with empty boxes, named through i18n, and the action it inserts (a key's template keeps that key's one-line form).
import type { MenuItem } from "../apps/types.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import type { ActionBody, PaletteItem } from "../keyboard/keyboard.ts";

/** The template drawn with an empty box for every slot (#? a placeholder, #@ and #0 what the cursor would take).
 *  A box, not \placeholder: MathLive's static renderer draws a placeholder as nothing. */
export function cellLatex(latex: string): string {
  return latex.replace(/#[?@0]/g, "\\square ");
}

/** What a cell inserts: its action, or the one-line form when the entry is linear and the cell has one. */
export function paletteAction(p: PaletteItem, oneLine: boolean): ActionBody {
  const a = p.action;
  return oneLine && a.line ? a.line : a;
}

/** The palette's cells, in reading order; `insert` runs the picked one. */
export function paletteItems(cells: readonly PaletteItem[], insert: (p: PaletteItem) => void): MenuItem[] {
  return cells.map((p) => ({
    id: p.id,
    label: t(`tmpl.${p.id}` as MessageKey),
    latex: cellLatex(p.action.latex),
    run: () => insert(p),
  }));
}
