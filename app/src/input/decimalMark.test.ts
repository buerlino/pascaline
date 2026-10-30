// SPDX-License-Identifier: GPL-3.0-or-later
// R57f1 (Opus pass 18): parsing never depends on the decimal mark. MathLive's {,} is the decimal mark in either mode and
// a bare comma, like the semicolon, separates arguments, so an entry stored in one mode means the same after the switch
// (max(1,5) recalled in comma mode is still 5). Every row of group "l6" in tests/golden/parser.yaml gives the same Giac
// text, or the same refusal, with and without the decimal comma; the values are checked by Giac in npm run golden.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { latexToGiac } from "./latex-to-giac.ts";

type Case = { id: string; latex: string; group?: string; options?: { decimalComma?: boolean; realOddRoots?: boolean }; before?: string[] };
const file = fileURLToPath(new URL("../../../tests/golden/parser.yaml", import.meta.url));
const rows = (parse(readFileSync(file, "utf8")) as { cases: Case[] }).cases.filter((c) => c.group === "l6");

const giac = (c: Case, decimalComma: boolean): string => {
  const o = { ...(c.options?.realOddRoots === undefined ? {} : { realOddRoots: c.options.realOddRoots }), decimalComma };
  try {
    return latexToGiac(c.latex, o);
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
};

describe("the decimal mark does not change parsing (R57f1)", () => {
  it("group l6 has rows", () => {
    expect(rows.length).toBeGreaterThan(20);
  });
  it.each(rows.map((c) => [c.id, c] as const))("%s: the same Giac text with and without the decimal comma", (_id, c) => {
    expect(giac(c, true)).toBe(giac(c, false));
  });
});
