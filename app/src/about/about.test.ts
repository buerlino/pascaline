// SPDX-License-Identifier: GPL-3.0-or-later
// R87: the About screen's list is THIRD_PARTY.md's tables, the licence texts are LICENSES/, the version is
// package.json's; no UI string names the reference calculator (rules-core.md, "Legal / clean room").
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import about from "virtual:about";
import { en } from "../i18n/en.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { enFind } from "../i18n/enFind.ts";
import { enPalettes } from "../i18n/enPalettes.ts";
import { enParser } from "../i18n/enParser.ts";
import { enUnits } from "../i18n/enUnits.ts";

const ROOT = new URL("../../../", import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, ROOT), "utf8");

/** Every data row of THIRD_PARTY.md's tables, read here on its own (not with the parser under test): its cells by
 *  the header they sit under. */
function tableRows(): { name: string; version: string; licence: string; copyright: string }[] {
  const rows: { name: string; version: string; licence: string; copyright: string }[] = [];
  let head: string[] | null = null;
  for (const line of read("THIRD_PARTY.md").split("\n")) {
    if (!line.startsWith("|")) {
      head = null;
      continue;
    }
    const c = line.split("|").slice(1, -1).map((x) => x.trim());
    if (head === null) head = c.map((h) => h.toLowerCase());
    else if (!/^[\s:-]+$/.test(c[0] ?? "")) {
      const col = (n: string): string => c[head?.indexOf(n) ?? -1] ?? "";
      rows.push({ name: c[0] as string, version: col("version"), licence: col("licence"), copyright: col("copyright") === "–" ? "" : col("copyright") });
    }
  }
  return rows;
}

describe("About data", () => {
  it("lists every row of THIRD_PARTY.md's tables with its version, licence and copyright line", () => {
    const rows = tableRows();
    expect(rows.length).toBeGreaterThan(30);
    expect(about.parts.length).toBe(rows.length);
    for (const r of rows) {
      const p = about.parts.find((x) => x.name === r.name);
      expect(p, r.name).toBeDefined();
      expect(p?.version, r.name).toBe(r.version);
      expect(p?.licence, r.name).toBe(r.licence);
      expect(p?.copyright, r.name).toBe(r.copyright);
    }
  });

  it("carries the app's version from package.json", () => {
    expect(about.version).toBe((JSON.parse(read("app/package.json")) as { version: string }).version);
  });

  it("carries one text per file of LICENSES/, and a text for every licence of the table that has a file", () => {
    const files = readdirSync(new URL("LICENSES/", ROOT)).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4));
    expect(Object.keys(about.licences).sort()).toEqual(files.sort());
    for (const id of files) expect(about.licences[id], id).toBe(read(`LICENSES/${id}.txt`));
    const named = new Set(about.parts.flatMap((p) => p.ids));
    for (const id of ["GPL-3.0-or-later", "GPL-2.0-or-later", "LGPL-3.0-or-later", "MIT", "Apache-2.0", "OFL-1.1"]) {
      expect(named.has(id), id).toBe(true);
      expect(about.licences[id]?.length, id).toBeGreaterThan(500);
    }
  });

  it("splits 'A OR B' and 'A / B' into licences", () => {
    expect(about.parts.find((p) => p.name === "GMP")?.ids).toEqual(["LGPL-3.0-or-later", "GPL-2.0-or-later"]);
    expect(about.parts.find((p) => p.name === "JSXGraph")?.ids).toEqual(["MIT", "LGPL-3.0-or-later"]);
  });
});

describe("UI strings", () => {
  it("never name HP or Prime as a word", () => {
    const tables = { en, enEngine, enFind, enPalettes, enParser, enUnits } as Record<string, Record<string, string>>;
    for (const [table, messages] of Object.entries(tables))
      for (const [key, text] of Object.entries(messages)) expect(/\b(HP|Prime)\b/.test(text), `${table}.${key}`).toBe(false);
  });
});
