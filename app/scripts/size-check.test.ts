// SPDX-License-Identifier: GPL-3.0-or-later
// The size test must itself fail when it should: fake build folders with chunks under and over each budget.
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkLazyParts, checkSizes, checkSplits, checkStartPin, LAZY_PARTS, startFiles } from "./size-check.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A size in bytes. A plain number compresses well (20 kB of random bytes, then zeros); `{ random }` is incompressible. */
type Size = number | { random: number };

/** A fake dist: `files` maps a path to its size. */
function fakeDist(manifest: Record<string, object>, files: Record<string, Size>): string {
  const dist = mkdtempSync(join(tmpdir(), "size-check-"));
  dirs.push(dist);
  mkdirSync(join(dist, ".vite"));
  writeFileSync(join(dist, ".vite/manifest.json"), JSON.stringify(manifest));
  for (const [path, size] of Object.entries(files)) {
    mkdirSync(join(dist, path, ".."), { recursive: true });
    const content = typeof size === "number" ? Buffer.concat([randomBytes(Math.min(size, 20_000)), Buffer.alloc(Math.max(0, size - 20_000))]) : randomBytes(size.random);
    writeFileSync(join(dist, path), content);
  }
  return dist;
}

const base = (startBytes: number) => ({
  manifest: {
    "index.html": { file: "assets/index.js", src: "index.html", isEntry: true },
    "../../../../app/node_modules/mathlive/mathlive.min.mjs": { file: "assets/mathlive.js", src: "../../../../app/node_modules/mathlive/mathlive.min.mjs", isDynamicEntry: true },
  },
  files: { "assets/index.js": startBytes, "assets/mathlive.js": 800_000 },
});

