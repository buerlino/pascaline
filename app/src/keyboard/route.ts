// SPDX-License-Identifier: GPL-3.0-or-later
// Key routing (R15c2, split out of App.svelte): what a key press does in the place it lands in. An open Settings page or
// sheet takes its keys first (docs/05 3.1), a picked history row takes the arrows, Enter, Esc, Copy and Menu (P4, R11),
// a key pressed while an app's or a sheet's code loads waits in the queue (decisions.md R8), and every other key runs
// its action on the entry line, the app or the app shell. Plain functions over a context object (RouteCtx) that
// App.svelte gives them; this module draws nothing and holds no state of its own.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { NavDir } from "../apps/types.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import { startsWithAns } from "../entry/ans.ts";
import type { EntryController } from "../entry/controller.ts";
import { ANS_CHIP } from "../entry/macros.ts";
import { canPick, pickAfter, pickAtOrBefore } from "../state/pickRows.ts";
import type { HistoryItem, Session, View } from "../state/session.svelte.ts";
import type { SheetKey } from "../views/sheetKeys.ts";
import { sheetChunk, loadSheetView } from "../views/sheetView.svelte.ts";
import { actionFor, type ActionBody, type Key, type Layer, type Special } from "./keyboard.ts";

/** Shift and Alpha as one key would see them: the session's state, or the layer a gesture chose. */
export type Mods = { shift: boolean; alpha: boolean };
/** A key (or a hardware letter, R45) waiting for an app's or a sheet's code. */
export type Waiting = { key: Key; mods: Mods; layer?: Layer } | { letter: string };

/** What the routing reads and calls: the models, the App-owned state (as accessors) and the App-owned actions. */
export interface RouteCtx {
  readonly session: Session;
  readonly shell: AppShell;
  readonly entry: EntryController;
  /** The picked history row (P4), or null. */
  picked: number | null;
  /** The open Settings page's key handler (R21b), or null when it is closed. */
  readonly settingsPage: { key(k: SheetKey): "close" | "pass" | "stay" } | null;
  /** Set while the first Mode or Settings open (or the sheet's view) waits for its code. */
  sheetLoad: Promise<void> | null;
  /** The keys waiting for code to load (R8), in the order pressed. */
  waiting: Waiting[];
  /** The CAS view is under the keys (no app on top): Alpha types lower case there (R58). */
  readonly casKeys: boolean;
  enter(): void;
  insertResult(item: HistoryItem): void;
  goTo(view: View): void;
  clearKey(): void;
  openSettings(): void;
  closeSettings(): void;
  openMode(at?: string): void;
  openTemplates(): void;
  openShiftPalette(id: "rel" | "sym"): void;
  /** Math (R4a): open Find (inside Find, Math types b; docs/04 3.7). */
  openFind(): void;
  /** Run with the clipboard code, now or once it has loaded. */
  withClip(run: (c: ClipActions) => void): void;
  loadClip(): void;
  /** A key that does nothing here (docs/05 3.7): the double haptic. */
  dead(): void;
}

const modsFor = (c: RouteCtx, layer: Layer | undefined): Mods =>
  layer === undefined ? { shift: c.session.shift, alpha: c.session.alpha } : { shift: layer === "shift", alpha: layer === "alpha" };
const layerOf = (m: Mods): Layer => (m.alpha ? "alpha" : m.shift ? "shift" : "primary");

const NAV: Record<string, NavDir> = {
  moveUp: "up",
  moveDown: "down",
  moveToPreviousChar: "left",
  moveToNextChar: "right",
};

/** Esc (R15c point 3), once an open page, sheet or pick has had it: a running job stops, else the line clears. Also a
 *  working row's own Cancel button. */
export async function escape(c: RouteCtx): Promise<void> {
  if (c.settingsPage) return c.closeSettings();
  if (await c.shell.cancel()) return;
  if (await c.session.cancel()) return;
  c.entry.clear();
}

