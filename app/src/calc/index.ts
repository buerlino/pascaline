// SPDX-License-Identifier: GPL-3.0-or-later
import { EngineCalc } from "./engine.ts";
import { WorkerEngine } from "../engine/workerEngine.ts";
import { idbKv } from "../state/storage.ts";
import { FakeCalc } from "./fake.ts";
import type { Calc } from "./port.ts";
import type { IndexItem } from "../find/types.ts";

/** The engine the app runs on. The fake engine (dev server only, ?engine=fake[&delay=ms]) echoes its input. */
export function createCalc(): Calc {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("engine") === "fake") return new FakeCalc(Number(q.get("delay") ?? 0));
  }
  // The definitions log is kept in IndexedDB (docs/04 6.2), so variables survive a relaunch.
  // The unit view's factors come from the Find index (docs/04 4.2), fetched on the first units() call (G16, R24c).
  const findIndex = (): Promise<readonly IndexItem[]> => import("../find/finder.ts").then((m) => m.loadIndex(true)).then((ix) => ix.items);
  return new EngineCalc(new WorkerEngine({ defs: { load: () => idbKv.get<unknown>("defs"), save: (log) => void idbKv.set("defs", log), loadStarts: async () => (await idbKv.get<number>("defsStarts")) ?? 0, saveStarts: (n) => void idbKv.set("defsStarts", n) } }), { findIndex });
}
