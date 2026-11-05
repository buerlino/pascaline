// SPDX-License-Identifier: GPL-3.0-or-later
// R126: part 2 of the format for your AI (views/aiFormat.md, copied by Settings › Data › Library › Copy the format for
// your AI) describes the backup's keys, unit pad cells and presets. The worked example is checked, restored and read
// back with the app's own code, and every rule the text states is compared with the code's, so the text never lies.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { KeyboardSpecError, parseAction } from "../keyboard/keyboard.ts";
import { USER_KEY_IDS, USER_LAYERS, UserKeys } from "../keyboard/userKeys.svelte.ts";
import { BACKUP_FORMAT, BACKUP_KEYS, checkBackup, KEY_LAYERS, MAX_BACKUP_BYTES, SETTING_RULES, VALIDATORS, type CheckedBackup } from "../state/backup.ts";
import { fakeIndexedDb, type FakeIdb } from "../state/fakeIdb.ts";
import { GROUP_FIELDS, PRESET_GROUPS } from "../state/presetRecord.ts";
import { idbPresetStore, Presets } from "../state/presets.svelte.ts";
import { restoreParts } from "../state/restore.ts";
import { Session } from "../state/session.svelte.ts";
import { DATA_VERSION, idbKv } from "../state/storage.ts";
import { defaultLook } from "../theme/look.ts";
import { CELL_KEYS, CELL_LEGS, UnitCells } from "../units/userCells.svelte.ts";
import { aiFormat } from "./libraryJobs.ts";

const format = aiFormat();
/** Part 2's text: from its heading to the end. */
const part2 = format.slice(format.indexOf("## Part 2"));
const section = (title: string): string => {
  const at = part2.indexOf(`### ${title}`);
  if (at < 0) throw new Error(`part 2 has no section '${title}'`);
  return part2.slice(at + title.length + 4).split("\n### ")[0] as string;
};
const example = (): string => {
  const m = /### Worked example of a backup\n```json\n([\s\S]*?)```/.exec(part2);
  if (!m) throw new Error("part 2 has no worked example");
  return m[1] as string;
};
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const ticks = (s: string): string[] => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);

describe("the format's backup part: its worked example (R126)", () => {
  let idb: FakeIdb;
  beforeEach(() => {
    idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb.factory);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a file with only userKeys, unitPadCells and presets, stamped with this version, and checkBackup accepts it", () => {
    expect(part2).not.toMatch(/\{version\}|R126|<!--/);
    const file = JSON.parse(example()) as { "pascaline-backup": number; dataVersion: number; parts: Record<string, Record<string, unknown>> };
    expect(file["pascaline-backup"]).toBe(BACKUP_FORMAT);
    expect(file.dataVersion).toBe(DATA_VERSION);
    expect(Object.keys(file.parts)).toEqual(["userKeys", "unitPadCells", "presets"]);
    for (const rec of Object.values(file.parts)) expect(rec["@pascaline"]).toBe(DATA_VERSION);
    const r = checkBackup(bytes(example())) as CheckedBackup;
    expect(r.ok).toBe(true);
    expect(Object.keys(r.parts)).toEqual(["userKeys", "unitPadCells", "presets"]);
  });

  it("restores into the store and reads back as slots, cells and a preset that applies", async () => {
    const r = checkBackup(bytes(example())) as CheckedBackup;
    await restoreParts(r.parts, 1);
    const keys = new UserKeys(idbKv);
    await keys.restore();
    expect(keys.slots("u1").primary).toEqual({ label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } });
    expect(keys.slots("u1").shift).toEqual({ label: "mol", action: { type: "mol" } });
    expect(keys.slots("u1").alpha).toBeNull();
    expect(keys.placeOf("u2", "primary")).toBe("home");
    const cells = new UnitCells(idbKv);
    await cells.restore();
    expect(cells.get("u1", "tap")).toEqual({ unit: "N", prefix: "k" });
    expect(cells.textOf("u1", "tap")).toBe("kN");
    expect(cells.get("u1", "up")).toEqual({ unit: "Pa", prefix: "M" });
    expect(cells.textOf("u2", "tap")).toBe("mm");
    expect(cells.get("u2", "down")).toBeUndefined();
    const session = new Session(new FakeCalc(), idbKv);
    keys.reset(); // the preset brings its own keys back
    cells.reset();
    const presets = await Presets.open({ session, userKeys: keys, cells, store: idbPresetStore });
    expect(presets.list.map((p) => p.name)).toEqual(["Lab"]);
    await presets.apply(1);
    expect(session.settings).toMatchObject({ angle: "deg", format: "eng", digits: 6, decimalMark: "comma", marks: "reason" });
    expect(keys.labelOf("u1", "primary")).toBe("sinh");
    expect(cells.textOf("u1", "tap")).toBe("kN");
    expect(cells.get("u1", "up")).toBeUndefined();
  });
});