export function special(c: RouteCtx, name: Special): void {
  switch (name) {
    case "enter":
      c.enter();
      break;
    case "esc":
      void escape(c);
      break;
    case "clear":
      c.clearKey();
      break;
    case "switch":
      // the place name (R15b): from an app back to Home/CAS, else switch between the two
      c.picked = null;
      if (c.shell.app !== null) c.shell.close();
      else c.session.toggleView();
      break;
    case "home":
    case "cas":
      c.goTo(name); // a user key that holds Home or CAS
      break;
    case "settings":
      c.openSettings();
      break;
    case "mode":
      c.openMode();
      break;
    case "apps":
      c.shell.toggleApps();
      break;
    case "symb":
    case "plot":
    case "num":
      void c.shell.setView(name);
      break;
    case "menu":
      c.withClip(() => {
        if (!c.shell.toggleMenu()) c.dead(); // the view has no menu
      }); // the Home/CAS menu comes with the clipboard code
      break;
    case "copy":
      c.withClip((x) => void x.copyKey());
      break;
    case "paste":
      c.withClip((x) => void x.paste());
      break;
    case "fmt":
      // Format key: Home and CAS show the last result in the next mode; the apps have no such result.
      if (c.shell.app === null) void c.session.cycleFormat();
      else c.dead();
      break;
    case "tmpl":
      c.openTemplates();
      break;
    case "relations":
      c.openShiftPalette("rel");
      break;
    case "symbols":
      c.openShiftPalette("sym");
      break;
    case "find":
      c.openFind();
      break;
    case "shift":
    case "alpha":
    case "none":
      c.dead();
      break;
  }
}

/** P4: Up on an empty entry line picks the last history row (Home/CAS); Up/Down walk the rows, Enter puts the picked
 *  result on the entry line (L5; an entry without a result puts its input back), Esc drops the pick, Copy and Menu act
 *  on the picked row. Any other key drops the pick and does its normal job. True: the key was used up here. */
export function historyKey(c: RouteCtx, action: ActionBody): boolean {
  const items = c.session.items;
  const n = items.length;
  const isCmd = (name: string) => action.kind === "cmd" && action.name === name;
  const picked = c.picked;
  // a "note" row (the safe-start line) is drawn without a pick, so it is never picked
  if (picked === null || picked >= n || !canPick(items, picked)) {
    c.picked = null;
    if (!isCmd("moveUp") || n === 0 || c.entry.value !== "") return false;
    c.picked = pickAtOrBefore(items, n - 1);
    if (c.picked === null) return false; // only notes: Up does its normal job
    c.loadClip(); // the row buttons come from its list
    return true;
  }
  if (isCmd("moveUp")) {
    c.picked = pickAtOrBefore(items, picked - 1) ?? picked;
    return true;
  }
  if (isCmd("moveDown")) {
    c.picked = pickAfter(items, picked);
    return true;
  }
  const item = items[picked];
  c.picked = null;
  if (action.kind !== "special") return false;
  if (action.name === "esc") return true;
  if (action.name === "menu" && item) {
    c.withClip((x) => x.openMenu(item)); // ☰ acts on the picked row (R13)
    return true;
  }
  if (action.name === "copy" && item) {
    c.withClip((x) => void x.copyKey(item)); // the Copy key copies the picked row
    return true;
  }
  if (action.name === "enter" && item) {
    if (item.status === "done") c.insertResult(item);
    else c.entry.set(item.latex, item.chips); // the line is empty while picking: the entry comes back with its chips
    return true;
  }
  return false;
}

/** A key while a sheet is open (docs/05 3.1). Shift and Alpha are ignored, and the sheet leaves them as they are; no
 *  key goes through to the entry line. A flick down types the key's letter into the filter, on any key (digits
 *  too; docs/05 section 7 point 6); a flick up does nothing there. False: no sheet is open. */
