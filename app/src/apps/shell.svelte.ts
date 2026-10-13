// SPDX-License-Identifier: GPL-3.0-or-later
// Which app and view is on screen, and the apps loaded so far. Home and CAS stay in Session; this adds the
// apps beside them. App code loads on first use (registry.ts); the open app and view are stored like the
// settings, so the calculator comes back where it was.
import type { Calc, CalcSettings } from "../calc/port.ts";
import { t } from "../i18n/index.ts";
import type { Kv } from "../state/storage.ts";
import { Sheet, type Picked } from "../views/sheet.svelte.ts";
import { APPS, appEntry, isAppId } from "./registry.ts";
import { VIEW_IDS, type AppHost, type AppId, type AppInstance, type LoadedApp, type MenuItem, type NavDir, type ViewId } from "./types.ts";

/** The entry line as the shell sees it (EntryController in the app, a stub in tests). */
export interface EntryLine {
  readonly value: string;
  set(latex: string): void;
  clear(): void;
}

interface Place {
  app: AppId | null;
  view: ViewId;
}

export class AppShell {
  /** The open app, or null for Home/CAS. */
  app = $state<AppId | null>(null);
  view = $state<ViewId>("symb");
  /** Loaded apps (raw: instances keep their own reactive state). */
  loaded = $state.raw<Partial<Record<AppId, LoadedApp>>>({});
  /** The open sheet (docs/05 3.1): the Apps list, a view's Menu, or a list such as a history row's actions. */
  sheet = $state.raw<Sheet | null>(null);
  /** Set while an app's code is loading (the view shows a short note). */
  loading = $state<AppId | null>(null);

  /** Copy, paste and share (set by App.svelte); apps reach it through AppHost.copy. */
  clip: { copyRaw(text: string | undefined, notice?: string): Promise<boolean> } | undefined;
  /** The Menu of Home and CAS (set by App.svelte); the apps bring their own. */
  homeMenu: (() => MenuItem[]) | undefined;

  private readonly calc: Calc;
  private readonly kv: Kv;
  private readonly entry: EntryLine;
  private readonly settings: () => CalcSettings;
  /** What the app last put on the entry line (to tell "edited" from "as loaded"). */
  private entryBase = "";
  private pending = new Map<AppId, Promise<LoadedApp>>();

  constructor(calc: Calc, kv: Kv, entry: EntryLine, settings: () => CalcSettings) {
    this.calc = calc;
    this.kv = kv;
    this.entry = entry;
    this.settings = settings;
  }

  get current(): LoadedApp | undefined {
    return this.app ? this.loaded[this.app] : undefined;
  }
  get instance(): AppInstance | undefined {
    return this.current?.instance;
  }
  /** The entry line belongs to the open view (undefined label = no entry line, e.g. Plot). */
  get entryLabel(): string | undefined {
    const a = this.instance;
    return a ? a.entryLabel(this.view) : undefined;
  }
  get showsEntry(): boolean {
    return this.app === null || this.entryLabel !== undefined;
  }
  get entryEdited(): boolean {
    return this.entry.value !== this.entryBase;
  }

  private host(): AppHost {
    const self = this;
    return {
      calc: this.calc,
      kv: this.kv,
      get settings() {
        return self.settings();
      },
      setEntry: (latex: string) => {
        this.entryBase = latex;
        this.entry.set(latex);
      },
      copy: (text: string, notice?: string) => void this.clip?.copyRaw(text, notice),
    };
  }

  /** Load (once) and restore an app. */
  load(id: AppId): Promise<LoadedApp> {
    const have = this.loaded[id];
    if (have) return Promise.resolve(have);
    let p = this.pending.get(id);
    if (!p) {
      p = appEntry(id)
        .load(this.host())
        .then(async (l) => {
          await l.instance.restore();
          this.loaded = { ...this.loaded, [id]: l };
          return l;
        });
      this.pending.set(id, p);
    }
    return p;
  }

  /** Open an app at a view (default: the view it was left in, else Symb). */
  open(id: AppId, view?: ViewId): Promise<void> {
    this.opening = this.doOpen(id, view);
    return this.opening;
  }
  /** Settles when the app being opened is on screen (keys pressed meanwhile wait for it). */
  opening: Promise<void> = Promise.resolve();
  private async doOpen(id: AppId, view?: ViewId): Promise<void> {
    this.sheet = null;
    this.loading = id;
    this.app = id;
    try {
      const l = await this.load(id);
      if (this.app !== id) return;
      const v = view ?? (l.instance.views.includes(this.view) ? this.view : (l.instance.views[0] as ViewId));
      this.showView(l.instance, v);
    } finally {
      if (this.loading === id) this.loading = null;
    }
  }

  /** Symb / Plot / Num key. From Home or CAS it opens the last app (Function by default). */
  async setView(v: ViewId): Promise<void> {
    this.sheet = null;
    if (this.app === null || this.loading !== null) return this.open(this.app ?? this.lastApp ?? "function", v);
    const a = this.instance;
    if (!a || !a.views.includes(v)) return;
    this.showView(a, v);
  }

