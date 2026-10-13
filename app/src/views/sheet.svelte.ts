// SPDX-License-Identifier: GPL-3.0-or-later
// One sheet for every list (docs/05 3.1 with section 7): the model behind Sheet.svelte. Apps, the view menus, the
// Home/CAS Menu and the row actions use it now; Find, the template palette and the settings values build on it.
// Plain state, no DOM: the keys reach it through sheetKeys.ts, touch through Sheet.svelte.
import type { MenuItem } from "../apps/types.ts";

/** Lists with more items than this get the letter filter (docs/05 3.1: "for lists longer than 10 items"). */
export const FILTER_ABOVE = 10;

/** The item picked last, per sheet and level (`<sheet id>/<item id>/…`): reopening highlights it (Menu + Enter repeats). */
const lastPicks = new Map<string, string>();

/** Forget every remembered pick (tests). */
export function forgetPicks(): void {
  lastPicks.clear();
}

/** An item as the sheet shows it: its place in the full list and the number a digit key picks it with. */
export interface Row {
  readonly item: MenuItem;
  /** Index in the level's full list. */
  readonly index: number;
  /** 1…10 (shown as 1…9, 0); undefined past the tenth row. */
  readonly n: number | undefined;
}

/** True when every word start of `label` … one of them starts with `filter` (case-insensitive). */
export function matches(label: string, filter: string): boolean {
  if (filter === "") return true;
  const f = filter.toLowerCase();
  const l = label.toLowerCase();
  if (l.startsWith(f)) return true;
  // a word starts after anything that is not a letter or digit ("Copy as shown", "x-axis", "F1(x)")
  for (let i = 1; i < l.length; i++) if (!/[\p{L}\p{N}]/u.test(l[i - 1] as string) && l.startsWith(f, i)) return true;
  return false;
}

/** One level of the stack: the root list or a submenu. */
export class Level {
  /** Index of the highlighted item in the full list (-1: none, e.g. the filter matches nothing). */
  highlight = $state(-1);
  filter = $state("");

  readonly title: string;
  /** Read on every draw, so a menu whose items change while it is open (a result arrives) stays current. */
  private readonly source: () => readonly MenuItem[];
  /** Key of the remembered pick of this level. */
  readonly memo: string;
  /** Letters filter this level (long lists; Find forces it on). */
  readonly filterable: boolean;

  constructor(title: string, source: () => readonly MenuItem[], memo: string, filterable?: boolean) {
    this.title = title;
    this.source = source;
    this.memo = memo;
    this.filterable = filterable ?? source().length > FILTER_ABOVE;
    this.highlight = this.start();
  }

  get items(): readonly MenuItem[] {
    return this.source();
  }

  /** The rows on screen. Without a filter every item keeps its place and number (disabled ones too); with one, the
   *  matches are numbered in order. */
  get rows(): Row[] {
    const out: Row[] = [];
    this.items.forEach((item, index) => {
      if (!matches(item.label, this.filter)) return;
      const k = out.length + 1;
      out.push({ item, index, n: k <= 10 ? k : undefined });
    });
    return out;
  }

  get current(): MenuItem | undefined {
    return this.items[this.highlight];
  }

  /** Where the highlight starts: the last pick when it can be picked, else the first item that can. */
  private start(): number {
    const items = this.items;
    const last = lastPicks.get(this.memo);
    const i = last === undefined ? -1 : items.findIndex((x) => x.id === last);
    if (i >= 0 && !items[i]?.disabled) return i;
    return this.firstRow();
  }

  private firstRow(): number {
    const rows = this.rows;
    return (rows.find((r) => !r.item.disabled) ?? rows[0])?.index ?? -1;
  }

  /** ▲ ▼: the next row up or down, round the ends. Disabled rows can be highlighted (their reason is read there). */
  move(by: 1 | -1): void {
    const rows = this.rows;
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r.index === this.highlight);
    const next = at < 0 ? (by > 0 ? 0 : rows.length - 1) : (at + by + rows.length) % rows.length;
    this.highlight = (rows[next] as Row).index;
  }

  /** A letter typed into the filter (false: this level has no filter). */
  type(ch: string): boolean {
    if (!this.filterable) return false;
    this.filter += ch;
    this.highlight = this.firstRow();
    return true;
  }

  /** ⌫: the last filter letter goes (false: nothing to delete). */
  backspace(): boolean {
    if (this.filter === "") return false;
    this.filter = this.filter.slice(0, -1);
    if (!this.rows.some((r) => r.index === this.highlight)) this.highlight = this.firstRow();
    return true;
  }
}

/** What a pick did: opened a submenu or did nothing (the sheet stays), or chose an item to run (the sheet closes). */
export type Picked = { kind: "stay" } | { kind: "run"; item: MenuItem };
const STAY: Picked = { kind: "stay" };

export class Sheet {
  /** Names the sheet for the remembered pick: `apps`, `menu:<place>`, `list:<title>`. */
  readonly id: string;
  levels = $state.raw<Level[]>([]);

  constructor(id: string, title: string, items: () => readonly MenuItem[], opts?: { filterable?: boolean }) {
    this.id = id;
    this.levels = [new Level(title, items, id, opts?.filterable)];
  }

  get level(): Level {
    return this.levels[this.levels.length - 1] as Level;
  }
  get depth(): number {
    return this.levels.length;
  }
  /** The title with its path, e.g. `Menu › Intersection of F2(x) and`. */
  get path(): string {
    return this.levels.map((l) => l.title).join(" › ");
  }

  /** Digit keys and taps: the row numbered `n` (1…10) on screen. */
  pickNumber(n: number): Picked {
    const row = this.level.rows.find((r) => r.n === n);
    return row ? this.activate(row.index) : STAY;
  }

  /** Enter: the highlighted item. */
  enter(): Picked {
    return this.activate(this.level.highlight);
  }

  /** ▶: open the highlighted item's submenu (only an item that has one). */
  right(): Picked {
    return this.level.current?.submenu ? this.activate(this.level.highlight) : STAY;
  }

  /** ◀ and Esc: back one level. False at the root: the caller closes the sheet. */
  back(): boolean {
    if (this.levels.length <= 1) return false;
    this.levels = this.levels.slice(0, -1);
    return true;
  }

  /** Pick by index in the full list: a disabled item does nothing, a submenu opens on top, anything else runs. */
  activate(index: number): Picked {
    const level = this.level;
    const item = level.items[index];
    if (!item || item.disabled) return STAY;
    level.highlight = index;
    lastPicks.set(level.memo, item.id);
    if (item.submenu) {
      const sub = item.submenu;
      this.levels = [...this.levels, new Level(sub.title, () => sub.items, `${level.memo}/${item.id}`)];
      return STAY;
    }
    return { kind: "run", item };
  }
}
