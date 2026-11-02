// SPDX-License-Identifier: GPL-3.0-or-later
// R24cf1: the unit view drops a result that arrives after a slot has changed (72 km/h → m/s, Enter, then km made into m
// while Working shows: the old 20 m/s must not show next to 72 m/h). R118: ⌫ on an empty slot steps back (dead on the
// first), and More… then Find closed without a pick leaves the view as it was.
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue, type PadAction } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";
import { UnitView, type ViewHost } from "./view.ts";

const unit = (id: string, title: string, si: string, dim: string): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit", names: [id], title, tier: 0, insert: `\\unit{${id}}{\\mathrm{${id}}}`, si, dim });
const CAT = slotCatalogue([
  unit("m", "Meter", "1", "m1"), unit("km", "Kilometer", "1000", "m1"), unit("s", "Second", "1", "s1"), unit("h", "Hour", "3600", "s1"),
  { id: "pfx:k", kind: "pfx", names: ["k"], title: "Kilo (10^3)", tier: 0, insert: "\\pfx{k}{\\mathrm{k}}", si: "1000" },
]);
const U = (id: string): PadAction => ({ do: "unit", id });

/** A host whose evaluations resolve only when the test says so. */
function host(): { host: ViewHost; requests: UnitRequest[]; answer: (q: Quantity | UnitError) => void; dead: () => number; finds: (string | undefined)[] } {
  const requests: UnitRequest[] = [];
  const pending: ((q: Quantity | UnitError) => void)[] = [];
  const finds: (string | undefined)[] = [];
  let dead = 0;
  return {
    requests,
    finds,
    dead: () => dead,
    answer: (q) => pending.shift()?.(q),
    host: {
      write: () => {},
      evaluate: (req) => {
        requests.push(req);
        return new Promise((resolve) => pending.push(resolve));
      },
      find: (_into, dim) => void finds.push(dim),
      format: () => ({ format: "STD", digits: 12 }),
      alternatives: () => Promise.resolve([]),
      remember: () => Promise.resolve(),
      dead: () => void dead++,
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

describe("UnitView: ⌫ on an empty slot steps back, as ⌫ at the start of a box on the entry line (R118, bu-11)", () => {
  const P = (id: string): PadAction => ({ do: "prefix", id });
  const DEL = { do: "delete" } as const;
  /** "1 + 2" with k m typed in the first slot, Enter: the second slot is active and empty. */
  function second(): { view: UnitView; h: ReturnType<typeof host> } {
    const h = host();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    for (const e of [P("k"), U("m"), { do: "next" } as const]) view.apply(e);
    expect(view.activeId).toBe("u2");
    return { view, h };
  }

  it("on an empty slot that is not the first: to the slot before, which keeps its tokens; the next ⌫ removes its last", () => {
    const { view, h } = second();
    view.apply(DEL);
    expect(view.activeId).toBe("u1");
    expect(view.model("u1")?.slot).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    expect(h.dead()).toBe(0);
    view.apply(DEL);
    expect(view.model("u1")?.slot).toEqual({ tokens: [] });
    expect(view.model("u1")?.armed).toEqual({ prefix: "k", sqrt: false });
    expect(view.reading.text).toBe("");
  });

  it("from the empty end slot too", () => {
    const { view } = second();
    view.apply({ do: "next" });
    expect(view.activeId).toBe("end");
    view.apply(DEL);
    expect(view.activeId).toBe("u2");
    view.apply(DEL);
    expect(view.activeId).toBe("u1");
  });

  it("on the first slot, empty: a dead key (the pulse), and nothing else changes", () => {
    const { view, h } = second();
    view.apply(DEL);
    view.apply(DEL);
    view.apply(DEL); // the armed k
    expect(view.model("u1")?.empty).toBe(true);
    expect(h.dead()).toBe(0);
    const shown = view.shown;
    view.apply(DEL);
    expect(h.dead()).toBe(1);
    expect(view.activeId).toBe("u1");
    expect(view.shown).toBe(shown);
  });

  it("a step back does not drop a running evaluation (no slot changed)", async () => {
    const h = host();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    for (const e of [U("km"), { do: "per" } as const, U("h"), { do: "next" } as const]) view.apply(e);
    const done = view.evaluate();
    view.apply(DEL); // the end slot is empty: back to u1
    expect(view.activeId).toBe("u1");
    h.answer(RESULT);
    await done;
    expect(view.shown).toMatchObject({ kind: "result", text: "20" });
  });
});

describe("UnitView: More… keeps the result until a unit is picked (R118, vr-8)", () => {
  async function shownResult(): Promise<{ view: UnitView; h: ReturnType<typeof host> }> {
    const { view, h, done } = await running();
    h.answer(RESULT);
    await done;
    expect(view.shown.kind).toBe("result");
    return { view, h };
  }

  it("opens Find on the dimension and leaves the value line, the end slot and the active slot as they were", async () => {
    const { view, h } = await shownResult();
    const shown = view.shown;
    view.more("m1s-1");
    expect(h.finds).toEqual(["m1s-1"]);
    expect(view.shown).toBe(shown);
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    expect(view.activeId).toBe("end");
  });

  it("Find closed without a pick: the next pad press is an ordinary press, not a pick (the end slot is not cleared)", async () => {
    const { view, h } = await shownResult();
    view.more("m1s-1");
    view.move(-1);
    view.apply(U("h"));
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    expect(view.model("u1")?.slot.tokens).toHaveLength(3);
    expect(h.requests).toHaveLength(1);
  });

  it("a pick replaces the end slot, makes it active and evaluates", async () => {
    const { view, h } = await shownResult();
    view.move(-1);
    view.more("m1s-1");
    view.pickMore(U("km"));
    expect(view.activeId).toBe("end");
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "km" }] });
    expect(h.requests).toHaveLength(2);
    expect(view.shown).toEqual({ kind: "working" });
  });

  it("a pick of a prefix and a unit evaluates once the slot is whole", async () => {
    const { view, h } = await shownResult();
    view.more("m1s-1");
    view.pickMore({ do: "prefix", id: "k" });
    expect(view.model("end")?.empty).toBe(false);
    expect(h.requests).toHaveLength(1);
    view.pickMore(U("m"));
    expect(view.model("end")?.slot).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    expect(h.requests).toHaveLength(2);
  });
});
