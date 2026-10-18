// SPDX-License-Identifier: GPL-3.0-or-later
// Every curated Find function (find/functions.yaml) inserts LaTeX that our parser turns into the Giac command it
// names, and every Giac function inserted as \operatorname reaches Giac under its own name (docs/04 3.1, 3.6).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Curated { id: string; giac: string; insert?: string }
const curated = (parse(readFileSync(join(here, "../../../find/functions.yaml"), "utf8")) as { functions: Curated[] }).functions;
const opInsert = (n: string): string => `\\operatorname{${n.replace(/_/g, "\\_")}}\\left(#0\\right)`;
// Giac names our parser renames on the way (input/emit.ts CALL_NAME): irem is pasmod, which is irem on integers.
const CALL_NAME: Record<string, string> = { irem: "pasmod" };
const fill = (insert: string): string => insert.replace("#0", "x");

describe("Find insertion", () => {
  it("puts a selection in every curated insert: its slot is #0, never #? (decisions.md R17 default, point 4)", () => {
    for (const f of curated) if (f.insert) expect(f.insert.includes("#0") && !f.insert.includes("#?"), f.id).toBe(true);
  });

  it.each(curated.map((f) => [f.id, f] as const))("%s becomes its Giac command", (_, f) => {
    const giac = latexToGiac(fill(f.insert ?? opInsert(f.giac)));
    expect(giac.startsWith(`${CALL_NAME[f.giac] ?? f.giac}(`), giac).toBe(true);
  });

  it.each(["normald_cdf", "stddevp", "irem", "comb", "Gamma", "lcm", "plotfunc", "zeta"])("\\operatorname{%s} reaches Giac as written", (n) => {
    expect(latexToGiac(fill(opInsert(n)))).toBe(`${CALL_NAME[n] ?? n}(x)`);
  });
});
