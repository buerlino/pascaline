// SPDX-License-Identifier: GPL-3.0-or-later
// A68: `npm run dev` rebuilds the Find index only when a source is newer than it (or it is missing).
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { indexSources, refreshIndex, staleReason } from "./devindex.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const at = (p: string, sec: number) => utimesSync(p, sec, sec);

/** A fake repo: find/units.yaml, tools/find-index/generate.mjs and an index; returns the paths. */
function fake() {
  const root = mkdtempSync(join(tmpdir(), "devindex-"));
  dirs.push(root);
  for (const d of ["find", "tools/find-index/sub", "tests/golden", "app/src/find/_gen"]) mkdirSync(join(root, d), { recursive: true });
  const w = (rel: string) => {
    writeFileSync(join(root, rel), "x");
    at(join(root, rel), 1000);
    return join(root, rel);
  };
  const units = w("find/units.yaml");
  const gen = w("tools/find-index/sub/deep.mjs");
  const golden = w("tests/golden/a.yaml");
  const index = w("app/src/find/_gen/find-index.json");
  at(index, 2000);
  return { root, units, gen, golden, index };
}

function run(f: ReturnType<typeof fake>, tarballs: string[] = []) {
  const lines: string[] = [];
  let calls = 0;
  const code = refreshIndex({ index: f.index, sources: indexSources(f.root, tarballs), generate: () => (calls++, 0), log: (l) => lines.push(l) });
  return { code, calls, lines };
}

describe("dev index refresh (A68)", () => {
  it("does not run the generator when the index is newer than every source", () => {
    const r = run(fake());
    expect(r.calls).toBe(0);
    expect(r.lines).toEqual(["find index: up to date, not rebuilt"]);
  });

  it("rebuilds when find/units.yaml is newer than the index", () => {
    const f = fake();
    at(f.units, 3000);
    const r = run(f);
    expect(r.calls).toBe(1);
    expect(r.lines[0]).toContain("rebuilding");
    expect(r.lines[0]).toContain("units.yaml");
  });

  it("rebuilds when a generator file, even a nested one, is newer", () => {
    const f = fake();
    at(f.gen, 3000);
    expect(run(f).calls).toBe(1);
  });

  it("rebuilds when a golden case file or a pinned tarball is newer", () => {
    const f = fake();
    at(f.golden, 3000);
    expect(run(f).calls).toBe(1);
    const g = fake();
    const tar = join(g.root, "q.tar.gz");
    writeFileSync(tar, "x");
    at(tar, 3000);
    expect(run(g, [tar]).calls).toBe(1);
    expect(run(g, [join(g.root, "absent.tar.gz")]).calls).toBe(0); // an absent tarball is the generator's error to report
  });

  it("rebuilds when the index is missing, and reports a failing generator", () => {
    const f = fake();
    rmSync(f.index);
    expect(staleReason(f.index, indexSources(f.root, []))).toBe("missing");
    const lines: string[] = [];
    const code = refreshIndex({ index: f.index, sources: [], generate: () => 3, log: (l) => lines.push(l) });
    expect(code).toBe(3);
    expect(lines.at(-1)).toContain("FAILED");
  });
});
