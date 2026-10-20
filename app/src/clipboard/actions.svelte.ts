// SPDX-License-Identifier: GPL-3.0-or-later
// Copy, paste and share as the keys and menus use them (docs/04 section 2.6): Shift + View, Shift + Menu, the Home/CAS
// Menu, a long press on a history row, and the Num table. The texts come from text.ts and paste.ts; the delivery is the
// ClipboardPort. Every action ends in a short notice, so a refusal is never silent.
import type { EntryController } from "../entry/controller.ts";
import { tc } from "./strings.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";
import { copyExact } from "./exact.ts";
import type { ClipboardPort } from "./port.ts";
import type { CopySource, TextOptions } from "./text.ts";

/** A history item as the copy texts read it: the engine's facts (R3 keeps them in `facts`) on the item itself. */
const source = (i: HistoryItem): CopySource => ({ ...i, ...i.facts });

// The text, paste and port code loads on first use (it is not needed to start).
const impl = () => import("./impl.ts");

const NOTICE_MS = 2200;

/** What the row actions do on the entry line; App owns these (a tap on a row uses them before this code has loaded). */
export interface RowOps {
  /** Put the result on the line as a chip (a tap on it). */
  insert(item: HistoryItem): void;
  /** Put the entry back on the line, with its chips (a tap on it). */
  recall(item: HistoryItem): void;
}

export class ClipActions {
  /** The short message on screen ("Copied"), or null. */
  notice = $state<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly session: Session;
  private readonly shell: AppShell;
  private readonly entry: EntryController;
  private readonly ops: RowOps;
  private readonly givenPort: ClipboardPort | undefined;
  private readonly decimalComma: () => boolean;

  /** `decimalComma`: the decimal comma setting (docs/04 section 6.2); not a setting yet. */
  constructor(session: Session, shell: AppShell, entry: EntryController, ops: RowOps, port?: ClipboardPort, decimalComma: () => boolean = () => false) {
    this.session = session;
    this.shell = shell;
    this.entry = entry;
    this.ops = ops;
    this.givenPort = port;
    this.decimalComma = decimalComma;
  }

  private get opts(): TextOptions {
    return this.decimalComma() ? { decimalComma: true } : {};
  }

  private async port(): Promise<ClipboardPort> {
    return this.givenPort ?? (await impl()).webClipboard;
  }

