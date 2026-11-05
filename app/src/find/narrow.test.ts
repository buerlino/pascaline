// SPDX-License-Identifier: GPL-3.0-or-later
// R132 (E3): a query that only adds a letter is searched among the last search's candidates (rank.ts, search). Its
// hits and their order must be those of a search over every item: checked key by key on the generated index for the
// query file's phrases and for one-edit typos of item names (the fuzzy level, the one that can widen), and on a hand
// case where the longer query finds an item the shorter one does not.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { forgetLastSearch, prepare, search, type PreparedIndex } from "./rank.ts";
import type { FindContext, FindHit, FindItem, IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "_gen/find-index.json");
const raw = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = raw.some((it) => it.kind === "unit");
const queries = (parse(readFileSync(join(here, "../../../tests/tasks/find-queries.yaml"), "utf8")) as { queries: { query: string; where?: string }[] }).queries;
const SLOT: FindContext = { filter: ["unit", "pfx"], prefer: ["unit"] };

const shown = (hs: readonly FindHit[]): string[] => hs.map((h) => `${h.item.id} ${h.score} ${h.matched}`);
/** Type `q` a letter at a time: each key's narrowed hits must equal a fresh search's over every item. */
function typeAndCompare(index: PreparedIndex, q: string, ctx: FindContext, limit: number): number {
  const keys = Array.from({ length: q.length }, (_, i) => q.slice(0, i + 1));
  forgetLastSearch();
  search(index, q.slice(0, 1), { ...ctx, limit }); // the first key kept (finder.ts warms them), as Find has it
  search(index, "zzzz"); // and another query between: the first key's own candidates still narrow the second
  const narrowed = keys.map((k) => shown(search(index, k, { ...ctx, limit })));
  const fresh = keys.map((k) => (forgetLastSearch(), shown(search(index, k, { ...ctx, limit }))));
  let differ = 0;
  keys.forEach((k, i) => {
    if (narrowed[i]?.join("\n") === fresh[i]?.join("\n")) return;
    differ++;
    expect(narrowed[i], `${k} (typing ${q})`).toEqual(fresh[i]);
  });
  return differ;
}

/** One-edit typos of `s`: each letter dropped, doubled, swapped with the next, and changed to the next letter. */
function typos(s: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < s.length; i++) {
    out.add(s.slice(0, i) + s.slice(i + 1));
    out.add(s.slice(0, i) + (s[i] as string) + s.slice(i));
    if (i + 1 < s.length) out.add(s.slice(0, i) + (s[i + 1] as string) + (s[i] as string) + s.slice(i + 2));
    out.add(s.slice(0, i) + String.fromCharCode(((s.charCodeAt(i) - 96) % 26) + 97) + s.slice(i + 1));
  }
  return [...out].filter((t) => t.length >= 3);
}

describe("search narrows a longer query to the last one's candidates (R132)", () => {
  it("finds what a fresh search finds when a letter makes a typo reachable (abcd → abcde finds acde) or a word starts (-- → --x)", () => {
    const item = (id: string, name: string): FindItem => ({ id, kind: "unit", names: [name], title: name, tier: 0, insert: "x" });
    const index = prepare([item("unit:acde", "acde"), item("unit:abcx", "abcx"), item("unit:bbcd", "bbcd"), item("unit:psia", "psia"), item("unit:xray", "x ray")]);
    for (const q of ["abcde", "abcd ex", "psigx", "bbdce", "--xr", "a-b ray", "x r"]) expect(typeAndCompare(index, q, {}, 50), q).toBe(0);
    forgetLastSearch();
    for (const k of ["a", "ab", "abc", "abcd"]) search(index, k);
    expect(search(index, "abcde").map((h) => h.item.id)).toContain("unit:acde");
  });

  it.skipIf(!hasIndex && process.env.FIND_INDEX !== "required")("gives the hits and order of a fresh search on the generated index, key by key", () => {
    expect(hasIndex, "the full Find index (npm run index)").toBe(true);
    const index = prepare(raw);
    let keys = 0;
    queries.forEach(({ query: q, where }, j) => {
      expect(typeAndCompare(index, q, where === "slot" ? SLOT : {}, 50), q).toBe(0);
      const ts = typos(q.replace(/\s+/g, ""));
      const t = j % 2 === 0 ? ts[(j * 7) % ts.length] : undefined; // every other phrase with one typo, at a different place each time
      if (t !== undefined) expect(typeAndCompare(index, t, {}, 50), t).toBe(0);
      keys += q.length + (t?.length ?? 0);
    });
    // names of the index: typed whole and with one-edit typos, a third with every hit (a category's search reads them all)
    const names = raw.filter((_, i) => i % 53 === 0).flatMap((it) => it.names.slice(0, 1)).map((n) => n.toLowerCase().replace(/_/g, " "));
    for (const n of names) for (const t of [n, typos(n.replace(/\s+/g, ""))[n.length % 4] ?? n]) {
      expect(typeAndCompare(index, t, {}, n.length % 3 === 0 ? raw.length : 50), t).toBe(0);
      keys += t.length;
    }
    expect(keys).toBeGreaterThan(1500);
  }, 60_000);
});
