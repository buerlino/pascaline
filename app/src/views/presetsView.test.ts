// SPDX-License-Identifier: GPL-3.0-or-later
// R89: the presets in Mode (views/presetsView.svelte.ts): what a preset's lines say, the name read off the entry line,
// ◀ ▶ round the ends, and a refused record (a newer version's) offers no Save and no Edit.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntryPrompt } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { FakeCalc } from "../calc/fake.ts";
import { UserKeys } from "../keyboard/userKeys.svelte.ts";
import { Presets, type PresetStore, type StoredPresets } from "../state/presets.svelte.ts";
import { Session } from "../state/session.svelte.ts";
import { DATA_VERSION, type Kv } from "../state/storage.ts";
import type { RawRecord } from "../state/storageRaw.ts";
import { UnitCells } from "../units/userCells.svelte.ts";
import { groupValue, nameFrom, presetRow, setPresetsModel, summary } from "./presetsView.svelte.ts";

function memoryKv(): Kv {
  const data = new Map<string, unknown>();
  return { get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined), set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()) };
}
function store(rec?: RawRecord): PresetStore {
  const s = { rec, read: () => Promise.resolve(s.rec), write: (value: StoredPresets) => ((s.rec = { "@pascaline": DATA_VERSION, value }), Promise.resolve()) };
  return s;
}
async function setup(rec?: RawRecord) {
  const kv = memoryKv();
  const session = new Session(new FakeCalc(), kv);
  const userKeys = new UserKeys(kv);
  const presets = await Presets.open({ session, userKeys, cells: new UnitCells(kv), store: store(rec), showLook: () => Promise.resolve() });
  setPresetsModel(presets);
  return { session, userKeys, presets };
}
const items = (row: MenuItem): readonly MenuItem[] => row.submenu?.items ?? [];

afterEach(() => setPresetsModel(null));

describe("what a preset says", () => {
  it("its line: the Mode values, the decimal mark, the free keys and a theme that is not the default", () => {
    const p = {
      id: 1,
      name: "Chemistry",
      groups: {
        mode: { angle: "rad", format: "sci", digits: 4, entry: "textbook" },
        numbers: { decimalMark: "point", fmtCycle: ["std", "sci"], fixDecimals: 4 },
        keys: { userKeys: { u1: { primary: { label: "mol" }, shift: null }, u2: { primary: { label: "pH" }, alpha: { label: "M" } } }, unitPadCells: {} },
        look: { family: "graphite", brightness: "dark", contrast: false, plain: false },
      },
    };
    expect(summary(p)).toBe("RAD · SCI 4 · point · 3 keys · Graphite");
    expect(summary({ id: 2, name: "Teaching", groups: { mode: { angle: "deg", format: "std", digits: 10, entry: "line" } } })).toBe("DEG · STD 10 · one line");
    expect(summary({ id: 3, name: "Default", groups: { keys: { userKeys: {} }, look: { family: "pascaline" } } })).toBe("no keys");
  });
  it("a group's values on its tick, read as stored (a field stored before it existed is left out)", () => {
    expect(groupValue("mode", { angle: "deg", format: "eng", digits: 4, entry: "textbook" })).toBe("DEG · ENG 4 · textbook");
    expect(groupValue("numbers", { decimalMark: "comma", fmtCycle: ["std", "sci", "eng"] })).toBe("Comma · Std Sci Eng");
    expect(groupValue("numbers", { fmtCycle: ["std"] })).toBe("Std");
    expect(groupValue("vibration", { on: true, strength: 50, ms: 15 })).toBe("On · 50 % · 15 ms");
    expect(groupValue("vibration", { on: false })).toBe("Off");
    expect(groupValue("look", { family: "nord", brightness: "light" })).toBe("Nord · Light");
    expect(groupValue("keys", { userKeys: { u1: { primary: { label: "sinh" } } } })).toBe("1 set");
    expect(groupValue("keys", {})).toBe("None set");
  });
  it("the name off the entry line: letters, digits and signs as typed, MathLive's spaces as spaces", () => {
    expect(nameFrom("Lab")).toBe("Lab");
    expect(nameFrom("Field\\ survey")).toBe("Field survey");
    expect(nameFrom("\\sin us\\,2")).toBe("sin us 2");
    expect(nameFrom("\\text{Power electronics}")).toBe("Power electronics");
    expect(nameFrom("  \\ ")).toBe("");
  });
});

