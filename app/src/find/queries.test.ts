// SPDX-License-Identifier: GPL-3.0-or-later
// The Find query test (docs/04 3.8): tests/tasks/find-queries.yaml against the generated index and the real
// ranking. Gate: every active phrase in the top 3, at least 90 % first. Also the index budgets of 3.3 and 3.9.
// Needs the generated index: `npm run index` (skipped with a warning when it is missing).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { functionInsert, prepare, search } from "./rank.ts";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "_gen/find-index.json");
const hasIndex = existsSync(indexFile);

interface Query { query: string; expect: string; note?: string; status?: "pending" }
const doc = parse(readFileSync(join(here, "../../../tests/tasks/find-queries.yaml"), "utf8")) as { schema: number; queries: Query[] };
const active = doc.queries.filter((q) => q.status !== "pending");

describe("find-queries.yaml", () => {
  it("has 100 active phrases and 10 pending ones, no duplicates", () => {
    expect(doc.schema).toBe(1);
    expect(active.length).toBe(100);
    expect(doc.queries.length - active.length).toBe(10);
    expect(new Set(doc.queries.map((q) => q.query)).size).toBe(doc.queries.length);
    for (const q of doc.queries) expect(q.query, q.query).toBe(q.query.toLowerCase()); // Find types lower case only
  });
});

describe.skipIf(!hasIndex)("Find index and query test", () => {
  const json = hasIndex ? readFileSync(indexFile, "utf8") : "[]";
  const items = JSON.parse(json) as IndexItem[];
  const index = prepare(items);
  const byId = new Map(items.map((it) => [it.id, it]));

  it("stays within its budgets: ≤ 400 kB raw, ≤ 100 kB gzip", () => {
    expect(Buffer.byteLength(json)).toBeLessThanOrEqual(400_000);
    expect(gzipSync(json, { level: 9 }).length).toBeLessThanOrEqual(100_000);
  });

  it("holds every kind, unique ids, no currencies, the fields of the schema", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const k of ["fn", "tmpl", "const", "unit", "pfx"]) expect(items.some((i) => i.kind === k), k).toBe(true);
    for (const it of items) {
      expect(it.id.startsWith(`${it.kind}:`), it.id).toBe(true);
      expect(it.names.length, it.id).toBeGreaterThan(0);
      expect(it.title, it.id).toBeTruthy();
      // a tier-1 function's insert is left out of the index and filled in by prepare() (decisions.md G4 item 1)
      if (it.kind === "fn" && it.tier === 1) expect(it.insert, it.id).toBeUndefined();
      else expect(it.insert, it.id).toBeTruthy();
      expect([0, 1]).toContain(it.tier);
      expect(/currency|^unit:(EUR|USD|GBP|JPY|CHF|BTC)\b/i.test(`${it.id} ${it.title}`), it.id).toBe(false);
      if (it.kind === "const") expect(it.value, it.id).toBeTruthy();
    }
  });

  it("every prepared item has its insert; a tier-1 function's is the \\operatorname template of its name", () => {
    for (const p of index.items) expect(p.item.insert, p.item.id).toBeTruthy();
    const uniform = index.items.find((p) => p.item.id === "fn:uniform_cdf")?.item;
    expect(uniform?.tier).toBe(1);
    expect(uniform?.insert).toBe("\\operatorname{uniform\\_cdf}\\left(#?\\right)");
    expect(functionInsert("fn:uniform_cdf")).toBe(uniform?.insert);
  });

  it("names every expected id of an active phrase", () => {
    const missing = active.filter((q) => !byId.has(q.expect)).map((q) => `${q.query} -> ${q.expect}`);
    expect(missing).toEqual([]);
  });

  it("ranks every phrase in the top 3, at least 90 % first", () => {
    const rows = active.map((q) => {
      const hits = search(index, q.query).slice(0, 3).map((h) => h.item.id);
      return { q, rank: hits.indexOf(q.expect) + 1, top: hits };
    });
    const first = rows.filter((r) => r.rank === 1).length;
    const report = rows.filter((r) => r.rank !== 1).map((r) => `${r.q.query} -> ${r.q.expect}: ${r.rank || "not in top 3"} [${r.top.join(", ")}]`);
    console.log(`find queries: ${first}/${rows.length} first, ${rows.filter((r) => r.rank > 0).length}/${rows.length} in the top 3`
      + (report.length ? `\n  ${report.join("\n  ")}` : ""));
    expect(rows.filter((r) => r.rank === 0).map((r) => r.q.query)).toEqual([]);
    expect(first / rows.length).toBeGreaterThanOrEqual(0.9);
  });

  it("takes well under 16 ms per key on the desktop (the device gate is ?bench=find)", () => {
    const keys = active.flatMap((q) => [...q.query].map((_, i) => q.query.slice(0, i + 1)));
    for (const k of keys.slice(0, 50)) search(index, k); // warm up
    const times: number[] = [];
    for (const k of keys) { const t = performance.now(); search(index, k); times.push(performance.now() - t); }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
    console.log(`find queries: ${keys.length} keys, p50 ${(times[times.length >> 1] ?? 0).toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    expect(p95).toBeLessThan(8);
  });
});

it("finds the generated index (otherwise the query test was skipped)", () => {
  if (!hasIndex) console.warn("queries.test: no app/src/find/_gen/find-index.json (npm run index); the query test was skipped");
});