describe("the format's backup part: every rule it states is the code's (R126)", () => {
  it("names the envelope: the format number, the stamp field, the size, and the three parts of BACKUP_KEYS", () => {
    const env = section("The envelope");
    expect(env).toContain(`\`"pascaline-backup"\`: the whole number \`${BACKUP_FORMAT}\``);
    expect(env).toContain(`${MAX_BACKUP_BYTES / 1024 / 1024} MB`);
    expect(env).toContain('"@pascaline"');
    expect(env).toContain(`from 0 to ${DATA_VERSION}`);
    expect(ticks(env.split("\n").find((l) => l.startsWith('- `"parts"`')) ?? "")).toEqual(expect.arrayContaining(["userKeys", "unitPadCells", "presets"]));
    for (const part of ["userKeys", "unitPadCells", "presets"]) expect(BACKUP_KEYS, part).toContain(part);
    for (const heading of [...part2.matchAll(/^### Part `([^`]+)`/gm)].map((m) => m[1] as string)) expect(BACKUP_KEYS, heading).toContain(heading);
    // a larger stamp, an unknown part and a larger format number are refused, as the text says
    const file = (parts: unknown, format = 1): Uint8Array => bytes(JSON.stringify({ "pascaline-backup": format, parts }));
    const rec = (v: number): unknown => ({ userKeys: { "@pascaline": v, value: {} } });
    expect(checkBackup(file(rec(DATA_VERSION))).ok).toBe(true);
    expect(checkBackup(file(rec(0))).ok).toBe(true);
    expect(checkBackup(file(rec(DATA_VERSION + 1))).ok).toBe(false);
    expect(checkBackup(file({ nope: { "@pascaline": DATA_VERSION, value: {} } })).ok).toBe(false);
    expect(checkBackup(file(rec(DATA_VERSION), BACKUP_FORMAT + 1)).ok).toBe(false);
    expect(checkBackup(file({ userKeys: { value: {} } })).ok).toBe(false);
  });

  it("userKeys: the key ids, the layers and the action fields are the keypad's", () => {
    const s = section("Part `userKeys`: the six free keys");
    expect(USER_KEY_IDS).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(s).toContain("`u1` … `u6`");
    expect([...s.matchAll(/`(primary|shift|alpha)`/g)].map((m) => m[1])).toEqual(["primary", "shift", "alpha"]);
    expect(KEY_LAYERS).toEqual(["primary", "shift", "alpha"]);
    expect(USER_LAYERS).toEqual(KEY_LAYERS);
    const slot = (b: unknown): boolean => VALIDATORS["userKeys"]?.({ u1: { primary: b } }) === true;
    expect(slot(null)).toBe(true);
    expect(slot({ label: "x", action: { type: "x" } })).toBe(true);
    expect(slot({ label: "", action: { type: "x" } })).toBe(false);
    expect(slot({ label: "x", action: { type: "x", insert: "y" } })).toBe(false);
    expect(slot({ label: "x", action: { sin: "x" } })).toBe(false);
    expect(VALIDATORS["userKeys"]?.({ u7: { primary: null } })).toBe(false);
    expect(VALIDATORS["userKeys"]?.({ u1: { ctrl: null } })).toBe(false);
    // the action forms the text names, and every special it lists
    const lines = s.split("\n");
    const specials = ticks(lines.find((l) => l.includes('`"special"`')) ?? "").filter((t) => /^"[a-z]+"$/.test(t) && t !== '"special"').map((t) => t.slice(1, -1));
    expect(specials.length).toBeGreaterThanOrEqual(8);
    for (const name of specials) expect(parseAction({ special: name }, name), name).toMatchObject({ kind: "special", name });
    expect(() => parseAction({ special: "nope" }, "x")).toThrow(KeyboardSpecError);
    expect(parseAction({ insert: "\\operatorname{f}\\left(#0\\right)" }, "x")).toMatchObject({ kind: "insert" });
    expect(parseAction({ type: "mol" }, "x")).toMatchObject({ kind: "type" });
    expect(s).toContain('`"cmd"`');
    expect(parseAction({ cmd: "moveToNextChar" }, "x")).toMatchObject({ kind: "cmd" });
  });

  it("unitPadCells: the key ids, the legs and the leg fields are the pad's", () => {
    const s = section("Part `unitPadCells`: the unit pad's user cells");
    expect(CELL_KEYS).toEqual(USER_KEY_IDS);
    expect(s).toContain("`u1` … `u6`");
    expect(CELL_LEGS).toEqual(["tap", "up", "down"]);
    expect(s).toContain("`tap`, `up` (a flick up) and `down` (a flick down)");
    const leg = (b: unknown): boolean => VALIDATORS["unitPadCells"]?.({ u1: { tap: b } }) === true;
    expect(leg(null)).toBe(true);
    expect(leg({ unit: "N" })).toBe(true);
    expect(leg({ unit: "N", prefix: "k", label: "kN" })).toBe(true);
    expect(leg({ unit: "" })).toBe(false);
    expect(leg({ prefix: "k" })).toBe(false);
    expect(leg({ unit: "N", prefix: "" })).toBe(false);
    expect(leg({ unit: "N", label: "" })).toBe(false);
    expect(VALIDATORS["unitPadCells"]?.({ u1: { left: null } })).toBe(false);
    expect(VALIDATORS["unitPadCells"]?.({ u9: { tap: null } })).toBe(false);
    // the examples of ids the text gives are the ones the pad draws
    const cells = new UnitCells({ get: async () => undefined, set: async () => {} });
    cells.set("u1", "tap", { unit: "N", prefix: "k" });
    cells.set("u2", "tap", { unit: "m", prefix: "m" });
    expect([cells.textOf("u1", "tap"), cells.textOf("u2", "tap")]).toEqual(["kN", "mm"]);
  });

  it("presets: the groups, their fields and each field's allowed values are the code's", () => {
    const s = section("Part `presets`: named sets of settings");
    const groupLines = s.split("\n").filter((l) => /^- `[a-z]+`: /.test(l));
    expect(groupLines.map((l) => /^- `([a-z]+)`/.exec(l)?.[1])).toEqual([...PRESET_GROUPS]);
    // every word any setting takes, so a value the code accepts and the text leaves out shows
    const words = new Set<string>(["maybe", "", "rad", "deg", "std", "sci", "eng", "pfx", "textbook", "line", "point", "comma", "sigma", "muted", "colour", "reason", "thin", "apos", "system", "light", "dark", "pascaline", "graphite", "solarized", "gruvbox", "nord"]);
    for (const m of s.matchAll(/"([a-z]+)"/g)) words.add(m[1] as string);
    const ok = (group: string, field: string, v: unknown): boolean => {
      if (group === "look") return SETTING_RULES["look"]?.({ ...defaultLook(), [field]: v }) === true;
      if (group === "vibration") return SETTING_RULES["haptics"]?.({ [field]: v }) === true;
      return SETTING_RULES[field]?.(v) === true;
    };
    for (const line of groupLines) {
      const group = /^- `([a-z]+)`/.exec(line)?.[1] as (typeof PRESET_GROUPS)[number];
      const fields = line.slice(line.indexOf(": ") + 2).split("; ");
      if (group === "keys") {
        expect(ticks(line)).toEqual(expect.arrayContaining([...GROUP_FIELDS.keys]));
        continue;
      }
      expect(fields.map((f) => /^`([A-Za-z]+)`/.exec(f)?.[1]), group).toEqual([...GROUP_FIELDS[group]].filter((f) => f !== "fmtCycle"));
      for (const f of fields) {
        const field = /^`([A-Za-z]+)`/.exec(f)?.[1] as string;
        const listed = [...f.matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
        const range = /from (\d+) to (\d+)/.exec(f);
        if (listed.length > 0) {
          const accepted = [...words].filter((w) => ok(group, field, w));
          expect(accepted.sort(), `${group}.${field}`).toEqual([...listed].sort());
        } else if (range) {
          const [lo, hi] = [Number(range[1]), Number(range[2])];
          expect([ok(group, field, lo - 1), ok(group, field, lo), ok(group, field, hi), ok(group, field, hi + 1), ok(group, field, lo + 0.5)], `${group}.${field}`).toEqual([false, true, true, false, false]);
        } else {
          expect(f, `${group}.${field}`).toMatch(/= true or false/);
          expect([ok(group, field, true), ok(group, field, false), ok(group, field, "true"), ok(group, field, 1)], `${group}.${field}`).toEqual([true, true, false, false]);
        }
      }
    }
  });

  it("presets: the record rules (ids, names, active, next) are the check's", () => {
    const rule = (p: unknown): boolean => VALIDATORS["presets"]?.(p) === true;
    const one = { id: 1, name: "Lab", groups: { mode: { angle: "deg" } } };
    expect(rule({ presets: [one], active: null, next: 2 })).toBe(true);
    expect(rule({ presets: [one], active: 1, next: 2 })).toBe(true);
    expect(rule({ presets: [one], active: 2, next: 2 })).toBe(false);
    expect(rule({ presets: [one], active: null, next: 1 })).toBe(false);
    expect(rule({ presets: [one, { ...one, name: "Other" }], active: null, next: 3 })).toBe(false); // id twice
    expect(rule({ presets: [one, { ...one, id: 2, name: " lab " }], active: null, next: 3 })).toBe(false); // name twice
    expect(rule({ presets: [{ ...one, id: 0 }], active: null, next: 2 })).toBe(false);
    expect(rule({ presets: [{ ...one, name: "" }], active: null, next: 2 })).toBe(false);
    expect(rule({ presets: [{ ...one, groups: {} }], active: null, next: 2 })).toBe(false);
    expect(rule({ presets: [{ ...one, groups: { mode: 3 } }], active: null, next: 2 })).toBe(false);
    const s = section("What refuses a file");
    for (const phrase of ["`active` naming no preset", "`next` not greater than every id", "an id or name used twice"]) expect(s).toContain(phrase);
  });
});
