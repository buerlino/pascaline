// SPDX-License-Identifier: GPL-3.0-or-later
// One sheet for every list (docs/05 3.1 with section 7): the model behind Sheet.svelte. Apps, the view menus, the
// Home/CAS Menu, the row actions, the template palette and Find (R4a: a level that searches) use it.
// Plain state, no DOM: the keys reach it through sheetKeys.ts, touch through Sheet.svelte.
import type { MenuItem } from "../apps/types.ts";
import type { IconId } from "./icons.ts";

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
  /** Find (R4a): a typed query replaces the items with these hits, in their order, unnumbered (digits type then). */
  readonly search: ((query: string) => readonly MenuItem[]) | undefined;
  private found: { q: string; items: readonly MenuItem[] } | null = null;
  /** Counts the times the hits were dropped (refresh), so a view that shows them draws again. */
  private dropped = $state(0);
  /** A text to read in place of rows (R87, a licence). */
  readonly text: string | undefined;
  /** The preview under the list may take several lines. */
  readonly longPreview: boolean;
  /** The load of rows that are not in yet (a lazy submenu, R87), else null: keys wait for it (route.ts, R8). */
  readonly loading: () => Promise<void> | null;
  /** A text level: ▲ ▼ asked for this many pages (signed, cleared by Sheet.svelte, which owns the scroll position). */
  nudge = $state(0);

  /** Reopening starts on the last pick (false: always on the first row, for a sheet whose ◀ ▶ change values). */
  private readonly remember: boolean;
  /** A grid of this many columns (the Tmpl palette, R10): ▲ ▼ ◀ ▶ move in two dimensions, no numbers, no filter.
   *  Undefined: a list. */
  readonly columns: number | undefined;

  constructor(title: string, source: () => readonly MenuItem[], memo: string, opts?: SheetOptions) {
    this.title = title;
    this.source = source;
    this.memo = memo;
    this.remember = opts?.remember ?? true;
    this.columns = opts?.columns;
    this.search = opts?.search;
    this.text = opts?.text;
    this.longPreview = opts?.longPreview ?? false;
    this.loading = opts?.loading ?? (() => null);
    this.filterable = this.columns === undefined && (this.search !== undefined || (opts?.filterable ?? source().length > FILTER_ABOVE));
    this.highlight = this.start(opts?.at);
  }

  get items(): readonly MenuItem[] {
    const q = this.filter;
    void this.dropped;
    if (!this.search || q === "") return this.source();
    if (this.found?.q !== q) this.found = { q, items: this.search(q) };
    return this.found.items;
  }

  /** The level shows a query's hits (Find with letters typed): its digits type, so no row has a number (rule M1). */
  get searching(): boolean {
    return this.search !== undefined && this.filter !== "";
  }

  /** The rows on screen. Without a filter every item keeps its place and number (disabled ones too); with one, the
   *  matches are numbered in order. A search's hits are the rows as they come, without numbers. */
  get rows(): Row[] {
    if (this.searching) return this.items.map((item, index) => ({ item, index, n: undefined }));
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

  /** Where the highlight starts: the item asked for (`at`), else the current value of a list of values, else the last
   *  pick when it can be picked, else the first item that can. */
  private start(at?: string): number {
    const items = this.items;
    const asked = at === undefined ? -1 : items.findIndex((x) => x.id === at && !x.disabled);
    if (asked >= 0) return asked;
    const current = items.findIndex((x) => x.selected === true && !x.disabled);
    if (current >= 0) return current;
    const last = this.remember ? lastPicks.get(this.memo) : undefined;
    const i = last === undefined ? -1 : items.findIndex((x) => x.id === last);
    if (i >= 0 && !items[i]?.disabled) return i;
    return this.firstRow();
  }

  private firstRow(): number {
    const rows = this.rows;
    return (rows.find((r) => !r.item.disabled) ?? rows[0])?.index ?? -1;
  }

  /** ▲ ▼: the next row up or down, round the ends. Disabled rows can be highlighted (their reason is read there).
   *  In a grid: the cell above or below, round the ends of its column. */
  move(by: 1 | -1): void {
    if (this.text !== undefined) {
      this.nudge += by;
      return;
    }
    if (this.columns !== undefined) return this.gridMove(by * this.columns, true);
    const rows = this.rows;
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r.index === this.highlight);
    const next = at < 0 ? (by > 0 ? 0 : rows.length - 1) : (at + by + rows.length) % rows.length;
    this.highlight = (rows[next] as Row).index;
  }

  /** ◀ ▶ in a grid: the cell before or after in reading order, round the ends of the grid. */
  step(by: 1 | -1): void {
    this.gridMove(by, false);
  }

  private gridMove(by: number, column: boolean): void {
    const n = this.items.length;
    const cols = this.columns ?? 1;
    if (n === 0) return;
    if (this.highlight < 0) {
      this.highlight = 0;
      return;
    }
    let next = this.highlight + by;
    if (column) {
      // round the ends of the column: from the last row back to the first, and the other way
      const col = this.highlight % cols;
      const last = col + cols * Math.floor((n - 1 - col) / cols);
      if (next < 0) next = last;
      else if (next >= n) next = col;
    } else next = (next + n) % n;
    this.highlight = next;
  }

  /** A search's hits are read again (Memory: a name was deleted). */
  refresh(): void {
    this.found = null;
    this.dropped++;
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
    if (this.search || !this.rows.some((r) => r.index === this.highlight)) this.highlight = this.firstRow();
    return true;
  }
}

