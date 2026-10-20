// SPDX-License-Identifier: GPL-3.0-or-later
// G80: each inexact constant carries its basis; evaluated at its leaves' values it gives the item's value within its unc.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "./types.ts";

const file = join(dirname(fileURLToPath(import.meta.url)), "_gen/find-index.json");
const items: IndexItem[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
const hasUnits = items.some((it) => it.kind === "unit"); // functions only = --no-units

/** Giac text of a basis (+ - * / ^, sqrt, exp, pi, pasl_ names) evaluated in doubles. */
function evalBasis(basis: string, leaves: Record<string, { value: string }>): number {
  const js = basis.replace(/pasl_[A-Za-z0-9_]+/g, (n) => {
    const l = leaves[n.slice(5)];
    if (!l) throw new Error(`leaf ${n} missing`);
    return `(${Number(l.value)})`;
  }).replace(/\bpi\b/g, "Math.PI").replace(/\bsqrt\b/g, "Math.sqrt").replace(/\bexp\b/g, "Math.exp").replace(/\^/g, "**");
  if (/[^0-9eE.+\-*/() ,A-Za-z_]/.test(js)) throw new Error(`unexpected character in ${js}`);
  return new Function(`return ${js}`)() as number;
}

describe.skipIf(!hasUnits)("constants carry a basis (G80)", () => {
  const withUnc = items.filter((it) => it.kind === "const" && it.unc !== undefined);
  const withBasis = withUnc.filter((it) => it.basis !== undefined);

  it.each(["mu_0", "epsilon_0", "Z_0", "m_e", "m_p", "alpha"])("%s has a basis and leaves", (id) => {
    const it = items.find((i) => i.id === `const:${id}`);
    expect(it?.basis, id).toBeTruthy();
    expect(Object.keys(it?.basisLeaves ?? {}).length, id).toBeGreaterThan(0);
  });

  it("most inexact constants have one", () => expect(withBasis.length).toBeGreaterThanOrEqual(withUnc.length - 3));

  it("evaluating each basis at its leaves gives value within unc", () => {
    for (const it of withBasis) {
      const got = evalBasis(it.basis!, it.basisLeaves!);
      expect(Math.abs(got - Number(it.value)), `${it.id}: basis ${got}, value ${it.value} ± ${it.unc}`).toBeLessThanOrEqual(Number(it.unc));
    }
  });

  it("leaves hold qalc's digits, not a rounded uncertainty", () => {
    const a = items.find((i) => i.id === "const:alpha")!;
    expect(a.basisLeaves?.fine_structure).toEqual({ value: "7.29735256434E-3", unc: "1.13E-12" });
  });
});
