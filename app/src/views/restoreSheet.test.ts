// SPDX-License-Identifier: GPL-3.0-or-later
// R38b: Settings › Data's rows (Restore from a file; Undo the restore while its kept copy exists) and the restore sheet
// (a summary, one tick per part, Restore / Cancel).
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import { dataText, shownTime } from "../i18n/enData.ts";
import { checkBackup, type CheckedBackup } from "../state/backup.ts";
import { DATA_VERSION, idbKv } from "../state/storage.ts";
import { dataSection, resetUndoTime } from "./dataSection.svelte.ts";
import { offerRestore, offerUndo, partSummary, restoreItems } from "./restoreSheet.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";

const at = (value: unknown): unknown => ({ "@pascaline": DATA_VERSION, value });
const file = {
  "pascaline-backup": 1,
  dataVersion: DATA_VERSION,
  made: "2026-10-20T02:00:00Z",
  parts: {
    settings: at({ angle: "rad", digits: 9, format: "sci" }),
    history: at({ home: [{ latex: "1", status: "done" }, { latex: "2", status: "done" }], cas: [{ latex: "x", status: "error" }] }),
    defs: at([{ name: "A", kind: "var", cmds: ["A:=5"], preview: "5", view: "home", time: 1 }]),
    userKeys: at({ u1: { primary: { label: "Home", action: { special: "home" } } }, u2: { shift: null } }),
  },
};
const checked = (): CheckedBackup => checkBackup(new TextEncoder().encode(JSON.stringify(file))) as CheckedBackup;
const ids = (items: readonly MenuItem[]): string[] => items.map((x) => x.id);
const byId = (items: readonly MenuItem[], id: string): MenuItem => items.find((x) => x.id === id) as MenuItem;

afterEach(() => vi.restoreAllMocks());

describe("the restore sheet", () => {
  it("shows when and by which version, one tick per part (all ticked) with its summary, then Restore and Cancel", () => {
    const items = restoreItems(checked(), () => {});
    expect(ids(items)).toEqual(["made", "settings", "history", "defs", "userKeys", "restore", "cancel"]);
    expect(items[0]?.label).toBe(`Made ${shownTime("2026-10-20T02:00:00Z")} by version ${DATA_VERSION}`);
    for (const k of ["settings", "history", "defs", "userKeys"]) expect(byId(items, k).selected, k).toBe(true);
    expect(byId(items, "history").value).toBe("Home 2 · CAS 1 rows");
    expect(byId(items, "defs").value).toBe("1 definitions");
    expect(byId(items, "settings").value).toBe("RAD · 9 digits · SCI");
    expect(byId(items, "userKeys").value).toBe("2 slots: U1, U2 ⇧");
    expect(byId(items, "history").label).toBe("History");
  });
  it("writes only the ticked parts, then reloads; with none ticked Restore is disabled", async () => {
    const write = vi.fn(async () => {});
    const reload = vi.fn();
    const items = restoreItems(checked(), () => {}, { write, reload });
    const s = new Sheet("restore", "Restore", () => items, { remember: false });
    s.activate(ids(items).indexOf("history")); // a switch: the sheet stays
    s.activate(ids(items).indexOf("userKeys"));
    expect(byId(items, "history").selected).toBe(false);
    const picked = s.activate(ids(items).indexOf("restore"));
    expect(picked.kind).toBe("run");
    if (picked.kind === "run") picked.item.run?.();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(Object.keys((write.mock.calls[0] as unknown as [Record<string, unknown>])[0]).sort()).toEqual(["defs", "settings"]);
    for (const k of ["settings", "defs"]) s.activate(ids(items).indexOf(k));
    expect(byId(items, "restore").disabled).toBe(true);
    expect(byId(items, "restore").reason).toBe(dataText("restore.none"));
  });
  it("a failed write says so, does not reload, and lets the session write again", async () => {
    const said: string[] = [];
    const reload = vi.fn();
    const before = idbKv.set;
    const items = restoreItems(checked(), (m) => said.push(m), { write: async () => Promise.reject(new Error("full")), reload });
    byId(items, "restore").run?.();
    await vi.waitFor(() => expect(said).toEqual([dataText("restore.failed")]));
    expect(reload).not.toHaveBeenCalled();
    expect(idbKv.set).toBe(before);
  });
  it("Cancel writes nothing", () => {
    const write = vi.fn(async () => {});
    byId(restoreItems(checked(), () => {}, { write, reload: () => {} }), "cancel").run?.();
    expect(write).not.toHaveBeenCalled();
  });
  it("a refused file is the notice, and no sheet opens", async () => {
    const said: string[] = [];
    const showMenu = vi.fn();
    const bad = { ...file, parts: { ...file.parts, defs: { "@pascaline": DATA_VERSION + 1, value: [] } } };
    await offerRestore(new File([JSON.stringify(bad)], "b.json"), { showMenu } as unknown as AppShell, (m) => said.push(m));
    expect(said).toEqual([`Definitions: made by a newer Pascaline (version ${DATA_VERSION + 1}; this one reads up to ${DATA_VERSION})`]);
    expect(showMenu).not.toHaveBeenCalled();
    await offerRestore(new File([JSON.stringify(file)], "b.json"), { showMenu } as unknown as AppShell, (m) => said.push(m));
    expect(showMenu).toHaveBeenCalledWith(dataText("restore.title"), expect.any(Array), { remember: false });
  });
  it("Undo: reloads after the write, or says it could not", async () => {
    const reload = vi.fn();
    await offerUndo(() => {}, { undo: async () => {}, reload });
    expect(reload).toHaveBeenCalledTimes(1);
    const said: string[] = [];
    await offerUndo((m) => said.push(m), { undo: () => Promise.reject(new Error("none")), reload });
    expect(said).toEqual([dataText("restore.undoFailed")]);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("summarises only the parts it knows how to count", () => {
    expect(partSummary("view", "cas")).toBeUndefined();
  });
});

describe("Settings › Data's rows", () => {
  const env = (runs: string[]): { data: (run: (c: ClipActions) => void) => void } => {
    const clip = {
      saveBackup: () => void runs.push("save"),
      restoreBackup: (f: File | "undo") => void runs.push(f === "undo" ? "undo" : `restore ${f.name}`),
    } as unknown as ClipActions;
    return { data: (run) => void run(clip) };
  };
  it("Restore from a file opens the picker and hands the picked file on; a cancelled pick does nothing", async () => {
    resetUndoTime(null);
    const runs: string[] = [];
    let next: File | null = new File(["{}"], "a.json");
    const section = dataSection(env(runs), async () => next);
    const items = section.submenu?.items ?? [];
    expect(ids(items)).toEqual(["backup", "restore"]); // no kept copy: no Undo row
    byId(items, "restore").run?.();
    await vi.waitFor(() => expect(runs).toEqual(["restore a.json"]));
    next = null;
    byId(items, "restore").run?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toEqual(["restore a.json"]);
  });
  it("Undo the restore shows while a kept copy exists, with its time", () => {
    const time = new Date(2026, 9, 31, 14, 2).getTime();
    resetUndoTime(time);
    const runs: string[] = [];
    const items = dataSection(env(runs)).submenu?.items ?? [];
    expect(ids(items)).toEqual(["backup", "restore", "undo"]);
    expect(byId(items, "undo").label).toBe("Undo the restore (2026-10-31 14:02)");
    byId(items, "undo").run?.();
    expect(runs).toEqual(["undo"]);
    resetUndoTime(null);
  });
});
