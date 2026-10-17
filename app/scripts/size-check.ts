// SPDX-License-Identifier: GPL-3.0-or-later
// The size test (docs/04 section 8.3): reads Vite's manifest (dist/.vite/manifest.json, `build.manifest: true`) and the
// build output, and exits 1 when a chunk is over its budget. Run by `npm run build` (so by build.sh) and as `npm run size`.
//   node scripts/size-check.ts [distDir]        # default: app/dist
// The Start chunk is the entry plus every chunk it imports statically (manifest `imports`, transitively), because all of it loads at start.
// Units are Vite's: 1 kB = 1000 B, 1 MB = 1,000,000 B (so today's 142.62 kB start chunk is 142,626 B). Gzip is zlib's
// default level, which is what `vite build` reports. Budgets for chunks that don't exist yet (Find, Units, qalc) apply
// as soon as they appear in the build; until then they print as "not built". To change a budget, change docs/04 8.3 too.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { precacheFiles } from "../vite-plugin-pwa-lite.ts";

const KB = 1000;
const MB = 1_000_000;

interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  /** Manifest keys of the chunks this one imports statically (loaded with it). `dynamicImports` load later and are not listed here. */
  imports?: string[];
}

/** One budgeted thing: the files it covers (paths relative to dist) and its limits in bytes. */
interface Subject {
  rule: string;
  files: string[];
  rawMax?: number;
  gzipMax?: number;
  brotliMax?: number;
}

export interface Row {
  rule: string;
  files: string[];
  raw: number;
  gzip: number;
  brotli: number;
  rawMax: number | undefined;
  gzipMax: number | undefined;
  brotliMax: number | undefined;
  failures: string[];
}

export interface Report {
  rows: Row[];
  /** Rules whose chunk is not in this build (yet). */
  notBuilt: string[];
  failures: string[];
}

/** Vite writes sources relative to the project root, so a path in node_modules can start with "../../": strip those. */
function normalSrc(src: string | undefined): string {
  return (src ?? "").replace(/^(\.\.\/)+/, "");
}

function readManifest(dist: string): Record<string, ManifestChunk> {
  const path = join(dist, ".vite/manifest.json");
  if (!existsSync(path)) throw new Error(`size-check: no ${path}; build with build.manifest: true (vite.config.ts)`);
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, ManifestChunk>;
}

/** The files loaded at start: every entry chunk plus every chunk it imports, transitively (the manifest's `imports`, not `dynamicImports`). Each file once. */
export function startFiles(manifest: Record<string, ManifestChunk>): string[] {
  const files = new Set<string>();
  const seen = new Set<string>();
  const visit = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined) throw new Error(`size-check: the manifest imports "${key}", which it does not list`);
    files.add(chunk.file);
    for (const dep of chunk.imports ?? []) visit(dep);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
  return [...files];
}

/** The budgets of docs/04 section 8.3 that apply to files of the build; the device bars are not here. */
function subjects(manifest: Record<string, ManifestChunk>, all: string[]): { present: Subject[]; absent: string[] } {
  const chunks = Object.values(manifest);
  const present: Subject[] = [];
  const absent: string[] = [];
  const add = (rule: string, files: string[], limits: Omit<Subject, "rule" | "files">): void => {
    if (files.length > 0) present.push({ rule, files, ...limits });
    else absent.push(rule);
  };
  const dynamic = (prefix: string): string[] => chunks.filter((c) => c.isDynamicEntry && normalSrc(c.src).startsWith(prefix)).map((c) => c.file);

  add("Start chunk", startFiles(manifest), { rawMax: 156 * KB, gzipMax: 54 * KB });
  add("MathLive chunk", chunks.filter((c) => /(^|\/)mathlive\/mathlive\.min\.m?js$/.test(normalSrc(c.src))).map((c) => c.file), { rawMax: 830 * KB });
  add("Find UI chunk", dynamic("src/find/"), { rawMax: 30 * KB });
  // The unit view (G16): Calc.units() loads the builder and the factor table from src/units/ on its first call.
  add("Unit view chunk", dynamic("src/units/"), { rawMax: 30 * KB });
  // The index and qalc have no fixed place yet (G4 and A2 decide); these match by location and name, so they apply wherever they land.
  add("Find index asset", all.filter((f) => f.startsWith("find/") || /(^|\/)find-index[^/]*$/.test(f)), { rawMax: 400 * KB, gzipMax: 100 * KB });
  add("qalc wasm + glue", all.filter((f) => /(^|\/)qalc[^/]*\.(wasm|mjs|js)$/.test(f)), { brotliMax: 1 * MB });
  present.push({ rule: "Precache total", files: all, rawMax: 18 * MB });
  return { present, absent };
}