export interface SheetOptions {
  filterable?: boolean;
  remember?: boolean;
  at?: string;
  /** A grid of this many columns (see Level.columns). */
  columns?: number;
  /** The icon drawn before the title (views/icons.ts; R83: the Menu's view). */
  icon?: IconId;
  /** Find (R4a): letters search with this instead of filtering the labels (see Level.search). */
  search?: (query: string) => readonly MenuItem[];
  /** A text to read in place of rows (see Level.text). */
  text?: string;
  /** Several lines for the preview (see Level.longPreview). */
  longPreview?: boolean;
  /** The rows' load while they are not in (see Level.loading). */
  loading?: () => Promise<void> | null;
}

/** What a pick did: opened a submenu or did nothing (the sheet stays), or chose an item to run (the sheet closes). */
export type Picked = { kind: "stay" } | { kind: "run"; item: MenuItem };
const STAY: Picked = { kind: "stay" };

export class Sheet {
  /** Names the sheet for the remembered pick: `apps`, `menu:<place>`, `list:<title>`. */
  readonly id: string;
  levels = $state.raw<Level[]>([]);
  /** The list takes letters (a long list, Find later): it stays above the keypad, whose letter keys its query needs.
   *  Every other sheet is drawn over the keypad's maths rows (decisions.md "R21"). Fixed when it opens. */
  readonly letters: boolean;
  /** The icon before the title, if any. */
  readonly icon: IconId | undefined;

  constructor(id: string, title: string, items: () => readonly MenuItem[], opts?: SheetOptions) {
    this.id = id;
    this.icon = opts?.icon;
    const root = new Level(title, items, id, opts);
    this.levels = [root];
    this.letters = root.filterable;
  }

  get level(): Level {
    return this.levels[this.levels.length - 1] as Level;
  }
  get depth(): number {
    return this.levels.length;
  }
  /** The title with its path, e.g. `Menu › Intersection of F2(x) and`; the last three levels when deeper (the title
   *  row is one line: `Help and about › Parts › GPL-3.0-or-later`). */
  get path(): string {
    return this.levels.slice(-3).map((l) => l.title).join(" › ");
  }

  /** Digit keys and taps: the row numbered `n` (1…10) on screen. A grid has no numbers: a digit does nothing there. */
  pickNumber(n: number): Picked {
    if (this.level.columns !== undefined) return STAY;
    const row = this.level.rows.find((r) => r.n === n);
    return row ? this.activate(row.index) : STAY;
  }