describe("Mode's Preset row", () => {
  it("None, then the active one; ◀ ▶ apply the previous or next, round the ends; a later change puts a dot after the name", async () => {
    const { session, presets } = await setup();
    const row = presetRow(session, {});
    expect(row.value).toBe("None");
    expect(row.hint).toBeUndefined();
    row.adjust?.(1); // nothing to apply
    presets.capture("Lab");
    session.setAngle("deg");
    presets.capture("Survey");
    expect(row.value).toBe("Survey");
    expect(row.hint).toBe("DEG · STD 12 · point · no keys");
    row.adjust?.(1);
    await vi.waitFor(() => expect(row.value).toBe("Lab"));
    expect(session.settings.angle).toBe("rad");
    row.adjust?.(-1);
    await vi.waitFor(() => expect(row.value).toBe("Survey"));
    session.setFormat("sci");
    expect(row.value).toBe("Survey •");
  });
  it("a record from a newer version: no Save and no Edit, the reason on the row", async () => {
    const { session } = await setup({ "@pascaline": DATA_VERSION + 1, value: { presets: [], active: null, next: 1 } });
    const rows = items(presetRow(session, {}));
    expect(rows.map((r) => [r.id, r.disabled])).toEqual([
      ["save", true],
      ["edit", true],
    ]);
    expect(rows[0]?.reason).toBe("Saved by a newer Pascaline: kept as it is");
  });
  it("Save asks for a name on the entry line; Enter saves it, a taken name is refused and the line stays; another key cancels and gives the line back", async () => {
    const { session, presets } = await setup();
    const notices: string[] = [];
    const shell = { prompt: null as EntryPrompt | null };
    let line = "12";
    const entry = {
      get value() {
        return line;
      },
      chips: {},
      set: (latex: string) => void (line = latex),
      run: (a: ActionBody) => void (line += a.kind === "type" ? a.text : a.kind === "insert" ? a.latex : ""),
      clear: () => void (line = ""),
    };
    const host = { shell, entry, data: (run: (c: ClipActions) => void) => run({ say: (m: string) => void notices.push(m) } as unknown as ClipActions) };
    const key = (a: ActionBody): boolean | undefined => shell.prompt?.key(a);
    const save = () => items(presetRow(session, host)).find((r) => r.id === "save")?.run?.();
    save();
    expect(shell.prompt?.label).toBe("Preset name");
    expect(line).toBe("");
    for (const ch of "Lab") key({ kind: "type", text: ch });
    expect(key({ kind: "special", name: "enter" })).toBe(true);
    expect(shell.prompt).toBeNull();
    expect(line).toBe("12");
    expect(presets.list.map((p) => p.name)).toEqual(["Lab"]);
    save();
    key({ kind: "type", text: "lab" });
    key({ kind: "type", text: " " }); // a space is kept, typed as MathLive's space
    expect(line).toBe("lab\\ ");
    key({ kind: "special", name: "enter" });
    expect(notices.at(-1)).toBe("There is already a preset named lab");
    expect(shell.prompt).not.toBeNull();
    expect(key({ kind: "special", name: "clear" })).toBe(true); // C empties the line, never the history
    expect(line).toBe("");
    expect(key({ kind: "special", name: "mode" })).toBe(false); // a key that goes elsewhere cancels first
    expect(shell.prompt).toBeNull();
    expect(line).toBe("12");
    expect(notices).toEqual(["Saved Lab", "There is already a preset named lab"]);
    save();
    key({ kind: "type", text: "La" });
    save(); // Save again while a name is typed (a tap opened Mode): the first name ends, its line is the one kept
    expect(line).toBe("");
    shell.prompt?.cancel();
    expect(shell.prompt).toBeNull();
    expect(line).toBe("12");
    shell.prompt?.cancel(); // nothing to end
    expect(line).toBe("12");
  });
});
