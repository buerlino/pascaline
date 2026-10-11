// SPDX-License-Identifier: GPL-3.0-or-later
import { FakeCalc } from "./fake.ts";
import type { Calc } from "./port.ts";

/** The engine the app runs on. */
export function createCalc(): Calc {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("engine") === "fake") return new FakeCalc(Number(q.get("delay") ?? 0));
  }
  throw new Error("engine adapter not connected yet");
}
