// SPDX-License-Identifier: GPL-3.0-or-later
// The Settings page's model (R21b, decisions.md "R21"): the rows of every section in one list, one highlighted row,
// and what each key does to it. Plain state, no DOM: the keys reach it through App.svelte, touch through
// SettingsPage.svelte. Loads with the page, never at start.
import type { MenuItem } from "../apps/types.ts";
import type { SettingsSection } from "./modeSheet.ts";
import type { SheetKey } from "./sheetKeys.ts";

export class SettingsPage {
  readonly sections: readonly SettingsSection[];
  /** Index of the highlighted row in `rows`. */
  highlight = $state(0);

  constructor(sections: readonly SettingsSection[]) {
    this.sections = sections;
  }

  /** Every row of every section, in order. */
  get rows(): MenuItem[] {
    return this.sections.flatMap((s) => s.items);
  }

  get current(): MenuItem | undefined {
    return this.rows[this.highlight];
  }

  /** ▲ ▼: the next row, round the ends. A disabled row can be highlighted (its reason is read there). */
  move(by: 1 | -1): void {
    const n = this.rows.length;
    if (n > 0) this.highlight = (this.highlight + by + n) % n;
  }

  /** ◀ ▶: step the highlighted value; a switch toggles. False: the row has nothing to step. */
  step(by: 1 | -1): boolean {
    return this.stepAt(this.highlight, by);
  }

  /** A tap on a row's ◀ or ▶ button (or ◀ ▶ on the keypad): step that value and highlight its row. */
  stepAt(index: number, by: 1 | -1): boolean {
    const item = this.rows[index];
    if (!item || item.disabled) return false;
    this.highlight = index;
    if (item.adjust) item.adjust(by);
    else if (item.selected !== undefined && item.run) item.run();
    else return false;
    return true;
  }

  /** Enter, space or a tap on a row: a switch toggles, a value steps forward, a button (Reset) runs. */
  activate(index: number): void {
    const item = this.rows[index];
    if (!item || item.disabled) return;
    this.highlight = index;
    if (item.adjust) item.adjust(1);
    else item.run?.();
  }

  /** A key of the keypad (sheetKeys.ts) or a hardware key: true when the page closes. */
  key(k: SheetKey): "close" | "pass" | "stay" {
    switch (k.kind) {
      case "move":
        this.move(k.by);
        return "stay";
      case "enter":
        this.activate(this.highlight);
        return "stay";
      case "right":
        this.step(1);
        return "stay";
      case "left":
        this.step(-1);
        return "stay";
      case "back":
      case "close":
        return "close";
      case "pass":
        return "pass";
      default:
        return "stay"; // digits, letters and the rest do nothing here; no key goes through into the entry line
    }
  }
}
