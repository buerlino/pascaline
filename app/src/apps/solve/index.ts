// SPDX-License-Identifier: GPL-3.0-or-later
// Placeholder for the Solve app (gorge replaces this module): equation slots only, so the framework builds.
import { slotNames, SlotsState } from "../slots.svelte.ts";
import type { AppHost, AppInstance, AppModule, ViewId } from "../types.ts";
import Root from "./Root.svelte";

export class SolveApp implements AppInstance {
  readonly id = "solve" as const;
  readonly views: readonly ViewId[] = ["symb", "num"];
  readonly busy = false;
  readonly slots = new SlotsState(slotNames("E"));
  private readonly host: AppHost;
  constructor(host: AppHost) {
    this.host = host;
  }
  entryLabel(view: ViewId): string | undefined {
    return view === "symb" ? `${this.slots.names[this.slots.selected]}:` : undefined;
  }
  show(view: ViewId): void {
    if (view === "symb") this.host.setEntry(this.slots.latex[this.slots.selected] ?? "");
  }
  enter(view: ViewId, latex: string): void {
    if (view === "symb") this.slots.set(this.slots.selected, latex);
  }
  restore(): Promise<void> {
    return Promise.resolve();
  }
}

const mod: AppModule<SolveApp> = { create: (host) => new SolveApp(host), Root };
export default mod;
