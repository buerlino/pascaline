// SPDX-License-Identifier: GPL-3.0-or-later
// R24cf1: the unit view drops a result that arrives after a slot has changed (72 km/h → m/s, Enter, then km made into m
// while Working shows: the old 20 m/s must not show next to 72 m/h).
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue, type PadAction } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";
import { UnitView, type ViewHost } from "./view.ts";

const unit = (id: string, title: string, si: string, dim: string): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit", names: [id], title, tier: 0, insert: `\\unit{${id}}{\\mathrm{${id}}}`, si, dim });
const CAT = slotCatalogue([
  unit("m", "Meter", "1", "m1"), unit("km", "Kilometer", "1000", "m1"), unit("s", "Second", "1", "s1"), unit("h", "Hour", "3600", "s1"),
]);
const U = (id: string): PadAction => ({ do: "unit", id });

/** A host whose evaluations resolve only when the test says so. */
function host(): { host: ViewHost; requests: UnitRequest[]; answer: (q: Quantity | UnitError) => void } {
  const requests: UnitRequest[] = [];
  const pending: ((q: Quantity | UnitError) => void)[] = [];
  return {
    requests,
    answer: (q) => pending.shift()?.(q),
    host: {
      write: () => {},
      evaluate: (req) => {
        requests.push(req);
        return new Promise((resolve) => pending.push(resolve));
      },
      find: () => {},
      dead: () => {},
      changed: () => {},
    },
  };
}

const RESULT = { value: { display: "20", approximate: false }, unit: "m/s" } as unknown as Quantity;

/** 72 km/h → m/s, Enter in the end slot: the evaluation is running. */
async function running(): Promise<{ view: UnitView; h: ReturnType<typeof host>; done: Promise<void> }> {
  const h = host();
  const view = new UnitView(CAT, "72", {}, h.host);
  view.start();
  for (const e of [U("km"), { do: "per" } as const, U("h"), { do: "next" } as const, U("m"), { do: "per" } as const, U("s")]) view.apply(e);
  expect(view.activeId).toBe("end");
  const done = view.next();
  expect(view.shown).toEqual({ kind: "working" });
  expect(h.requests).toHaveLength(1);
  return { view, h, done };
}

describe("UnitView: a result that arrives after a slot changed", () => {
  it("shows the result when nothing changed while it ran", async () => {
    const { view, h, done } = await running();
    h.answer(RESULT);
    await done;
    expect(view.shown).toMatchObject({ kind: "result", text: "20", unit: "m/s" });
  });

  it("shows nothing when a slot changed while Working showed (km made into m)", async () => {
    const { view, h, done } = await running();
    view.move(-1);
    expect(view.activeId).toBe("u1");
    view.apply({ do: "delete" });
    view.apply({ do: "delete" });
    view.apply({ do: "delete" });
    view.apply(U("m"));
    view.apply({ do: "per" });
    view.apply(U("h"));
    expect(view.model("u1")?.latex).not.toContain("km");
    h.answer(RESULT);
    await done;
    expect(view.shown).toEqual({ kind: "none" });
  });

  it("shows nothing when the first slot change is a pick from Find", async () => {
    const { view, h, done } = await running();
    view.apply(U("km")); // a pick from Find comes back through apply's default branch
    h.answer(RESULT);
    await done;
    expect(view.shown).toEqual({ kind: "none" });
  });

  it("shows nothing when a refused press changed what is shown while it ran", async () => {
    const { view, h, done } = await running();
    view.apply({ do: "power", n: 2 });
    view.apply({ do: "power", n: 2 });
    h.answer(RESULT);
    await done;
    expect(view.shown.kind).not.toBe("result");
  });
});
