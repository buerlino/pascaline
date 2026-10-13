// SPDX-License-Identifier: GPL-3.0-or-later
// What a key does while a sheet is open (docs/05 3.1 with section 7). Shift and Alpha are ignored for picking: a key
// is read by what it is, never by the layer, so no key goes through the sheet into the entry line (rule 4).
import type { Key } from "../keyboard/keyboard.ts";

export type SheetKey =
  | { kind: "move"; by: 1 | -1 }
  /** Digit keys: the row numbered 1…10 (0 picks the tenth). */
  | { kind: "pick"; n: number }
  | { kind: "enter" }
  /** ▶: open the highlighted submenu. */
  | { kind: "right" }
  /** ◀ and Esc: back one level (the root closes). */
  | { kind: "back" }
  /** Cancel: close every level. */
  | { kind: "close" }
  /** A tap on a key that is not a digit types its letter into the filter (no Alpha press needed). */
  | { kind: "letter"; ch: string }
  | { kind: "backspace" }
  /** The key keeps its own job: Shift and Alpha (their state is kept as it is), and the keys that change place
   *  (Menu and Apps toggle their sheet; Home/CAS, CAS, Symb, Plot, Num close it and go there). */
  | { kind: "pass" }
  /** Does nothing in a sheet. */
  | { kind: "none" };

const DIGIT = /^d([0-9])$/;
const BY_ID: Readonly<Record<string, SheetKey>> = {
  up: { kind: "move", by: -1 },
  down: { kind: "move", by: 1 },
  enter: { kind: "enter" },
  right: { kind: "right" },
  left: { kind: "back" },
  esc: { kind: "back" },
  cancel: { kind: "close" },
  bksp: { kind: "backspace" },
};
const PASS: readonly string[] = ["shift", "alpha", "menu", "apps", "app", "cas", "symb", "plot", "num"];

/** The key's letter: its Alpha layer when that types one letter (A on Vars … Z on 2). */
export function letterOf(key: Key): string | undefined {
  const a = key.actions.alpha;
  return a?.kind === "type" && /^\p{L}$/u.test(a.text) ? a.text : undefined;
}

/** A key's job in a sheet. `filter`: the open level takes letters (long lists). */
export function sheetKey(key: Key, filter: boolean): SheetKey {
  const d = DIGIT.exec(key.id);
  if (d) return { kind: "pick", n: Number(d[1]) || 10 };
  const fixed = BY_ID[key.id];
  if (fixed) return fixed;
  const p = key.actions.primary;
  if (p?.kind === "special" && PASS.includes(p.name)) return { kind: "pass" };
  const ch = filter ? letterOf(key) : undefined;
  return ch ? { kind: "letter", ch } : { kind: "none" };
}
