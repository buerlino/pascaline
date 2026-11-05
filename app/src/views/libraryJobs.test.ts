// SPDX-License-Identifier: GPL-3.0-or-later
// R59: Settings › Data › Library without an engine: the four rows under one Library row, each handing its job on; the
// notices (what came in with the guard line, the refusal with its lines, the clash with each name's line); a clash opens
// the sheet whose Replace imports again with replace; the export's name and its "nothing to export"; the copied format.
import { describe, expect, it, vi } from "vitest";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { LibraryReply } from "../calc/port.ts";
import { aiFormat, copyFormat, exportLib, importClipboard, importInput, importNotice, libraryName, type LibraryHost } from "./libraryJobs.ts";
import { librarySection } from "./libraryRows.ts";

const plan = { added: ["beam_M", "g0"], same: ["x"], replaced: [] };
const good: LibraryReply = { result: { ok: true, plan, changes: [], log: [], tests: 5, ms: 3 }, lines: [] };

function host(replies: LibraryReply[], over: Partial<LibraryHost> = {}) {
  const said: string[] = [];
  const sheets: { title: string; items: MenuItem[] }[] = [];
  const calls: [Uint8Array | string, boolean][] = [];
  let refreshed = 0;
  const h: LibraryHost = {
    calc: {
      importLibrary: async (input, replace) => (calls.push([input, replace]), replies.shift() ?? good),
      exportLibrary: async () => ({ text: "// pascaline library 4\n\n// d\nf(x):=x\n", skipped: [{ name: "C", why: "a decimal" }] }),
    },
    say: (s) => void said.push(s),
    readText: async () => "// pascaline library 4\n",
    writeText: async () => true,
    refresh: async () => void refreshed++,
    showMenu: (title, items) => void sheets.push({ title, items }),
    saveFile: async () => "saved",
    ...over,
  };
  return { h, said, sheets, calls, refreshed: () => refreshed };
}

describe("the notices", () => {
  it("an import says what came in and that the tests are a guard on plain Giac", () => {
    expect(importNotice(good)).toBe("Library imported: 2 new, 0 replaced, 1 unchanged; 5 tests passed. Tests run on plain Giac (radians, no exact-first): a guard, not a proof");
  });
  it("a refusal names its line; failed tests are listed each with its line, with the guard", () => {
    expect(importNotice({ result: { ok: false, error: "line 4: only definitions may stand in a library", line: 4, dirty: false }, lines: [] })).toBe(
      "Library refused, nothing changed: line 4: only definitions may stand in a library",
    );
    const failures = [
      { line: 5, expr: "tw(3) == 7", got: "false" },
      { line: 6, expr: "tw(1) == 3", got: "" },
    ];
    expect(importNotice({ result: { ok: false, error: "x", line: 5, dirty: true, failures }, lines: [] })).toBe(
      "Library refused, nothing changed: tests failed: line 5: tw(3) == 7 gave false; line 6: tw(1) == 3 gave an error. Tests run on plain Giac (radians, no exact-first): a guard, not a proof",
    );
  });
  it("a clash names each own name with its line in the file", () => {
    const r: LibraryReply = { result: { ok: false, error: "x", line: 0, dirty: false, clashes: ["beam_M", "g0"] }, lines: [{ name: "beam_M", line: 6 }, { name: "g0", line: 24 }] };
    expect(importNotice(r)).toBe("Nothing changed: 2 of your own names would be replaced: beam_M (line 6), g0 (line 24)");
  });
});