  say(message: string): void {
    this.notice = message;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.notice = null), NOTICE_MS);
  }

  /** The row an action means: the given one, else the newest finished result of the open view. */
  target(item?: HistoryItem): HistoryItem | undefined {
    if (item) return item.status === "done" ? item : undefined;
    const items = this.session.items;
    for (let i = items.length - 1; i >= 0; i--) if (items[i]?.status === "done") return items[i];
    return undefined;
  }

  /** Put text on the clipboard and say so. */
  async copyRaw(text: string | undefined, done: string = tc("clip.copied")): Promise<boolean> {
    if (text === undefined || text === "") {
      this.say(tc("clip.nothing"));
      return false;
    }
    const ok = await (await this.port()).writeText(text);
    this.say(ok ? done : tc("clip.unavailable"));
    return ok;
  }

  /** Shift + View: the full value of the picked or last result; in an app, what the open view offers (the Num table as CSV). */
  async copyKey(item?: HistoryItem): Promise<boolean> {
    if (this.shell.app !== null) return this.copyRaw(await this.shell.copyText());
    return this.copy(item);
  }
  async copy(item?: HistoryItem): Promise<boolean> {
    const i = this.target(item);
    return this.copyRaw(i ? (await impl()).copyFull(source(i), this.opts) : undefined);
  }
  async copyShown(item?: HistoryItem): Promise<boolean> {
    const i = this.target(item);
    return this.copyRaw(i ? (await impl()).withoutMark(this.session.display(i).text) : undefined);
  }
  copyExact(item?: HistoryItem): Promise<boolean> {
    const i = this.target(item);
    const exact = i ? copyExact(i) : undefined;
    if (i && exact === undefined) {
      this.say(tc("clip.noExact"));
      return Promise.resolve(false);
    }
    return this.copyRaw(exact);
  }
  copyLatex(item?: HistoryItem): Promise<boolean> {
    const i = this.target(item);
    return this.copyRaw(i ? this.session.display(i).latex : undefined);
  }

  /** Shift + Menu, Menu → Paste: the clipboard as one number, onto the entry line. */
  async paste(): Promise<boolean> {
    const clip = await (await this.port()).readText();
    if (clip === null) {
      this.say(tc("clip.unavailable"));
      return false;
    }
    const n = (await impl()).parsePastedNumber(clip, this.opts);
    if (!n) {
      this.say(tc("clip.notNumber"));
      return false;
    }
    if (this.shell.showsEntry) this.entry.insert(n.latex);
    else {
      this.say(tc("clip.nothing"));
      return false;
    }
    return true;
  }

  /** Menu → Share session: the system share sheet, else the clipboard. */
  async shareSession(): Promise<boolean> {
    const text = (await impl()).sessionText(this.session.items.map(source), this.opts);
    if (text === "") {
      this.say(tc("clip.nothing"));
      return false;
    }
    if (await (await this.port()).share(tc("clip.sessionTitle"), text)) {
      this.say(tc("clip.shared"));
      return true;
    }
    return this.copyRaw(text, tc("clip.sharedAsCopy"));
  }

  /** The row an action means: the picked one, else the newest finished result. Recall also takes an error or a
   *  cancelled entry when it is picked (its input comes back). */
  private recallable(row?: HistoryItem): HistoryItem | undefined {
    return row && row.status !== "pending" ? row : this.target(row);
  }

  /** Insert: the result as a chip on the entry line. */
  insertRow(row?: HistoryItem): boolean {
    const i = this.target(row);
    if (!i || !this.shell.showsEntry) return false;
    this.ops.insert(i);
    return true;
  }
  /** Recall: the entry back on the line. */
  recallRow(row?: HistoryItem): boolean {
    const i = this.recallable(row);
    if (!i || !this.shell.showsEntry) return false;
    this.ops.recall(i);
    return true;
  }
  /** Store ▶: the result and the store arrow on the line, the cursor ready for the variable's name (value ▶ name). */
  storeRow(row?: HistoryItem): boolean {
    if (!this.insertRow(row)) return false;
    this.entry.insert("\\blacktriangleright");
    return true;
  }
  /** Delete: the picked row, else the last row of the view. A running row is not deleted. */
  deleteRow(row?: HistoryItem): boolean {
    const i = row ?? this.session.items.at(-1);
    if (!i) return false;
    if (!this.session.removeItem(i)) {
      this.say(tc("clip.working"));
      return false;
    }
    return true;
  }

  /** The Home/CAS Menu (docs/05 3.3, S2 rule M2): one fixed list of nine, the same numbers with or without a picked
   *  row, acting on that row, else on the last result. The row buttons are items 1-5, the long press shows all nine. */
  menu(row?: HistoryItem): MenuItem[] {
    const i = this.target(row);
    const none = i === undefined;
    // A disabled item says why on its second line (docs/05 3.1). With an empty history it says nothing: the screen says
    // "Type a calculation" already, and nine rows with a reason line do not fit over the keypad (fit.spec.ts).
    const empty = this.session.items.length === 0;
    const why = empty ? undefined : tc("clip.noResult");
    const last = row ?? this.session.items.at(-1);
    const noLine = !this.shell.showsEntry;
    const copies: MenuItem[] = [
      { id: "shown", label: tc("clip.subShown"), disabled: none, reason: why, run: () => void this.copyShown(row) },
      {
        id: "exact",
        label: tc("clip.subExact"),
        disabled: none || copyExact(i) === undefined,
        reason: none ? why : tc("clip.noExact"),
        run: () => void this.copyExact(row),
      },
      { id: "latex", label: tc("clip.subLatex"), disabled: none, reason: why, run: () => void this.copyLatex(row) },
    ];
    const finished = this.session.items.some((x) => x.status === "done" || x.status === "error");
    return [
      { id: "insert", label: tc("clip.insert"), disabled: none || noLine, reason: why, run: () => void this.insertRow(row) },
      { id: "recall", label: tc("clip.recall"), disabled: this.recallable(row) === undefined || noLine, reason: why, run: () => void this.recallRow(row) },
      { id: "copy", label: tc("clip.copy"), disabled: none, reason: why, run: () => void this.copy(row) },
      { id: "store", label: tc("clip.store"), disabled: none || noLine, reason: why, run: () => void this.storeRow(row) },
      {
        id: "delete",
        label: tc("clip.delete"),
        disabled: last === undefined || last.status === "pending",
        reason: last === undefined ? undefined : tc("clip.working"),
        run: () => void this.deleteRow(row),
      },
      { id: "copyAs", label: tc("clip.copyAs"), disabled: none, reason: why, submenu: { title: tc("clip.copyAs"), items: copies } },
      { id: "paste", label: tc("clip.paste"), run: () => void this.paste() },
      { id: "share", label: tc("clip.share"), disabled: !finished, reason: why, run: () => void this.shareSession() },
      { id: "clear", label: tc("clip.clear"), disabled: empty, run: () => this.session.clearHistory() },
    ];
  }

  /** The row buttons above the entry line: items 1-5 of the list, for the picked row. */
  rowButtons(row: HistoryItem): MenuItem[] {
    return this.menu(row).slice(0, 5);
  }

  /** Menu with a picked row (R13): the whole list, acting on that row; ☰ and Menu end it with Settings (R15c1), a long
   *  press (`settings` false) shows the nine only. */
  openMenu(item: HistoryItem, settings = true): void {
    const items = this.menu(item);
    this.shell.showMenu(tc("clip.title"), settings ? this.shell.withSettings(items) : items, { remember: false });
  }

  /** A long press on a history row: the same list, on that row, over the history. */
  openRowMenu(item: HistoryItem): void {
    if (item.status !== "done") return;
    this.openMenu(item, false);
  }
}