export function sheetPress(c: RouteCtx, key: Key, layer: Layer | undefined): boolean {
  const shell = c.shell;
  const sheet = shell.sheet;
  if (!sheet) return false;
  const level = sheet.level;
  // a grid whose cells show keys (Shift + 6, R18): a tap on such a key picks its cell, before its usual sheet job
  const byPlace = layer === "alpha" || layer === "shift" ? undefined : sheet.pickKey(key.id);
  if (byPlace) {
    shell.picked(byPlace);
    return true;
  }
  const find = sheet.id === FIND_SHEET;
  const keys = sheetChunk.keys; // (an open sheet has it: sheetUndrawn above holds the keys until the chunk is in)
  if (!keys) return false;
  const k = find
    ? keys.findKey(key, layer, c.session.shift, level.filter === "")
    : layer === "alpha" || layer === "shift"
      ? keys.sheetFlick(key, layer === "alpha", level.filterable)
      : keys.sheetKey(key, level.filterable);
  // in Find a one-shot Shift is used up by the key it types (its lock stays); elsewhere a sheet leaves it as it is
  if (find && c.session.shift && !c.session.shiftLock) c.session.clearModifiers();
  switch (k.kind) {
    case "move":
      level.move(k.by);
      return true;
    case "pick":
      shell.picked(sheet.pickNumber(k.n));
      return true;
    case "enter":
      shell.picked(sheet.enter());
      return true;
    case "right":
      shell.picked(sheet.right());
      return true;
    case "left":
      if (!sheet.left() && !sheet.back()) shell.closeSheet();
      return true;
    case "back":
      if (!sheet.back()) shell.closeSheet();
      return true;
    case "letter":
      level.type(k.ch);
      return true;
    case "backspace":
      // in Find ⌫ on an empty query goes back from a category to the list of categories
      if (!level.backspace() && find) sheet.back();
      return true;
    case "none":
      return true;
    case "pass": {
      // read by what the key is, not by the layer: ☰, the place name and Tmpl toggle their sheet, a control that
      // changes place (a view tab, a user key that holds Home or CAS) closes it and goes there
      const p = key.actions.primary;
      if (p?.kind !== "special") return true;
      if (p.name !== "menu" && p.name !== "apps" && p.name !== "tmpl") shell.closeSheet();
      special(c, p.name);
      return true;
    }
  }
}

/** A key while the Settings page is open (R21b): ▲ ▼ move, ◀ ▶ step, Enter toggles, Esc closes; a control that
 *  changes place closes the page and goes there; no key goes through to the entry line. */
export function settingsPress(c: RouteCtx, key: Key, layer: Layer | undefined): boolean {
  const page = c.settingsPage;
  if (!page) return false;
  const k: SheetKey = layer === "alpha" || layer === "shift" ? { kind: "none" } : (sheetChunk.keys?.sheetKey(key, false) ?? { kind: "none" }); // (openSettings waits for the keys)
  const what = page.key(k);
  if (what === "close") c.closeSettings();
  else if (what === "pass") {
    const p = key.actions.primary;
    c.closeSettings();
    if (p?.kind === "special" && p.name !== "menu") special(c, p.name); // ☰ just closes the page
  }
  return true;
}

// Keys pressed while an app's code is loading wait for it, so nothing typed is lost (like MathLive's queue). Each
// waits with the layer it was pressed in (Shift and Alpha act at once), so "Plot, Shift, ᴇ" typed fast stores as it
// would after the load (decisions.md R8). A key whose action changes place, opens a sheet or stops a job runs at once:
// the status line's controls too (they go through press(), R15b, R15c1), and a user key while it holds Home or CAS; a
// user key that holds anything else waits like the key it stands for.
const AT_ONCE: readonly string[] = ["esc", "home", "cas", "switch", "apps", "symb", "plot", "num", "settings", "mode"];

function wait(c: RouteCtx, w: Waiting): void {
  c.waiting.push(w);
  if (c.waiting.length === 1) void Promise.all([c.shell.opening, c.sheetLoad]).then(() => replay(c));
}
function replay(c: RouteCtx): void {
  const keys = c.waiting;
  c.waiting = [];
  for (const w of keys)
    if (c.shell.loading !== null || c.sheetLoad !== null) wait(c, w); // another app started loading meanwhile
    else if ("letter" in w) typeLetter(c, w.letter);
    else if (!((c.settingsPage && settingsPress(c, w.key, w.layer)) || (c.shell.sheet && sheetPress(c, w.key, w.layer)))) run(c, w.key, w.mods); // a page or sheet opened meanwhile takes its keys
}

const SHEET_KEYS: readonly string[] = ["apps", "menu", "tmpl", "relations", "symbols", "find"];
/** The open sheet is Find (R4a): its keys follow docs/04 3.7 (sheetKeys.ts findKey). */
export const FIND_SHEET = "find";
/** Does this key open a sheet? (Mode and Settings load the view with their lists.) */
function opensSheet(key: Key, mods: Mods): boolean {
  const a = actionFor(key, mods.shift, mods.alpha);
  return a?.kind === "special" && SHEET_KEYS.includes(a.name);
}

/** F42: a sheet is open but its chunk is not in (a long press on a history row opens one before the idle load), so
 *  nothing is drawn and no key may reach it. Start the load; the caller queues its key (R8), which then runs on the
 *  drawn sheet. If the chunk does not load, the sheet closes and the queued keys run without it. */
