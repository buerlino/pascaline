// SPDX-License-Identifier: GPL-3.0-or-later
// THIRD_PARTY.md's tables as data (R87): the About screen's list of parts, so it cannot drift from the file. Used by
// app/vite-plugin-about.ts at build time, dev and tests alike; `node tools/third-party/parse.ts` prints the JSON.
// Nothing here depends on the clock or the host, so two builds of one commit give the same bytes.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Part {
  /** The first column, as written (backticks kept). */
  readonly name: string;
  /** The Version column; empty where the table has none (the theme palettes). */
  readonly version: string;
  /** The Licence column, as written ("MIT OR LGPL-3.0-or-later"). */
  readonly licence: string;
  readonly source: string;
  /** The column between Source and Copyright (Notes or Use), as written. */
  readonly note: string;
  /** The Copyright column; empty where the file has "–". */
  readonly copyright: string;
  /** The `##` heading of the table's section. */
  readonly group: string;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The cells of a table row, trimmed. */
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Every row of every table in THIRD_PARTY.md, with the heading of its section. */
export function parseThirdParty(md: string): Part[] {
  const parts: Part[] = [];
  let group = "";
  let head: string[] | null = null;
  for (const line of md.split("\n")) {
    if (line.startsWith("#")) {
      group = line.replace(/^#+\s*/, "");
      head = null;
    } else if (!line.startsWith("|")) {
      head = null;
    } else if (head === null) {
      head = cells(line).map((h) => h.toLowerCase());
    } else if (!/^\|[\s:|-]+\|?$/.test(line)) {
      const c = cells(line);
      const col = (name: string): string => c[head?.indexOf(name) ?? -1] ?? "";
      const at = head.indexOf("source") + 1; // Notes or Use follows Source; the theme table has neither
      const note = head[at] === "copyright" ? "" : (c[at] ?? "");
      const dash = (s: string): string => (s === "–" ? "" : s);
      parts.push({
        name: c[0] ?? "",
        version: col("version"),
        licence: col("licence"),
        source: col("source"),
        note,
        copyright: dash(col("copyright")),
        group,
      });
    }
  }
  return parts;
}

/** The licences a Licence cell names: "A OR B" and "A / B" are two. */
export function licenceIds(licence: string): string[] {
  return licence.split(/\s+OR\s+|\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
}

/** LICENSES/<id>.txt, by id. */
export function readLicences(root = ROOT): Record<string, string> {
  const dir = join(root, "LICENSES");
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".txt")) out[f.slice(0, -4)] = readFileSync(join(dir, f), "utf8");
  return out;
}

/** The app's version, from app/package.json. */
export function appVersion(root = ROOT): string {
  return (JSON.parse(readFileSync(join(root, "app", "package.json"), "utf8")) as { version: string }).version;
}

export function readParts(root = ROOT): Part[] {
  return parseThirdParty(readFileSync(join(root, "THIRD_PARTY.md"), "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify({ version: appVersion(), parts: readParts() }, null, 2)}\n`);
}
