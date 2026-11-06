// SPDX-License-Identifier: GPL-3.0-or-later
// R98 (fix round 2, audit point 3): when the Undo code of Clear and Delete does not load (a tab open across a redeploy:
// the old hashed chunk is gone), nothing is removed, Delete does not report success, and the history says why.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { ClipActions } from "../clipboard/actions.svelte.ts";
import { t } from "../i18n/index.ts";
import { Session } from "./session.svelte.ts";
import { fakeKv } from "./fakeKv.ts";

vi.mock("./removedRows.ts", () => {
  throw new Error("the chunk is gone");
});

const rows = (s: Session): string[] => s.items.filter((i) => i.status !== "note").map((i) => i.latex);
const notes = (s: Session): string[] => s.items.filter((i) => i.status === "note").map((i) => i.text);

describe("the Undo code does not load (R98)", () => {
  it("Clear takes nothing, resolves false and says so in the view", async () => {
    const s = new Session(new FakeCalc(0), fakeKv());
    await s.restoreHistory();
    for (const x of ["1", "2"]) await s.submit(x);
    expect(await s.clearHistory()).toBe(false);
    expect(rows(s)).toEqual(["1", "2"]);
    expect(notes(s)).toEqual([t("history.notRemoved")]);
    expect(s.cas).toEqual([]); // only in the view it was pressed in
    expect(s.undoCopy).toBeNull();
  });

  it("☰ Delete reports no success and the row stays", async () => {
    const s = new Session(new FakeCalc(0), fakeKv());
    await s.restoreHistory();
    for (const x of ["1", "2"]) await s.submit(x);
    const clip = new ClipActions(s, {} as never, {} as never, { insert: () => {}, recall: () => {} });
    expect(await s.removeItem(s.items[0]!)).toBe(false);
    expect(await clip.deleteRow()).toBe(false);
    expect(rows(s)).toEqual(["1", "2"]);
    expect(notes(s)).toEqual([t("history.notRemoved"), t("history.notRemoved")]);
  });
});
