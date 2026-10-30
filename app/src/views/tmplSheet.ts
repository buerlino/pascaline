// SPDX-License-Identifier: GPL-3.0-or-later
// The palettes as items for the grid sheet: Tmpl (R10; spec/keyboard.yaml `templates:`) and the Shift palettes (R18;
// `relations:`, `symbols:`). Each cell is drawn as its template with empty boxes, named through i18n
// (`<palette>.<id>`), and inserts its action (a key's template keeps that key's one-line form). A cell picked by the
// key at its place (Shift + 6) carries that key and its legend.
import type { MenuItem } from "../apps/types.ts";
import { legend } from "../i18n/index.ts";
import { keyboard, type ActionBody, type PaletteItem } from "../keyboard/keyboard.ts";

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

/** The palette's cells, in reading order; `insert` runs the picked one. `name`: a cell's name by its id (the palettes'
 *  names are in i18n/enPalettes.ts, loaded with the palettes). */
export function paletteItems(
  cells: readonly PaletteItem[],
  insert: (p: PaletteItem) => void,
  name: (id: string) => string,
): MenuItem[] {
  return cells.map((p) => {
    const key = p.pick === undefined ? undefined : keyboard.byId.get(p.pick);
    return {
      id: p.id,
      label: name(p.id),
      latex: cellLatex(p.action.latex),
      ...(key ? { pick: { key: key.id, legend: legend(key.label.primary ?? "") } } : {}),
      run: () => insert(p),
    };
  });
}