describe("the jobs", () => {
  it("a good import reads the names again; a refused one does not and opens nothing", async () => {
    const t = host([good, { result: { ok: false, error: "line 2: x", line: 2, dirty: false }, lines: [] }]);
    await importInput(t.h, "a");
    expect(t.refreshed()).toBe(1);
    await importInput(t.h, "b");
    expect(t.refreshed()).toBe(1);
    expect(t.sheets).toEqual([]);
    expect(t.said[1]).toBe("Library refused, nothing changed: line 2: x");
  });
  it("a clash opens the sheet; Replace imports the same input again with replace, Cancel does nothing", async () => {
    const clash: LibraryReply = { result: { ok: false, error: "x", line: 0, dirty: false, clashes: ["beam_M"] }, lines: [{ name: "beam_M", line: 6 }] };
    const t = host([clash]);
    await importInput(t.h, "text");
    expect(t.refreshed()).toBe(0);
    expect(t.sheets.map((s) => s.title)).toEqual(["Replace your own names?"]);
    const items = t.sheets[0]!.items;
    expect(items.map((i) => i.id)).toEqual(["clash", "replace", "cancel"]);
    expect(items[0]!.label).toContain("beam_M (line 6)");
    items[2]!.run?.();
    expect(t.calls).toEqual([["text", false]]);
    items[1]!.run?.();
    await vi.waitFor(() => expect(t.refreshed()).toBe(1));
    expect(t.calls).toEqual([["text", false], ["text", true]]);
    expect(t.sheets).toHaveLength(1); // a second clash sheet only for an import without replace
  });
  it("the clipboard: its text goes through the same import; none or empty says so", async () => {
    const t = host([]);
    await importClipboard(t.h);
    expect(t.calls).toEqual([["// pascaline library 4\n", false]]);
    const none = host([], { readText: async () => null });
    await importClipboard(none.h);
    expect(none.said).toEqual(["Could not read the clipboard"]);
    const empty = host([], { readText: async () => "  \n" });
    await importClipboard(empty.h);
    expect(empty.said).toEqual(["The clipboard holds no text"]);
    expect(empty.calls).toEqual([]);
  });
  it("the export saves under the day's name and says what it left out; an empty log saves nothing", async () => {
    expect(libraryName(new Date(2026, 10, 5))).toBe("pascaline-library-2026-11-05.txt");
    const saved: string[] = [];
    const t = host([], { saveFile: async (name, mime, text) => (saved.push(`${name} ${mime} ${text.length}`), "saved") });
    await exportLib(t.h);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatch(/^pascaline-library-\d{4}-\d{2}-\d{2}\.txt text\/plain \d+$/);
    expect(t.said).toEqual(["Library saved. 1 left out (assumptions, and decimals in the backup only): C"]);
    const empty = host([], { calc: { exportLibrary: async () => ({ text: "// pascaline library 4\n", skipped: [] }) }, saveFile: async () => (saved.push("again"), "saved") });
    await exportLib(empty.h);
    expect(empty.said).toEqual(["No definitions to export"]);
    expect(saved).toHaveLength(1);
  });
  it("copy the format: the whole text without the file's own comments, the version filled in", async () => {
    const put: string[] = [];
    const t = host([], { writeText: async (s) => (put.push(s), true) });
    await copyFormat(t.h);
    expect(put).toEqual([aiFormat()]);
    expect(put[0]).toContain("// pascaline library 4\n// Maximum bending moment");
    expect(put[0]).not.toMatch(/SPDX|<!--|R126|\{version\}/);
    expect(t.said).toEqual(["Format copied: paste it into your AI chat"]);
    expect(aiFormat("<!-- a -->\n# T {version}\n<!-- b\n c -->\nx\n", 9)).toBe("# T 9\nx\n");
  });
  it("no engine (the fake one): says so", async () => {
    const t = host([], { calc: {} });
    await importInput(t.h, "x");
    await exportLib(t.h);
    expect(t.said).toEqual(["The library needs the engine, which is not running", "The library needs the engine, which is not running"]);
  });
});

describe("Settings › Data › Library's rows", () => {
  it("four rows on their own level, each handing its job on; Import opens the picker, a cancelled pick does nothing", async () => {
    const runs: string[] = [];
    const clip = { library: (job: string, f?: File) => void runs.push(f ? `${job} ${f.name}` : job) } as unknown as ClipActions;
    let next: File | null = new File(["x"], "beams.txt");
    const row = librarySection({ data: (run) => void run(clip) }, async () => next);
    expect(row.label).toBe("Library");
    const items = row.submenu?.items ?? [];
    expect(items.map((i) => i.id)).toEqual(["import", "clipboard", "export", "format"]);
    expect(items.map((i) => i.label)).toEqual(["Import a library", "Import from the clipboard", "Export the library", "Copy the format for your AI"]);
    items[0]!.run?.();
    await vi.waitFor(() => expect(runs).toEqual(["file beams.txt"]));
    next = null;
    items[0]!.run?.();
    for (const i of items.slice(1)) i.run?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toEqual(["file beams.txt", "clipboard", "export", "format"]);
  });
});