/** Views that only draw an open sheet stay out of the start chunk (R46): each must be its own dynamic chunk, not in `startFiles`. */
export const LAZY_VIEWS = ["src/views/Sheet.svelte"];

/** Failures for lazy views that are missing as a dynamic chunk, or that are loaded at start. */
export function checkSplits(dist: string): string[] {
  const manifest = readManifest(dist);
  const start = new Set(startFiles(manifest));
  const failures: string[] = [];
  for (const src of LAZY_VIEWS) {
    const chunk = Object.values(manifest).find((c) => c.isDynamicEntry && normalSrc(c.src) === src);
    if (chunk === undefined) failures.push(`${src} is not a dynamic chunk: it is in the start chunk (import it with import())`);
    else if (start.has(chunk.file)) failures.push(`${src} (${chunk.file}) is loaded at start`);
  }
  return failures;
}

const kB = (n: number): string => `${(n / KB).toFixed(2)} kB`;

/** Measure `dist` against the budgets. Pure apart from reading files; the CLI prints and sets the exit code. */
export function checkSizes(dist: string): Report {
  const all = precacheFiles(dist);
  const { present, absent } = subjects(readManifest(dist), all);
  const rows: Row[] = [];
  for (const s of present) {
    let raw = 0;
    let gzip = 0;
    let brotli = 0;
    const isTotal = s.rule === "Precache total";
    for (const f of s.files) {
      const buf = readFileSync(join(dist, f));
      raw += buf.length;
      // The precache total is a raw sum only; compressing 13 MB of wasm for a number nobody budgets would just slow the build.
      if (!isTotal && s.gzipMax !== undefined) gzip += gzipSync(buf).length;
      if (!isTotal && s.brotliMax !== undefined) brotli += brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length;
    }
    const failures: string[] = [];
    if (s.rawMax !== undefined && raw > s.rawMax) failures.push(`${s.rule}: ${kB(raw)} raw is over the budget of ${kB(s.rawMax)} (${s.files.join(", ")})`);
    if (s.gzipMax !== undefined && gzip > s.gzipMax) failures.push(`${s.rule}: ${kB(gzip)} gzip is over the budget of ${kB(s.gzipMax)} (${s.files.join(", ")})`);
    if (s.brotliMax !== undefined && brotli > s.brotliMax) failures.push(`${s.rule}: ${kB(brotli)} brotli is over the budget of ${kB(s.brotliMax)} (${s.files.join(", ")})`);
    rows.push({ rule: s.rule, files: s.files, raw, gzip, brotli, rawMax: s.rawMax, gzipMax: s.gzipMax, brotliMax: s.brotliMax, failures });
  }
  return { rows, notBuilt: absent, failures: rows.flatMap((r) => r.failures) };
}

function format(report: Report): string {
  const cell = (value: number, max: number | undefined, label: string): string => (max === undefined ? "" : `${label} ${kB(value)} / ${kB(max)}`);
  const lines = report.rows.map((r) => {
    const parts = [cell(r.raw, r.rawMax, "raw"), cell(r.gzip, r.gzipMax, "gzip"), cell(r.brotli, r.brotliMax, "brotli")].filter(Boolean);
    return `  ${r.failures.length > 0 ? "FAIL" : "ok  "}  ${r.rule.padEnd(18)} ${parts.join("   ")}`;
  });
  if (report.notBuilt.length > 0) lines.push(`  (not built yet: ${report.notBuilt.join(", ")})`);
  return lines.join("\n");
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../dist"));
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`size-check: ${dist} is not a folder; run vite build first`);
    process.exit(2);
  }
  try {
    const report = checkSizes(dist);
    report.failures.push(...checkSplits(dist));
    console.log(`size-check: ${dist}\n${format(report)}`);
    if (report.failures.length > 0) {
      console.error(`\nsize-check FAILED:\n${report.failures.map((f) => `  ${f}`).join("\n")}\nA budget changes only together with docs/04-architecture.md section 8.3.`);
      process.exit(1);
    }
    console.log("size-check passed");
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}
