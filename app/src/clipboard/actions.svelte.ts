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

export class ClipActions {
  /** The short message on screen ("Copied"), or null. */
  notice = $state<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly session: Session;
  private readonly shell: AppShell;
  private readonly entry: EntryController;
  private readonly givenPort: ClipboardPort | undefined;
  private readonly decimalComma: () => boolean;

  /** `decimalComma`: the decimal comma setting (docs/04 section 6.2); not a setting yet. */
  constructor(session: Session, shell: AppShell, entry: EntryController, port?: ClipboardPort, decimalComma: () => boolean = () => false) {
    this.session = session;
    this.shell = shell;
    this.entry = entry;
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

  /** The Home/CAS Menu (docs/04 section 5.1), or the actions of one history row. */
  menu(row?: HistoryItem): MenuItem[] {
    const i = this.target(row);
    const none = i === undefined;
    const copies: MenuItem[] = [
      { id: "copy", label: tc("clip.copy"), disabled: none, run: () => void this.copy(row) },
      { id: "shown", label: tc("clip.asShown"), disabled: none, run: () => void this.copyShown(row) },
      { id: "exact", label: tc("clip.exact"), disabled: none || copyExact(i) === undefined, run: () => void this.copyExact(row) },
      { id: "latex", label: tc("clip.latex"), disabled: none, run: () => void this.copyLatex(row) },
    ];
    if (row) return copies;
    const finished = this.session.items.some((x) => x.status === "done" || x.status === "error");
    return [
      ...copies,
      { id: "paste", label: tc("clip.paste"), run: () => void this.paste() },
      { id: "share", label: tc("clip.share"), disabled: !finished, run: () => void this.shareSession() },
      { id: "clear", label: tc("clip.clear"), disabled: this.session.items.length === 0, run: () => this.session.clearHistory() },
    ];
  }

  /** A long press on a history row: its copy actions, over the history. */
  openRowMenu(item: HistoryItem): void {
    if (item.status !== "done") return;
    this.shell.showMenu(tc("clip.rowTitle"), this.menu(item));
  }
}