function sheetUndrawn(c: RouteCtx): boolean {
  if (!c.shell.sheet || sheetChunk.C) return false;
  c.sheetLoad ??= loadSheetView()
    .catch(() => c.shell.closeSheet())
    .finally(() => (c.sheetLoad = null));
  return true;
}

/** A key fires. `layer` overrides the Shift/Alpha state for this key only: a trackpad step ("primary"), a flick up
 *  ("shift") or down ("alpha"). */
export function press(c: RouteCtx, key: Key, layer?: Layer): void {
  const p = key.actions.primary;
  if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return modifier(c, p.name, layer);
  if (c.settingsPage && settingsPress(c, key, layer)) return;
  if (sheetUndrawn(c)) return wait(c, { key, mods: modsFor(c, layer), layer });
  if (c.shell.sheet && sheetPress(c, key, layer)) return;
  const mods = modsFor(c, layer);
  c.session.clearModifiers(); // a one-shot Shift or Alpha is used up by this key, a tap or a flick
  if (c.sheetLoad === null && sheetChunk.C === null && opensSheet(key, mods)) {
    c.sheetLoad = loadSheetView()
      .catch(() => {})
      .finally(() => (c.sheetLoad = null)); // if it fails, the queued keys run without a sheet
  }
  if (c.sheetLoad !== null) return wait(c, { key, mods, layer });
  if (c.shell.loading !== null) {
    const a = actionFor(key, mods.shift, mods.alpha);
    if (!(a?.kind === "special" && AT_ONCE.includes(a.name))) return wait(c, { key, mods, layer });
  }
  run(c, key, mods);
}

/** A letter from a hardware keyboard (R45, F38): what the keypad's letter key does in this place. */
export function typeLetter(c: RouteCtx, ch: string): void {
  if (c.settingsPage) return; // the page takes no letters
  if (sheetUndrawn(c)) return wait(c, { letter: ch });
  const sheet = c.shell.sheet;
  if (sheet) {
    if (sheet.level.filterable) sheet.level.type(sheet.id === FIND_SHEET ? ch.toLowerCase() : ch);
    return;
  }
  if (c.shell.loading !== null || c.sheetLoad !== null) return wait(c, { letter: ch });
  c.picked = null;
  c.session.clearModifiers();
  if (c.shell.app !== null && !c.shell.showsEntry) return c.dead();
  c.entry.run({ kind: "type", text: ch });
}

/** Shift and Alpha: a tap is the G2's one-shot (L3's double taps lock), counted for P7 point 4; a flick locks
 *  (P7 point 3): up on Shift = shift lock, down on Alpha = capitals, up on Alpha = lower case. */
function modifier(c: RouteCtx, name: "shift" | "alpha", layer: Layer | undefined): void {
  const s = c.session;
  if (layer === undefined || layer === "primary") {
    s.taps.tap(name);
    if (name === "shift") s.toggleShift();
    else s.toggleAlpha();
  } else if (name === "alpha") s.flickAlphaLock(layer === "shift");
  else if (layer === "shift") s.flickShiftLock();
}

/** The key's action in the layer it was pressed in. */
export function run(c: RouteCtx, key: Key, mods: Mods): void {
  const { session, shell, entry } = c;
  const action = actionFor(key, mods.shift, mods.alpha, session.settings.entry === "line", c.casKeys);
  if (!action) return c.dead();
  if (shell.app === null && historyKey(c, action)) return;
  if (action.kind === "special") return special(c, action.name);
  if (shell.app !== null) {
    const dir = action.kind === "cmd" ? NAV[action.name] : undefined;
    if (dir && shell.nav(dir)) return;
    if (!shell.showsEntry) return c.dead(); // a view without an entry line (Plot) ignores typing, ⇤ ⇥ and Undo
    if (action.kind === "insert" && action.latex === ANS_CHIP) return c.dead(); // Ans belongs to Home and CAS
  } else if (entry.value === "" && key.id === "frac" && layerOf(mods) === "primary") {
    // a b/c on an empty line (R10): the last result in its next form (decimal ↔ fraction, a+bi ↔ polar), as on the
    // G2; while typing it is the stacked fraction below
    void session.cycleForm();
    return;
  } else if (entry.value === "" && startsWithAns(key.id, layerOf(mods)) && session.hasResult()) {
    entry.insertAns(); // docs/04 2.8: an operator (or Store ▶) on an empty line starts with Ans
  }
  entry.run(action);
}
