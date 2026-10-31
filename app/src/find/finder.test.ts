// SPDX-License-Identifier: GPL-3.0-or-later
// Find's rows (R4a): the categories of the empty query, the search, the marks and the chips, on the generated index.
// Skipped like the query test when the index is missing or holds functions only.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { CATEGORIES, categoryItems } from "./categories.ts";
import { constChipOf, findMenu, itemRow, makeIndex, makeIndexIdle, pauseWhile, unitNote } from "./finder.ts";
import type { FindItem, IndexItem } from "./types.ts";

const file = join(dirname(fileURLToPath(import.meta.url)), "_gen/find-index.json");
const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];
const full = raw.some((it) => it.kind === "unit");

describe.skipIf(!full)("Find on the generated index", () => {
  const index = makeIndex(raw);
  const picked: FindItem[] = [];
  const menu = findMenu(index, (it) => void picked.push(it));

  it("the empty query shows ten fixed categories, constants and units last", () => {
    expect(menu.categories.map((c) => c.id)).toEqual(CATEGORIES.map((c) => `cat:${c.id}`));
    expect(menu.categories).toHaveLength(10);
    expect(menu.categories.at(-2)?.submenu?.items).toHaveLength(raw.filter((it) => it.kind === "const").length);
  });

  it("every audited function and template is in exactly one category, and every category id is in the index", () => {
    const seen = CATEGORIES.flatMap((c) => categoryItems(c, index.items, index.byId).filter((it) => it.kind === "fn" || it.kind === "tmpl").map((it) => it.id));
    const tier0 = index.items.filter((it) => (it.kind === "fn" || it.kind === "tmpl") && it.tier === 0).map((it) => it.id);
    expect([...seen].sort()).toEqual([...tier0].sort());
    for (const c of CATEGORIES) for (const id of c.ids ?? []) expect(index.byId.has(id), id).toBe(true);
  });

  it("c finds the speed of light first, solve and det their functions", () => {
    expect(menu.search("c")[0]?.id).toBe("const:c");
    expect(menu.search("solve")[0]?.id).toBe("fn:solve");
    expect(menu.search("det")[0]?.id).toBe("fn:det");
  });

  it("a category's letters search within it", () => {
    const trig = menu.categories.find((c) => c.id === "cat:trig")?.submenu;
    const hits = trig?.search?.("s") ?? [];
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe("fn:sin");
    const ids = new Set(trig?.items.map((it) => it.id));
    for (const h of hits) expect(ids.has(h.id), h.id).toBe(true);
  });

  it("each of the 34 units without an exact factor is marked in its row: dB converts only, Da has no exact factor", () => {
    const marked = index.items.filter((it) => unitNote(it) !== undefined);
    expect(marked).toHaveLength(raw.filter((it) => it.kind === "unit" && it.si === undefined).length);
    expect(marked.length).toBe(34);
    expect(itemRow(index.byId.get("unit:dB") as FindItem, () => {}).note).toBe("converts only");
    expect(itemRow(index.byId.get("unit:Da") as FindItem, () => {}).note).toBe("no exact factor");
    expect(itemRow(index.byId.get("unit:km/h") as FindItem, () => {}).note).toBeUndefined();
  });

  it("the preview shows a function's syntax, a constant's value and uncertainty, and 'not checked' for tier 1", () => {
    expect(itemRow(index.byId.get("fn:solve") as FindItem, () => {}).preview).toContain("solve(eq, x)");
    expect(itemRow(index.byId.get("const:c") as FindItem, () => {}).preview).toContain("299792458");
    const g = index.byId.get("const:G") as FindItem;
    expect(itemRow(g, () => {}).preview).toContain(`± ${g.unc}`);
    const tier1 = index.items.find((it) => it.tier === 1) as FindItem;
    expect(itemRow(tier1, () => {}).preview).toContain("not checked");
  });

  it("a constant goes on the line as a chip with its value; an uncertain one is not exact", () => {
    expect(constChipOf(index.byId.get("const:c") as FindItem)).toEqual({ id: "c", symbol: "c", chip: { value: "299792458", exact: true } });
    const g = constChipOf(index.byId.get("const:G") as FindItem);
    expect(g?.chip.exact).toBe(false);
    expect(g?.chip.unc).toBeTruthy();
    expect(constChipOf(index.byId.get("fn:solve") as FindItem)).toBeUndefined();
    // G81: an inexact constant's chip carries its basis and leaves (G80); an exact one carries none
    const mu = index.byId.get("const:mu_0") as FindItem;
    expect(constChipOf(mu)?.chip).toMatchObject({ basis: mu.basis, basisLeaves: mu.basisLeaves });
    expect(constChipOf(mu)?.chip.basis).toContain("pasl_fine_structure");
    expect(constChipOf(index.byId.get("const:c") as FindItem)?.chip).not.toHaveProperty("basis");
  });

  it("picking a row runs the pick with its item", () => {
    menu.search("det")[0]?.run?.();
    expect(picked.map((it) => it.id)).toEqual(["fn:det"]);
  });
});

describe.skipIf(!full)("the idle load", () => {
  it("prepares the index a slice per idle moment, never in one long task, and gives the same index", async () => {
    let calls = 0;
    // each idle moment has no time left: one slice per moment
    vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => {
      calls++;
      setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
      return calls;
    });
    try {
      const idle = await makeIndexIdle(raw);
      expect(calls).toBe(Math.ceil(raw.length / 200));
      expect(idle.items.map((it) => it.id)).toEqual(makeIndex(raw).items.map((it) => it.id));
      expect(idle.byId.size).toBe(raw.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("prepares nothing while a job runs, and goes on when it ends", async () => {
    let calls = 0;
    let jobs = 3; // the first three idle moments come while a job runs
    vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => {
      calls++;
      setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
      return calls;
    });
    pauseWhile(() => jobs-- > 0);
    try {
      const idle = await makeIndexIdle(raw);
      expect(calls).toBe(3 + Math.ceil(raw.length / 200));
      expect(idle.byId.size).toBe(raw.length);
    } finally {
      pauseWhile(() => false);
      vi.unstubAllGlobals();
    }
  });
});
