// SPDX-License-Identifier: GPL-3.0-or-later
import { EngineCalc } from "./engine.ts";
import { FakeCalc } from "./fake.ts";
import type { Calc } from "./port.ts";

/** The engine the app runs on. The fake engine (dev server only, ?engine=fake[&delay=ms]) echoes its input. */
export function createCalc(): Calc {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("engine") === "fake") return new FakeCalc(Number(q.get("delay") ?? 0));
  }
  return new EngineCalc();
}