describe("size-check", () => {
  it("passes a build inside the budgets and lists the chunks that are not built yet", () => {
    const { manifest, files } = base(140_000);
    const r = checkSizes(fakeDist(manifest, files));
    expect(r.failures).toEqual([]);
    expect(r.rows.map((x) => x.rule)).toEqual(["Start chunk", "MathLive chunk", "Precache total"]);
    expect(r.notBuilt).toEqual(["Find UI chunk", "Unit view chunk", "Find index asset", "qalc wasm + glue"]);
  });

  it("fails a start chunk over 175 kB raw", () => {
    const { manifest, files } = base(175_001);
    const r = checkSizes(fakeDist(manifest, files));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("Start chunk");
    expect(r.failures[0]).toContain("raw");
  });

  it("counts the entry plus every chunk it imports, transitively, once each, and not dynamic imports", () => {
    const manifest = {
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js", "_b.js"], dynamicImports: ["lazy.js"] },
      "_a.js": { file: "assets/a.js", imports: ["_c.js"] },
      "_b.js": { file: "assets/b.js", imports: ["_c.js"] }, // diamond: _c is reached twice
      "_c.js": { file: "assets/c.js" },
      "lazy.js": { file: "assets/lazy.js", isDynamicEntry: true, src: "lazy.js" },
    };
    expect(startFiles(manifest).sort()).toEqual(["assets/a.js", "assets/b.js", "assets/c.js", "assets/index.js"]);
    // Each file is 50 kB: the entry alone is under 175 kB, the four together (200 kB) are over. lazy.js (1 MB) must not count.
    const files = { "assets/index.js": 50_000, "assets/a.js": 50_000, "assets/b.js": 50_000, "assets/c.js": 50_000, "assets/lazy.js": 1_000_000 };
    const r = checkSizes(fakeDist(manifest, files));
    const start = r.rows.find((x) => x.rule === "Start chunk");
    expect(start?.raw).toBe(200_000);
    expect(start?.files.sort()).toEqual(["assets/a.js", "assets/b.js", "assets/c.js", "assets/index.js"]);
    // Over both the raw budget (200 kB > 175 kB) and the gzip one (80 kB of random bytes > 61 kB); nothing else fails.
    expect(r.failures.every((f) => f.startsWith("Start chunk"))).toBe(true);
    expect(r.failures.some((f) => f.includes("raw"))).toBe(true);
  });

  it("passes a start split into imported chunks when their sum is inside the budget", () => {
    const manifest = {
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js"] },
      "_a.js": { file: "assets/a.js" },
    };
    const r = checkSizes(fakeDist(manifest, { "assets/index.js": 70_000, "assets/a.js": 70_000 }));
    expect(r.failures).toEqual([]);
  });

  it("reports an import the manifest does not list instead of ignoring it", () => {
    const manifest = { "index.html": { file: "assets/index.js", isEntry: true, imports: ["_missing.js"] } };
    expect(() => startFiles(manifest)).toThrow(/_missing\.js/);
  });

  it("fails a start chunk over 61 kB gzip even when it is under 175 kB raw", () => {
    const { manifest } = base(0);
    // Random bytes do not compress, so 62 kB raw is over 61 kB gzip and well under 175 kB raw.
    const r = checkSizes(fakeDist(manifest, { "assets/index.js": { random: 62_000 }, "assets/mathlive.js": 1000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("gzip");
  });

  it("fails the MathLive chunk over 830 kB, found by its source path under node_modules", () => {
    const { manifest } = base(1000);
    const r = checkSizes(fakeDist(manifest, { "assets/index.js": 1000, "assets/mathlive.js": 830_001 }));
    expect(r.failures.map((f) => f.split(":")[0])).toEqual(["MathLive chunk"]);
  });

  it("applies the Find, Units, index and qalc budgets as soon as the chunks exist", () => {
    const { manifest, files } = base(1000);
    const dist = fakeDist(
      {
        ...manifest,
        "src/find/FindPalette.svelte": { file: "assets/find.js", src: "src/find/FindPalette.svelte", isDynamicEntry: true },
        "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true },
      },
      { ...files, "assets/find.js": 30_001, "assets/units.js": 30_000, "find/index.json": { random: 400_001 }, "qalc/qalc.wasm": { random: 1_000_001 }, "qalc/qalc.mjs": 1000 },
    );
    const r = checkSizes(dist);
    expect(r.notBuilt).toEqual([]);
    const failed = r.failures.map((f) => f.split(":")[0]);
    expect(failed).toContain("Find UI chunk");
    expect(failed).not.toContain("Unit view chunk"); // exactly at 30 kB is allowed
    expect(failed).toContain("Find index asset");
    expect(failed).toContain("qalc wasm + glue");
  });

  it("fails a precache total over 18 MB, not counting source maps, sw.js or .vite/", () => {
    const { manifest, files } = base(1000);
    const ok = checkSizes(fakeDist(manifest, { ...files, "assets/x.js.map": 20_000_000, "sw.js": 20_000_000 }));
    expect(ok.failures).toEqual([]);
    const over = checkSizes(fakeDist(manifest, { ...files, "engine/giac.wasm": 17_300_000 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Precache total"]);
  });

  it("reports a missing manifest instead of passing", () => {
    const dist = mkdtempSync(join(tmpdir(), "size-check-"));
    dirs.push(dist);
    expect(() => checkSizes(dist)).toThrow(/manifest/);
  });

  it("fails when the sheet's view is not its own chunk, or is loaded at start (R46)", () => {
    const { manifest, files } = base(1000);
    expect(checkSplits(fakeDist(manifest, files))[0]).toContain("src/views/Sheet.svelte");
    const lazy = { "src/views/Sheet.svelte": { file: "assets/sheet.js", src: "src/views/Sheet.svelte", isDynamicEntry: true } };
    expect(checkSplits(fakeDist({ ...manifest, ...lazy }, { ...files, "assets/sheet.js": 1000 }))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: ["src/views/Sheet.svelte"] }, ...lazy };
    expect(checkSplits(fakeDist(atStart, { ...files, "assets/sheet.js": 1000 }))[0]).toContain("loaded at start");
  });

  it("pins the start chunk at 58.5 kB gzip, below the 61 kB budget (R91: the room for the Settings base)", () => {
    const { manifest } = base(0);
    const over = checkSizes(fakeDist(manifest, { "assets/index.js": { random: 59_000 }, "assets/mathlive.js": 1000 }));
    expect(over.failures).toEqual([]); // inside the budget of 61 kB ...
    expect(checkStartPin(over.rows[0]!)[0]).toContain("pinned"); // ... and over the pin
    const inside = checkSizes(fakeDist(manifest, { "assets/index.js": { random: 58_400 }, "assets/mathlive.js": 1000 }));
    expect(checkStartPin(inside.rows[0]!)).toEqual([]);
  });

  it("fails when a part that only runs after a key press or a result is loaded at start, or is not its own chunk (R91)", () => {
    const { manifest, files } = base(1000);
    expect(checkLazyParts(fakeDist(manifest, files)).map((f) => f.split(" ")[0])).toEqual(LAZY_PARTS);
    const lazy = Object.fromEntries(LAZY_PARTS.map((src, n) => [src, { file: `assets/p${n}.js`, src, isDynamicEntry: true }]));
    const sizes = Object.fromEntries(LAZY_PARTS.map((_, n) => [`assets/p${n}.js`, 1000]));
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy }, { ...files, ...sizes }))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: [LAZY_PARTS[0]] }, ...lazy };
    expect(checkLazyParts(fakeDist(atStart, { ...files, ...sizes }))[0]).toContain("loaded at start");
  });
});