  /** A key that picks a grid cell by its place (Shift + 6, R18: 7 8 9 ÷ / 4 5 6 × / 1 2 3). Undefined: no cell of the
   *  open level is picked by this key, so the key does its usual sheet job. */
  pickKey(keyId: string): Picked | undefined {
    if (this.level.columns === undefined) return undefined;
    const i = this.level.items.findIndex((x) => x.pick?.key === keyId);
    return i < 0 ? undefined : this.activate(i);
  }

  /** A free key pressed while its slots are listed (Settings › Your keys, R4b): the highlight goes to that key's row in
   *  that layer. False when the open level lists no such slot, so the key does its usual sheet job. */
  goKey(keyId: string, layer: string): boolean {
    const i = this.level.items.findIndex((x) => x.slot?.key === keyId && x.slot.layer === layer);
    if (i < 0) return false;
    this.level.highlight = i;
    return true;
  }

  /** Enter: the highlighted item. A setting changed in place (`adjust`) is picked as it stands: the sheet closes. */
  enter(): Picked {
    return this.activate(this.level.highlight, true);
  }

  /** ▶: step the highlighted setting up, else open the highlighted item's submenu (only an item that has one). */
  right(): Picked {
    if (this.level.columns !== undefined) {
      this.level.step(1);
      return STAY;
    }
    const item = this.level.current;
    if (item && !item.disabled && item.adjust) {
      item.adjust(1);
      return STAY;
    }
    return item?.submenu ? this.activate(this.level.highlight) : STAY;
  }

  /** ◀ on a setting changed in place: step it down. False when the highlighted item is not one (◀ then goes back). */
  left(): boolean {
    if (this.level.columns !== undefined) {
      this.level.step(-1);
      return true;
    }
    const item = this.level.current;
    if (!item || item.disabled || !item.adjust) return false;
    item.adjust(-1);
    return true;
  }

  /** A tap on a row's ◀ or ▶ button (R21a): step that setting and highlight its row. */
  adjustAt(index: number, by: 1 | -1): void {
    const item = this.level.items[index];
    if (!item || item.disabled || !item.adjust) return;
    this.level.highlight = index;
    item.adjust(by);
  }

  /** A tap on one of a row's value buttons (R86): the value is set and the sheet closes, as a pick of that value. */
  pickOption(index: number, optionId: string): Picked {
    const item = this.level.items[index];
    const option = item?.options?.find((o) => o.id === optionId);
    if (!item || item.disabled || !option) return STAY;
    this.level.highlight = index;
    lastPicks.set(this.level.memo, item.id);
    return { kind: "run", item: { id: option.id, label: option.label, run: () => option.run() } };
  }

  /** ◀ and Esc: back one level. False at the root: the caller closes the sheet. */
  back(): boolean {
    if (this.levels.length <= 1) return false;
    this.levels = this.levels.slice(0, -1);
    return true;
  }

  /** Pick by index in the full list: a disabled item does nothing, a submenu opens on top, a setting changed in place
   *  steps forward (unless `confirm`: Enter), a switch (`keep`) runs and stays, anything else runs and closes. */
  activate(index: number, confirm = false): Picked {
    const level = this.level;
    const item = level.items[index];
    if (!item || item.disabled) return STAY;
    level.highlight = index;
    lastPicks.set(level.memo, item.id);
    if (!item.submenu && item.adjust && !confirm) {
      item.adjust(1);
      return STAY;
    }
    if (item.keep) {
      item.run?.();
      return STAY;
    }
    if (item.submenu) {
      const sub = item.submenu;
      const base: SheetOptions = sub.search ? { search: sub.search, remember: false } : { remember: sub.remember ?? true };
      const opts: SheetOptions = { ...base, ...(sub.text === undefined ? {} : { text: sub.text }), ...(sub.longPreview ? { longPreview: true } : {}), ...(sub.loading ? { loading: sub.loading } : {}) };
      this.levels = [...this.levels, new Level(sub.title, () => sub.items, `${level.memo}/${item.id}`, opts)];
      return STAY;
    }
    return { kind: "run", item };
  }
}
