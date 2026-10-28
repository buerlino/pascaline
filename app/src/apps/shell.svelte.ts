// SPDX-License-Identifier: GPL-3.0-or-later
// Which app and view is on screen, and the apps loaded so far. Home and CAS stay in Session; this adds the
// apps beside them. App code loads on first use (registry.ts); the open app and view are stored like the
// settings, so the calculator comes back where it was.
import type { Calc, CalcSettings, UserName } from "../calc/port.ts";
import { t } from "../i18n/index.ts";
import type { Kv } from "../state/storage.ts";
import type { IconId } from "../views/icons.ts";
import { Sheet, type Picked } from "../views/sheet.svelte.ts";
import { APPS, appEntry, isAppId, placeGlyph } from "./registry.ts";
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

/** The palettes' sheet ids: Tmpl (R10), Shift + 6 and Shift + 9 (R18). Also their i18n prefix (`<id>.title`). */
export type PaletteId = "tmpl" | "rel" | "sym";
const PALETTE_IDS: readonly string[] = ["tmpl", "rel", "sym"] satisfies PaletteId[];

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
  /** Opens the Settings page (set by App.svelte); the last row of every Menu (R15c1). */
  openSettings: (() => void) | undefined;
  /** Which of Home and CAS is under the keys (set by App.svelte); names the Menu there (R83). */
  homeView: (() => "home" | "cas") | undefined;

  private readonly calc: Calc;
  private readonly kv: Kv;
  private readonly entry: EntryLine;
  private readonly settings: () => CalcSettings;
  private readonly userNames: () => readonly UserName[];
  /** What the app last put on the entry line (to tell "edited" from "as loaded"). */
  private entryBase = "";
  private pending = new Map<AppId, Promise<LoadedApp>>();

  constructor(calc: Calc, kv: Kv, entry: EntryLine, settings: () => CalcSettings, userNames: () => readonly UserName[] = () => []) {
    this.calc = calc;
    this.kv = kv;
    this.entry = entry;
    this.settings = settings;
    this.userNames = userNames;
  }

  get current(): LoadedApp | undefined {
    return this.app ? this.loaded[this.app] : undefined;
  }
  get instance(): AppInstance | undefined {
    return this.current?.instance;
  }
  /** The views the open app has (the status line's tabs); all three while its code is still loading. */
  get views(): readonly ViewId[] {
    return this.instance?.views ?? VIEW_IDS;
  }
  /** The entry line belongs to the open view (undefined label = no entry line, e.g. Plot). */
  get entryLabel(): string | undefined {
    const a = this.instance;
    return a ? a.entryLabel(this.view) : undefined;
  }
  get showsEntry(): boolean {
    // While an app's code loads its views are unknown: the line stays (hiding it would blur the field, and keys typed
    // meanwhile would find no focus once the app is warm and shows at once); Plot, once known, hides it.
    if (this.app !== null && !this.instance && this.loading !== null) return this.view !== "plot";
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
      get userNames() {
        return self.userNames();
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

  /** Back to Home/CAS (the place name, U2, U3 or the Apps sheet from inside an app). */
  close(): void {
    if (this.app !== null) this.lastApp = this.app;
    this.app = null;
    this.sheet = null;
    // What the app put on the line (a value, a root, an equation) stays with the app; only the user's typing follows (R34, R76).
    if (!this.entryEdited) this.entry.clear();
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
  /** The open view's own Menu items (Home/CAS: the copy actions), then Settings as the last row (R15c1). */
  get menuItems(): readonly MenuItem[] {
    const own = this.app === null ? this.homeMenu?.() : this.instance?.menu?.(this.view);
    return this.withSettings(own && own.length > 0 ? own : this.pointer());
  }
  /** R83: a view whose Menu has no rows of its own gets one row naming the view that has them; it switches there and
   *  opens that Menu on its first row. Nothing when the view has rows, or no view has. */
  private pointer(): MenuItem[] {
    const a = this.instance;
    if (this.app === null || !a?.menu) return [];
    for (const v of a.views) {
      const rows = v === this.view ? [] : a.menu(v);
      if (rows.length === 0) continue;
      const [x, y] = rows;
      const low = (s: string): string => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      const labels = `${x?.label ?? ""}${y ? `, ${low(y.label)}` : ""} …`;
      return [
        {
          id: `in-${v}`,
          label: t("menu.inView", { labels, view: t(`view.${v}`) }),
          run: () => void this.setView(v).then(() => this.toggleMenu({ at: x?.id })),
        },
      ];
    }
    return [];
  }
  /** The Menu's title: the view whose Menu it is, and that view's icon. */
  get menuTitle(): { text: string; icon: IconId } {
    const v = this.app === null ? (this.homeView?.() ?? "home") : this.view;
    return { text: t("menu.title", { view: t(`view.${v}`) }), icon: v };
  }
  /** A Menu list with Settings as its last row. */
  withSettings(own: readonly MenuItem[]): MenuItem[] {
    return [...own, { id: "settings", label: t("mode.settings"), run: () => this.openSettings?.() }];
  }
  /** What the Copy key takes from the open app view; undefined when it has nothing to copy. */
  copyText(): Promise<string | undefined> | string | undefined {
    return this.instance?.copyText?.(this.view);
  }

  // ---- sheets (docs/05 3.1)
  get switcherOpen(): boolean {
    return this.sheet?.id === "apps";
  }
  get menuOpen(): boolean {
    return this.sheet !== null && this.sheet.id !== "apps" && !this.paletteOpen;
  }
  /** One of the palettes is open: Tmpl, or the Shift palettes `rel` and `sym` (R18). */
  get paletteOpen(): boolean {
    return this.sheet !== null && PALETTE_IDS.includes(this.sheet.id);
  }
  /** Home and CAS, the first two rows of the Apps sheet (S2 point 4, R15b): set by the app shell (App.svelte). */
  goTo: ((view: "home" | "cas") => void) | undefined;
  /** Apps key: the Apps sheet (1 Home, 2 CAS, then the apps), or close it when it is open. */
  toggleApps(): void {
    if (this.switcherOpen) this.sheet = null;
    else
      this.sheet = new Sheet("apps", t("apps.title"), () => [
        ...(["home", "cas"] as const).map((v) => ({ id: v, label: t(`view.${v}`), glyph: placeGlyph(v), run: () => this.goTo?.(v) })),
        ...APPS.map((a) => ({ id: a.id, label: t(a.name), glyph: a.glyph, run: () => void this.open(a.id) })),
      ]);
  }
  /** Menu key: the open view's menu, or close the open sheet. False when the view has no menu (a dead key). */
  toggleMenu(opts?: { at?: string }): boolean {
    if (this.menuOpen) {
      this.sheet = null;
      return true;
    }
    const place = this.app === null ? "home" : `${this.app}:${this.view}`;
    this.sheet = this.menuItems.length > 0 ? new Sheet(`menu:${place}`, this.menuTitle.text, () => this.menuItems, { icon: this.menuTitle.icon, at: opts?.at }) : null;
    return this.sheet !== null;
  }
  /** Open a list of items over the view (a long press on a history row): same sheet and keys as the Menu key. */
  showMenu(title: string, items: readonly MenuItem[], opts?: { remember?: boolean; at?: string }): void {
    this.sheet = new Sheet(`list:${title}`, title, () => items, opts);
  }
  /** Find (R4a): its categories, searched by the letters typed (Sheet id "find"; route.ts gives it docs/04 3.7's keys). */
  showFind(title: string, categories: readonly MenuItem[], search: (q: string) => readonly MenuItem[]): void {
    this.sheet = new Sheet("find", title, () => categories, { search, remember: false });
  }
  /** A palette on the grid sheet: Tmpl (R10; its key closes it again), Shift + 6 `rel` and Shift + 9 `sym` (R18; the
   *  digits pick inside those, so only Esc and Cancel close them). Each opens on its last pick. */
  togglePalette(id: PaletteId, title: string, items: () => readonly MenuItem[], columns: number): void {
    if (this.sheet?.id === id) this.sheet = null;
    else this.sheet = new Sheet(id, title, items, { columns });
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
