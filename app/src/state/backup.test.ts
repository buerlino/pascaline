// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backupName, BACKUP_KEYS, LEFT_OUT, makeBackup } from "./backup.ts";
import { DATA_VERSION, type RawRecord } from "./storage.ts";

/** The keys in the first column of docs/04 section 6.2's table. */
function documentedKeys(): string[] {
  const doc = readFileSync(new URL("../../../docs/04-architecture.md", import.meta.url), "utf8");
  const sec = doc.split("### 6.2")[1]?.split("\n### ")[0] ?? "";
  const keys: string[] = [];
  for (const line of sec.split("\n")) {
    const cell = /^\|([^|]*)\|/.exec(line)?.[1];
    if (cell) for (const m of cell.matchAll(/`([^`]+)`/g)) keys.push(m[1] as string);
  }
  return keys;
}

describe("the backup's keys (R38a)", () => {
  it("every key of docs/04 6.2 is in BACKUP_KEYS or on the left-out list", () => {
    const keys = documentedKeys();
    expect(keys.length).toBeGreaterThanOrEqual(12);
    for (const k of keys) expect(BACKUP_KEYS.includes(k) || LEFT_OUT.includes(k), k).toBe(true);
    for (const k of BACKUP_KEYS) expect(LEFT_OUT).not.toContain(k);
  });
  it("makeBackup holds only the keys that are present, with their stamps as stored", async () => {
    const store: Record<string, RawRecord> = {
      settings: { "@pascaline": DATA_VERSION, value: { digits: 12 } },
      defs: { "@pascaline": 0, value: [] },
      defsStarts: { "@pascaline": DATA_VERSION, value: 1 },
      view: { "@pascaline": DATA_VERSION + 1, value: "cas" },
    };
    const b = await makeBackup(async (k) => store[k], new Date("2026-10-31T12:00:00Z"));
    expect(b["pascaline-backup"]).toBe(1);
    expect(b.dataVersion).toBe(DATA_VERSION);
    expect(b.made).toBe("2026-10-31T12:00:00.000Z");
    expect(Object.keys(b.parts).sort()).toEqual(["defs", "settings", "view"]);
    expect(b.parts["defs"]?.["@pascaline"]).toBe(0);
    expect(b.parts["view"]?.["@pascaline"]).toBe(DATA_VERSION + 1);
  });
  it("names the file by the date", () => {
    expect(backupName(new Date(2026, 9, 5))).toBe("pascaline-backup-2026-10-05.json");
  });
});
