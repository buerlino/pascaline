// SPDX-License-Identifier: GPL-3.0-or-later
// The app framework: apps beside Home and CAS, each with up to three views (Symb, Plot, Num).
// An app is a lazily loaded module (registry.ts); it gets an AppHost and draws its views with one root
// component. The shell owns the keyboard, the shared entry line and the view switching.
import type { Component } from "svelte";
import type { Calc, CalcSettings, UserName } from "../calc/port.ts";
import type { Kv } from "../state/storage.ts";

export type AppId = "function" | "solve";
export type ViewId = "symb" | "plot" | "num";
export const VIEW_IDS: readonly ViewId[] = ["symb", "plot", "num"];
export type NavDir = "up" | "down" | "left" | "right";

/** What the framework gives an app. */
export interface AppHost {
  readonly calc: Calc;
  /** The calculator settings (digits, angle, format); reactive. */
  readonly settings: CalcSettings;
  readonly kv: Kv;
  /** The user's variables and functions (the stored ones included); reactive. Apps pick the functions out for the parser (R56b). */
  readonly userNames: readonly UserName[];
  /** Put LaTeX on the shared entry line (e.g. the selected slot, to edit it). Marks the line as unedited. */
  setEntry(latex: string): void;
  /** Put text on the clipboard and say so (Copy, docs/04 section 2.6). `notice` replaces the default "Copied". */
  copy(text: string, notice?: string): void;
}

export interface MenuItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Why it is disabled, shown on a second line, once for neighbouring rows with the same reason (already translated;
   *  docs/05 3.1). */
  readonly reason?: string;
  /** A setting's current value, drawn at the right of the row (already translated). Read on every draw. */
  readonly value?: string;
  /** In a list of values: this one is the current one (a mark, and the highlight starts on it). Read on every draw. */
  readonly selected?: boolean;
  /** A setting changed in place: ◀ ▶ step it (-1, +1), and a digit key or a tap steps it forward (docs/05 3.4). Enter
   *  does not step it: it picks the item, which closes the sheet (or opens its submenu). */
  adjust?(by: 1 | -1): void;
  /** Picking the item runs it and the sheet stays open (a switch in a list of switches). */
  readonly keep?: boolean;
  /** Picking the item runs it, or opens this follow-up list in place of the menu (e.g. Intersection: with which?). */
  run?(): void;
  readonly submenu?: SubMenu;
  /** In a grid sheet (the Tmpl palette): the cell drawn as math; `label` is then its spoken name. */
  readonly latex?: string;
  /** In a grid sheet: the key that picks this cell (its id) and its legend, shown on the cell (Shift + 6, R18). */
  readonly pick?: { readonly key: string; readonly legend: string };
}

export interface SubMenu {
  /** Already translated. */
  readonly title: string;
  readonly items: readonly MenuItem[];
}

export interface AppInstance {
  readonly id: AppId;
  /** The views this app has; the keys of the others do nothing. */
  readonly views: readonly ViewId[];
  /** True while one of the app's engine jobs runs (the Cancel key then stops it). */
  readonly busy: boolean;
  /** LaTeX shown before the entry line in this view (e.g. `F_1(x)=`); undefined hides the entry line. */
  entryLabel(view: ViewId): string | undefined;
  /** The view became visible (e.g. load the selected slot into the entry line). */
  show?(view: ViewId): void;
  /** Enter on the entry line, with its content. */
  enter(view: ViewId, latex: string): void;
  /** Arrow keys. `edited`: the entry line differs from the last setEntry. Return true when handled. */
  nav?(view: ViewId, dir: NavDir, edited: boolean): boolean;
  /** What Shift + View copies in this view (the Num table as CSV); undefined: nothing to copy. */
  copyText?(view: ViewId): Promise<string | undefined> | string | undefined;
  /** The view's menu (Menu key), shown on the sheet (docs/05 3.1). */
  menu?(view: ViewId): MenuItem[];
  /** Cancel key while busy: stop the app's own job (default: the math engine's). */
  cancel?(): Promise<void>;
  /** Read the stored state (IndexedDB key `app.<id>`). */
  restore(): Promise<void>;
  /** Write the state now (the page is being hidden). */
  flush?(): void;
}

export interface AppModule<A extends AppInstance> {
  create(host: AppHost): A;
  Root: Component<{ app: A; view: ViewId }>;
}

/** A created app with its root component, as the shell holds it. */
export interface LoadedApp {
  readonly instance: AppInstance;
  readonly Root: Component<{ app: AppInstance; view: ViewId }>;
}

/** Create an app from its module. The one place the root component's props are widened to AppInstance. */
export function instantiate<A extends AppInstance>(m: AppModule<A>, host: AppHost): LoadedApp {
  const instance = m.create(host);
  return { instance, Root: m.Root as unknown as Component<{ app: AppInstance; view: ViewId }> };
}
