// SPDX-License-Identifier: GPL-3.0-or-later
// The app framework: apps beside Home and CAS, each with up to three views (Symb, Plot, Num).
// An app is a lazily loaded module (registry.ts); it gets an AppHost and draws its views with one root
// component. The shell owns the keyboard, the shared entry line and the view switching.
import type { Component } from "svelte";
import type { Calc, CalcSettings } from "../calc/port.ts";
import type { Kv } from "../state/storage.ts";

export type AppId = "function" | "solve" | "python";
export type ViewId = "symb" | "plot" | "num";
export const VIEW_IDS: readonly ViewId[] = ["symb", "plot", "num"];
export type NavDir = "up" | "down" | "left" | "right";

/** What the framework gives an app. */
export interface AppHost {
  readonly calc: Calc;
  /** The calculator settings (digits, angle, format); reactive. */
  readonly settings: CalcSettings;
  readonly kv: Kv;
  /** Put LaTeX on the shared entry line (e.g. the selected slot, to edit it). Marks the line as unedited. */
  setEntry(latex: string): void;
  /** Switch to one of the app's views (e.g. Python: Run shows the shell). */
  showView(view: ViewId): void;
}

/** Keys for an app view with its own text input (Python editor and shell) instead of the entry line. */
export type TextInput = { kind: "text"; text: string } | { kind: "cmd"; name: string } | { kind: "enter" };

export interface MenuItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  readonly disabled?: boolean;
  run(): void;
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
  /** The view's menu (Menu key or the header button). Items are picked by tap or digit key. */
  menu?(view: ViewId): MenuItem[];
  /** The tab name of a view (default: Symb, Plot, Num). */
  viewLabel?(view: ViewId): string;
  /** True when the view takes keys as text (TextInput) instead of using the shared entry line. */
  takesText?(view: ViewId): boolean;
  /** A key for a view that takes text. */
  input?(view: ViewId, key: TextInput): void;
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