  private showView(a: AppInstance, v: ViewId): void {
    if (this.view !== v || this.entryBase !== "" || this.entry.value !== "") {
      this.entryBase = "";
      this.entry.clear();
    }
    this.view = v;
    this.save();
    a.show?.(v);
  }

  /** Back to Home/CAS (the Home/CAS key from inside an app). */
  close(): void {
    if (this.app !== null) this.lastApp = this.app;
    this.app = null;
    this.sheet = null;
    this.entryBase = "";
    this.save();
  }
  lastApp: AppId | null = null;

  // ---- keys routed to the app
  enter(latex: string): void {
    const a = this.instance;
    if (a) a.enter(this.view, latex);
  }
  nav(dir: NavDir): boolean {
    const a = this.instance;
    return a?.nav?.(this.view, dir, this.entryEdited) ?? false;
  }
  /** The open view's own Menu items (Home/CAS: the copy actions). */
  get menuItems(): readonly MenuItem[] {
    return (this.app === null ? this.homeMenu?.() : this.instance?.menu?.(this.view)) ?? [];
  }
  /** What Copy (Shift + View) takes from the open app view; undefined when it has nothing to copy. */
  copyText(): Promise<string | undefined> | string | undefined {
    return this.instance?.copyText?.(this.view);
  }

  // ---- sheets (docs/05 3.1)
  get switcherOpen(): boolean {
    return this.sheet?.id === "apps";
  }
  get menuOpen(): boolean {
    return this.sheet !== null && this.sheet.id !== "apps" && this.sheet.id !== "tmpl";
  }
  /** Apps key: the Apps sheet, or close it when it is open. */
  toggleApps(): void {
    if (this.switcherOpen) this.sheet = null;
    else this.sheet = new Sheet("apps", t("apps.title"), () => APPS.map((a) => ({ id: a.id, label: t(a.name), run: () => void this.open(a.id) })));
  }
  /** Menu key: the open view's menu, or close the open sheet. False when the view has no menu (a dead key). */
  toggleMenu(): boolean {
    if (this.menuOpen) {
      this.sheet = null;
      return true;
    }
    const place = this.app === null ? "home" : `${this.app}:${this.view}`;
    this.sheet = this.menuItems.length > 0 ? new Sheet(`menu:${place}`, t("menu.title"), () => this.menuItems) : null;
    return this.sheet !== null;
  }
  /** Open a list of items over the view (a long press on a history row): same sheet and keys as the Menu key. */
  showMenu(title: string, items: readonly MenuItem[], opts?: { remember?: boolean; at?: string }): void {
    this.sheet = new Sheet(`list:${title}`, title, () => items, opts);
  }
  /** Tmpl key: the template palette (a grid sheet, R10), or close it when it is open. */
  toggleTemplates(items: () => readonly MenuItem[], columns: number): void {
    if (this.sheet?.id === "tmpl") this.sheet = null;
    else this.sheet = new Sheet("tmpl", t("tmpl.title"), items, { columns });
  }
  closeSheet(): void {
    this.sheet = null;
  }
  /** Carry out a pick of the open sheet: a chosen item closes the sheet, then runs. */
  picked(p: Picked): void {
    if (p.kind !== "run") return;
    this.sheet = null;
    p.item.run?.();
  }
  /** Pick the item numbered n (1…10) of the open sheet; false when there is no such item or it is disabled. */
  pick(n: number): boolean {
    const s = this.sheet;
    if (!s) return false;
    const depth = s.depth;
    const p = s.pickNumber(n);
    this.picked(p);
    return p.kind === "run" || s.depth !== depth;
  }
  get busy(): boolean {
    return Object.values(this.loaded).some((l) => l.instance.busy);
  }
  /** Cancel key: close an open list, else stop a running app job. False when there was nothing to stop. */
  async cancel(): Promise<boolean> {
    if (this.sheet) {
      this.sheet = null;
      return true;
    }
    if (!this.busy) return false;
    const own = Object.values(this.loaded).find((l) => l.instance.busy && l.instance.cancel);
    await (own?.instance.cancel ? own.instance.cancel() : this.calc.cancel());
    return true;
  }
  flush(): void {
    for (const l of Object.values(this.loaded)) l.instance.flush?.();
  }

  // ---- persistence
  private save(): void {
    void this.kv.set("place", { app: this.app, view: this.view } satisfies Place);
  }
  /** The stored place; the app itself loads later (after the keypad), see main.ts. */
  async restorePlace(): Promise<AppId | null> {
    const p = await this.kv.get<Partial<Place>>("place");
    if (p && VIEW_IDS.includes(p.view as ViewId)) this.view = p.view as ViewId;
    if (p && isAppId(p.app)) return p.app;
    return null;
  }
}
