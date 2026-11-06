// SPDX-License-Identifier: GPL-3.0-or-later
// R97: the lazy loaders of App.svelte, out of it: the Mode and Settings lists (R35), Find with its index (R4a) and the
// copy, paste and share actions (docs/04 2.6). None of them is in the start chunk; each loads when the browser is idle
// once the engine is ready (App.svelte schedules that), or on the first use. The state is the loaders' own (plain
// variables, not reactive); what the template draws from the clipboard code, App.svelte keeps through `onClip`.
import type { AppShell } from "./apps/shell.svelte.ts";
import type { ClipActions } from "./clipboard/actions.svelte.ts";
import type { EntryController } from "./entry/controller.ts";
import type { HistoryItem, Session } from "./state/session.svelte.ts";

export type ModeSheetCode = typeof import("./views/modeSheet.ts");
export type FindCode = { m: typeof import("./find/finder.ts"); index: import("./find/finder.ts").FindIndex };

export interface LoaderDeps {
  readonly session: Session;
  readonly shell: AppShell;
  readonly entry: EntryController;
  /** A job runs: the idle preparing of the Find index gives way to it. */
  readonly busy: () => boolean;
  /** A tapped or picked result goes on the entry line (the clipboard code's `insert`). */
  readonly insertResult: (item: HistoryItem) => void;
  /** The clipboard code has arrived. */
  readonly onClip: (clip: ClipActions) => void;
}

export function createLoaders(d: LoaderDeps) {
  let clipLoading: Promise<ClipActions> | undefined;
  /** The loaded code, read by App.svelte at each key (null until it is in). */
  const l = {
    modeSheet: null as ModeSheetCode | null,
    findCode: null as FindCode | null,
    findLoading: null as Promise<FindCode> | null,
    /** The Mode and Settings lists load when idle after the keypad is drawn, or on the first open (R35). */
    loadModeSheet: async (): Promise<ModeSheetCode> => (l.modeSheet ??= await import("./views/modeSheet.ts")),
    /** `urgent` (a Math press): an idle load under way prepares the rest of the index at once (finder.ts). */
    loadFind: (urgent = false): Promise<FindCode> =>
      (l.findLoading ??= import("./find/finder.ts")
        .then(async (m) => {
          m.pauseWhile(d.busy); // the idle preparing gives way to a running job
          return (l.findCode = { m, index: await m.loadIndex(urgent) });
        })
        .catch((e: unknown) => {
          l.findLoading = null; // a later Math press tries again
          throw e;
        })),
    /** Copy, paste and share: the shell reaches them for the apps (AppHost.copy) and for the Home/CAS Menu. */
    loadClip: (): Promise<ClipActions> =>
      (clipLoading ??= import("./clipboard/actions.svelte.ts").then((m) => {
        const c = new m.ClipActions(d.session, d.shell, d.entry, { insert: d.insertResult, recall: (item) => d.entry.set(d.session.input(item), item.chips) });
        d.shell.clip = c;
        d.shell.homeMenu = () => c.menu();
        d.onClip(c);
        return c;
      })),
  };
  return l;
}
