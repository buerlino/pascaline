// SPDX-License-Identifier: GPL-3.0-or-later
// The mark a history row draws, from the real engine through EngineCalc and the Session (skipped without a Giac build).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { MathEngine } from "../engine/types.ts";
import { Session, type HistoryItem } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

const noKv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

/** The parts of MathEngine a Home or CAS entry uses, answered in-process by an EngineHost (no worker). */
function inProcess(host: EngineHost): MathEngine {
  const engine: Pick<MathEngine, "home" | "cas"> = {
    home: (input, s) => Promise.resolve(host.home(input, s).result),
    cas: (input, s) => Promise.resolve(host.cas(input, s).result),
  };
  return engine as MathEngine;
}

describe.skipIf(!giacAvailable())("history marks from the real engine", () => {
  let calc: EngineCalc;
  beforeAll(async () => {
    calc = new EngineCalc(inProcess(new EngineHost((await loadNodeGiac()).giac)));
  });

  const markIn = async (view: "home" | "cas", giac: string): Promise<string | null> => {
    const s = new Session(calc, noKv);
    s.setView(view);
    await s.submit(giac, giac);
    const item = (view === "home" ? s.home : s.cas)[0] as HistoryItem;
    expect(item.status, giac).toBe("done");
    return s.mark(item)?.mark ?? null;
  };

  // G27 (F36, docs/04 2.3 #17): a result that is not a number but holds a float gets ⚠ in both views.
  it("a non-number with a float in it is ⚠ in Home and CAS (G27)", async () => {
    for (const i of ["evalf(x+sin(10^22))", "evalf(x^2-2=0)", "evalf([1/3,x])"]) {
      expect(await markIn("home", i), `home ${i}`).toBe("⚠");
      expect(await markIn("cas", i), `cas ${i}`).toBe("⚠");
    }
  });

  it("an exact non-number has no mark, and a float number keeps its own (guards)", async () => {
    for (const i of ["x+1/3", "factor(x^2-1)"]) {
      expect(await markIn("home", i), `home ${i}`).toBeNull();
      expect(await markIn("cas", i), `cas ${i}`).toBeNull();
    }
    expect(await markIn("home", "evalf(sqrt(2))")).toBe("≈");
    expect(await markIn("cas", "evalf(sqrt(2))")).toBe("≈");
  });
});
