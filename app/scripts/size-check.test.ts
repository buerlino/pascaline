// SPDX-License-Identifier: GPL-3.0-or-later
// The size test must itself fail when it should: fake build folders with chunks under and over each budget.
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkLazyParts, checkSizes, checkSplits, checkStartPin, INLINE_PIN_GZIP, inlineScripts, LAZY_PARTS, START_PIN_GZIP, startFiles } from "./size-check.ts";

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

/** The Find UI chunk as a shared chunk (Rollup's "finder", no src): a build must hold src/find/finder.ts somewhere. */
const FINDER = { "_finder.js": { file: "assets/finder.js", name: "finder" } };
const FINDER_FILE = { "assets/finder.js": 8000 };

const base = (startBytes: number) => ({
  manifest: {
    ...FINDER,
    "index.html": { file: "assets/index.js", src: "index.html", isEntry: true },
    "../../../../app/node_modules/mathlive/mathlive.min.mjs": { file: "assets/mathlive.js", src: "../../../../app/node_modules/mathlive/mathlive.min.mjs", isDynamicEntry: true },
  },
  files: { ...FINDER_FILE, "assets/index.js": startBytes, "assets/mathlive.js": 800_000 },
});

describe("size-check", () => {
  it("passes a build inside the budgets and lists the chunks that are not built yet", () => {
    const { manifest, files } = base(140_000);
    const r = checkSizes(fakeDist(manifest, files));
    expect(r.failures).toEqual([]);
    expect(r.rows.map((x) => x.rule)).toEqual(["Start chunk", "MathLive chunk", "Find UI chunk", "Precache total"]);
    expect(r.notBuilt).toEqual(["Inline scripts", "Unit view chunk", "Find index asset", "qalc wasm + glue"]);
  });

  it("pins index.html's inline scripts at 1.53 kB gzip, each script alone and summed, not the module script (R103, vr-4)", () => {
    expect(INLINE_PIN_GZIP).toBe(1_530);
    const page = (a: string, b: string): string =>
      `<html><head><script>${a}</script></head><body><div id="app"></div><script>\n${b}</script><script type="module" crossorigin src="./assets/index.js"></script><script type="module">import "x";</script></body></html>`;
    expect(inlineScripts(page("var a = 1;", "var b = 2;")).map((t) => t.trim())).toEqual(["var a = 1;", "var b = 2;"]);
    const { manifest, files } = base(1000);
    const withPage = (html: string): string => {
      const dist = fakeDist(manifest, files);
      writeFileSync(join(dist, "index.html"), html);
      return dist;
    };
    // base64 of random bytes gzips to about 0.81 of its length: 900 B twice sits under the pin, 1000 B twice over it
    const text = (n: number): string => randomBytes(n).toString("base64").slice(0, n);
    const inside = checkSizes(withPage(page(text(900), text(900))));
    const row = inside.rows.find((x) => x.rule === "Inline scripts")!;
    expect(row.raw).toBe(1801); // the second script starts with a newline
    expect(row.gzip).toBeLessThanOrEqual(INLINE_PIN_GZIP);
    expect(inside.failures).toEqual([]);
    const over = checkSizes(withPage(page(text(1000), text(1000))));
    expect(over.rows.find((x) => x.rule === "Inline scripts")!.gzip).toBeGreaterThan(INLINE_PIN_GZIP);
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Inline scripts"]);
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
      ...FINDER,
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js", "_b.js"], dynamicImports: ["lazy.js"] },
      "_a.js": { file: "assets/a.js", imports: ["_c.js"] },
      "_b.js": { file: "assets/b.js", imports: ["_c.js"] }, // diamond: _c is reached twice
      "_c.js": { file: "assets/c.js" },
      "lazy.js": { file: "assets/lazy.js", isDynamicEntry: true, src: "lazy.js" },
    };
    expect(startFiles(manifest).sort()).toEqual(["assets/a.js", "assets/b.js", "assets/c.js", "assets/index.js"]);
    // Each file is 50 kB: the entry alone is under 175 kB, the four together (200 kB) are over. lazy.js (1 MB) must not count.
    const files = { ...FINDER_FILE, "assets/index.js": 50_000, "assets/a.js": 50_000, "assets/b.js": 50_000, "assets/c.js": 50_000, "assets/lazy.js": 1_000_000 };
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
      ...FINDER,
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js"] },
      "_a.js": { file: "assets/a.js" },
    };
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": 70_000, "assets/a.js": 70_000 }));
    expect(r.failures).toEqual([]);
  });

  it("reports an import the manifest does not list instead of ignoring it", () => {
    const manifest = { "index.html": { file: "assets/index.js", isEntry: true, imports: ["_missing.js"] } };
    expect(() => startFiles(manifest)).toThrow(/_missing\.js/);
  });

  it("fails a start chunk over 61 kB gzip even when it is under 175 kB raw", () => {
    const { manifest } = base(0);
    // Random bytes do not compress, so 62 kB raw is over 61 kB gzip and well under 175 kB raw.
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 62_000 }, "assets/mathlive.js": 1000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("gzip");
  });

  it("fails the MathLive chunk over 830 kB, found by its source path under node_modules", () => {
    const { manifest } = base(1000);
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": 1000, "assets/mathlive.js": 830_001 }));
    expect(r.failures.map((f) => f.split(":")[0])).toEqual(["MathLive chunk"]);
  });

  it("applies the Find, Units, index and qalc budgets as soon as the chunks exist", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const dist = fakeDist(
      {
        ...noFinder,
        "src/find/finder.ts": { file: "assets/find.js", src: "src/find/finder.ts", isDynamicEntry: true },
        "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true },
        "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true },
      },
      { ...files, "assets/find.js": 30_001, "assets/units.js": 10_000, "assets/open.js": 28_000, "find/index.json": { random: 400_001 }, "qalc/qalc.wasm": { random: 1_000_001 }, "qalc/qalc.mjs": 1000, "index.html": 100 },
    );
    const r = checkSizes(dist);
    expect(r.notBuilt).toEqual([]);
    const failed = r.failures.map((f) => f.split(":")[0]);
    expect(failed).toContain("Find UI chunk");
    expect(failed).not.toContain("Unit view chunk"); // the UI chunk and the builder together, exactly at 38 kB, are allowed
    expect(failed).toContain("Find index asset");
    expect(failed).toContain("qalc wasm + glue");
  });

  it("budgets the unit view's UI chunk and builder as one, at 38 kB raw (R24c; Opus pass 24, G81)", () => {
    const { manifest, files } = base(1000);
    const units = {
      ...manifest,
      "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true },
      "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true },
    };
    const r = checkSizes(fakeDist(units, { ...files, "assets/units.js": 10_000, "assets/open.js": 28_001 }));
    expect(r.failures.map((f) => f.split(":")[0])).toEqual(["Unit view chunk"]);
    expect(r.rows.find((x) => x.rule === "Unit view chunk")?.files.sort()).toEqual(["assets/open.js", "assets/units.js"]);
  });

  it("measures the Find UI chunk when src/find/finder.ts is a dynamic entry, at 30 kB raw", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const entry = { ...noFinder, "src/find/finder.ts": { file: "assets/finder-e.js", name: "finder", src: "src/find/finder.ts", isDynamicEntry: true } };
    const ok = checkSizes(fakeDist(entry, { ...files, "assets/finder-e.js": 30_000 }));
    expect(ok.failures).toEqual([]);
    expect(ok.rows.find((x) => x.rule === "Find UI chunk")?.files).toEqual(["assets/finder-e.js"]);
    const over = checkSizes(fakeDist(entry, { ...files, "assets/finder-e.js": 30_001 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Find UI chunk"]);
  });

  it("measures the Find UI chunk when finder.ts is a shared chunk named finder (no src), at 30 kB raw", () => {
    const { manifest, files } = base(1000);
    const shared = { ...manifest, "_finder.js": { file: "assets/finder-s.js", name: "finder", imports: ["_enFind.js"] }, "_enFind.js": { file: "assets/enFind.js", name: "enFind" } };
    const ok = checkSizes(fakeDist(shared, { ...files, "assets/finder-s.js": 8000, "assets/enFind.js": 90_000 }));
    expect(ok.failures).toEqual([]);
    expect(ok.rows.find((x) => x.rule === "Find UI chunk")?.files).toEqual(["assets/finder-s.js"]);
    const over = checkSizes(fakeDist(shared, { ...files, "assets/finder-s.js": 30_001, "assets/enFind.js": 90_000 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Find UI chunk"]);
  });

  it("fails when no chunk holds src/find/finder.ts, instead of listing the rule as not built yet", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const r = checkSizes(fakeDist(noFinder, { "assets/index.js": 1000, "assets/mathlive.js": 1000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("Find UI chunk");
    expect(r.failures[0]).toContain("src/find/finder.ts");
    expect(r.notBuilt).not.toContain("Find UI chunk");
    void files;
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

  it("pins the start chunk at 59.35 kB gzip, below the 61 kB budget (R91: the room for the Settings base; R70f1: the split; R61: measured 59.16 kB + 0.05; R71: measured 59.24 kB + 0.06; R93: measured 59.33 kB + 0.05; R94: measured 59.42 kB + 0.05; R95: measured 59.76 kB + 0.05; R99: measured 59.82 kB + 0.05; R100: measured 59.95 kB + 0.05; R97: measured 60.20 kB + 0.05; R102: measured 60.31 kB + 0.05; R63: measured 60.54 kB + 0.05; R15c4: measured 60.89 kB + 0.05; R55: measured 60.97 kB + 0.02; R103: the migrations on demand, measured 58.39 kB + 0.05; R89: the presets' name prompt, measured 58.44 kB + 0.05; R33: the stored-name marks, measured 58.51 kB + 0.05; R36f1: the row line after merging phase-1, measured 58,568 B + 0.05 kB; R98: the Undo of Clear and Delete, measured 59,019 B + 0.05 kB; R98 fix 2: rows by id, the note when its code is missing, measured 59,108 B + 0.05 kB; R96f1: the store health per key, measured 59,185 B + 0.05 kB; R121: the Home row's line on names read as pure numbers, measured 59,300 B + 0.05 kB after merging phase-1)", () => {
    expect(START_PIN_GZIP).toBe(59_350);
    const { manifest } = base(0);
    const over = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 59_400 }, "assets/mathlive.js": 1000 }));
    expect(over.failures).toEqual([]); // inside the budget of 61 kB ...
    expect(over.rows[0]!.gzip).toBeGreaterThan(59_350);
    expect(checkStartPin(over.rows[0]!)[0]).toContain("pinned"); // ... and over the pin
    const inside = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 58_000 }, "assets/mathlive.js": 1000 }));
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

  it("takes a lazy part that Rollup made a shared chunk named after it (no src), and fails it at start (R103: state/migrations.ts)", () => {
    const { manifest, files } = base(1000);
    const others = LAZY_PARTS.filter((src) => src !== "src/state/migrations.ts");
    const lazy = Object.fromEntries(others.map((src, n) => [src, { file: `assets/p${n}.js`, src, isDynamicEntry: true }]));
    const sizes = Object.fromEntries(others.map((_, n) => [`assets/p${n}.js`, 1000]));
    const shared = { "_migrations-x.js": { file: "assets/migrations-x.js", name: "migrations", imports: ["index.html"] } };
    const all = { ...files, ...sizes, "assets/migrations-x.js": 1000 };
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy, ...shared }, all))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: ["_migrations-x.js"] }, ...lazy, ...shared };
    expect(checkLazyParts(fakeDist(atStart, all))).toEqual(["src/state/migrations.ts (assets/migrations-x.js) is loaded at start"]);
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy }, all))[0]).toContain("src/state/migrations.ts is not a dynamic chunk");
  });
});
