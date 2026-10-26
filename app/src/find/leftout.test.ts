// SPDX-License-Identifier: GPL-3.0-or-later
// G111: Find's index leaves out the functions whose answer cannot be shown (decisions.md "Owner answers of 2026-10-25"): the
// graphics of F90, the graphs of F92, the strings and tables of F94 (each function the G110 census filed under that line in
// tests/golden/findcensus-known.yaml), and Giac's debugger (debug, interactive_plotode: Giac's prompt(), "prompt is not
// defined"). find/functions.yaml's exclude groups graphics, graphs, strings, debugger hold them. Needs the generated index
// (`npm run index`); skipped without it unless FIND_INDEX=required.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "_gen/find-index.json");
const required = process.env.FIND_INDEX === "required";
const known = parse(readFileSync(join(here, "../../../tests/golden/findcensus-known.yaml"), "utf8")) as { findings: Record<string, string[]> };
/** The functions of a census finding line (`home plot/0` → plot). */
const functionsOf = (line: string): string[] => [...new Set((known.findings[line] ?? []).map((id) => id.split(" ")[1]!.split("/")[0]!))];

describe.skipIf(!existsSync(indexFile) && !required)("G111 functions left out of Find", () => {
  const items = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
  const names = new Set(items.filter((it) => it.kind === "fn").flatMap((it) => [it.id.slice(3), ...it.names]));

  it("reads the census's lines (F90 103 functions, F92 53, F94 9)", () => {
    expect(functionsOf("F90").length).toBe(103);
    expect(functionsOf("F92").length).toBe(53);
    expect(functionsOf("F94").length).toBe(9);
  });

  it("holds none of them, nor Giac's debugger", () => {
    expect(items.length).toBeGreaterThan(0);
    const left = [...functionsOf("F90"), ...functionsOf("F92"), ...functionsOf("F94"), "debug", "interactive_plotode"];
    expect(left.filter((n) => names.has(n))).toEqual([]);
  });

  it("still holds the functions next to them", () => {
    for (const n of ["sin", "exponential", "LambertW", "fracmod", "normald", "Gamma"]) expect(names.has(n), n).toBe(true);
  });
});
