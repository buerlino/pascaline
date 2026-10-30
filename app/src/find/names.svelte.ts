// SPDX-License-Identifier: GPL-3.0-or-later
// Vars and Memory (R4b, docs/04 3.4 and 5.1): Find on the user's variables and functions, the live items of the
// session's names (stored ones included once the engine has read its log). Vars lists them and inserts one; Shift +
// Math, Memory, lists the same and deletes one (Enter) or all (the last row, Enter twice). In Find's lazy chunk. No
// index is needed: the live items go through rank.ts's search over an empty index.
import type { MenuItem } from "../apps/types.ts";
import type { UserName } from "../engine/defs.ts";
import type { EntryController } from "../entry/controller.ts";
import { findText as t } from "../i18n/enFind.ts";
import { homeResultToLatex } from "../render/home.ts";
import type { Session } from "../state/session.svelte.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { functionInsert, search } from "./rank.ts";
import type { FindItem } from "./types.ts";

const NO_INDEX = { items: [] };

/** What an item inserts: a variable as the name the keys would type, a function as a call with the cursor in its
 *  argument (a single letter is typed as it is, a longer name as `\operatorname`, which the parser reads as a call). */
function insertOf(n: UserName): string {
  if (n.kind === "var") return homeResultToLatex(n.name);
  return n.name.length === 1 ? `${n.name}\\left(#0\\right)` : functionInsert(`fn:${n.name}`);
}

/** A name as a Find live item (types.ts: kind `var` or `userfn`). Its value text is searched too (`desc`). */
export function liveItem(n: UserName): FindItem {
  const desc = n.desc ?? n.preview;
  return { id: `${n.kind === "fn" ? "userfn" : "var"}:${n.name}`, kind: n.kind === "fn" ? "userfn" : "var", names: [n.name], title: n.name, ...(desc ? { desc } : {}), tier: 0, insert: insertOf(n) };
}

/** Details under the list: `A = 5`, or a function with its comment. */
function previewOf(n: UserName): string {
  return n.kind === "fn" ? `${n.name}(…)${n.desc ? ` · ${n.desc}` : ""}` : `${n.name} = ${n.preview}${n.desc ? ` · ${n.desc}` : ""}`;
}

/** Whether the clear-all row was pressed once (it clears on the second Enter). Reactive, so the row redraws. */
const ui = $state({ armed: false });

/** Vars (`memory` false) or Memory (true) as a sheet above the keypad, its keys those of Find (route.ts, sheetKeys.ts). */
export function showNames(shell: { sheet: Sheet | null }, entry: EntryController, session: Session, memory: boolean): void {
  ui.armed = false;
  const names = (): readonly UserName[] => session.userNames;
  /** After a deletion: the hits are read again and the highlight stays on a row. */
  const settle = (): void => {
    const level = shell.sheet?.level;
    if (!level) return;
    level.refresh();
    level.highlight = Math.min(level.highlight, level.items.length - 1);
  };
  const run = (n: UserName): void => {
    if (memory) {
      ui.armed = false;
      void session.forget([n.name]);
      settle();
    } else entry.run({ kind: "insert", latex: insertOf(n) });
  };
  const row = (n: UserName): MenuItem => ({
    id: liveItem(n).id,
    label: n.name,
    value: n.kind === "fn" ? t("memory.fn") : n.preview,
    preview: previewOf(n),
    ...(memory ? { keep: true } : {}),
    run: () => run(n),
  });
  const clearAll: MenuItem = {
    id: "clearall",
    get label() {
      return ui.armed ? t("memory.sure", { n: String(names().length) }) : t("memory.clear");
    },
    keep: true,
    run: () => {
      if (!ui.armed) ui.armed = true;
      else {
        ui.armed = false;
        void session.forget(names().map((n) => n.name));
        settle();
      }
    },
  };
  /** Newest definition first (the empty query shows what was just stored). */
  const all = (): MenuItem[] => [...names()].sort((a, b) => b.time - a.time).map(row);
  const found = (q: string): MenuItem[] => {
    const by = new Map(names().map((n) => [n.name, n]));
    return search(NO_INDEX, q, { live: names().map(liveItem) }).flatMap((h) => {
      const n = by.get(h.item.names[0] ?? "");
      return n ? [row(n)] : [];
    });
  };
  shell.sheet = new Sheet("find", t(memory ? "memory.title" : "vars.title"), () => (memory && names().length ? [...all(), clearAll] : all()), { search: found, remember: false });
}
