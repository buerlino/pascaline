// SPDX-License-Identifier: GPL-3.0-or-later
// The size test (docs/04 section 8.3): reads Vite's manifest (dist/.vite/manifest.json, `build.manifest: true`) and the
// build output, and exits 1 when a chunk is over its budget. Run by `npm run build` (so by build.sh) and as `npm run size`.
//   node scripts/size-check.ts [distDir]        # default: app/dist
// The Start chunk is the entry plus every chunk it imports statically (manifest `imports`, transitively), because all of it loads at start.
// Units are Vite's: 1 kB = 1000 B, 1 MB = 1,000,000 B (so today's 142.62 kB start chunk is 142,626 B). Gzip is zlib's
// default level, which is what `vite build` reports. Budgets for chunks that don't exist yet (Find, Units, qalc) apply
// as soon as they appear in the build; until then they print as "not built". To change a budget, change docs/04 8.3 too.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  add("Start chunk", startFiles(manifest), { rawMax: 175 * KB, gzipMax: 61 * KB });
  add("MathLive chunk", chunks.filter((c) => /(^|\/)mathlive\/mathlive\.min\.m?js$/.test(normalSrc(c.src))).map((c) => c.file), { rawMax: 830 * KB });
  add("Find UI chunk", dynamic("src/find/"), { rawMax: 30 * KB });
  // The unit view (G16, R24c): one rule over src/units/, so it covers the UI chunk (units/open.ts, 23.33 kB raw) and the
  // builder that Calc.units() loads with the factor table on its first call (units/calc.ts, 9.72 kB): 34 kB (Opus pass 22);
  // 38 kB (Opus pass 24): G81's correlated constants measure 34.04 kB, and R24d and R60–R63 still add; the bar that counts
  // is the first unit result < 1 s on the Tab One (decisions.md, Units: G81, R24b and R24c).
  add("Unit view chunk", dynamic("src/units/"), { rawMax: 38 * KB });
  // The index and qalc have no fixed place yet (G4 and A2 decide); these match by location and name, so they apply wherever they land.
  add("Find index asset", all.filter((f) => f.startsWith("find/") || /(^|\/)find-index[^/]*$/.test(f)), { rawMax: 400 * KB, gzipMax: 100 * KB });
  add("qalc wasm + glue", all.filter((f) => /(^|\/)qalc[^/]*\.(wasm|mjs|js)$/.test(f)), { brotliMax: 1 * MB });
  present.push({ rule: "Precache total", files: all, rawMax: 18 * MB });
  return { present, absent };
}

/** Views that only draw an open sheet stay out of the start chunk (R46): each must be its own dynamic chunk, not in `startFiles`. */
export const LAZY_VIEWS = ["src/views/Sheet.svelte"];

/** R91: code that only runs after a key press or once a result is in stays out of the start chunk too: the sheet's keys
 *  and the palette cells (loaded with the sheet's view), the result tidy-up, the palettes with their names. R70f1: how a
 *  key acts on the entry line's field, and the field's set-up (entry/field.ts, loaded with MathLive). */
export const LAZY_PARTS = ["src/views/sheetKeys.ts", "src/views/tmplSheet.ts", "src/render/tidy.ts", "src/keyboard/shiftPalettes.ts", "src/units/open.ts", "src/entry/field.ts"];

/** R91's pin: the start chunk is at most this many bytes gzip, 1 kB under the budget of 61 kB, so the Settings base
 *  (R49, R86, R57) has room. A package that needs more raises the pin with a reason, here and in docs/04 8.3.
 *  58.5 → 59.5 kB (R4b): phase-1 measures 58.50 kB gzip, the branch 59.42 kB (+0.92 kB): the Vars and Memory keys,
 *  the Your keys level and the free keys' three layers are on the key path.
 *  59.5 → 60 kB (R50e): phase-1 59.42 kB, the branch 59.90 kB (+0.48 kB, raw +1.2 kB): the stored look (its
 *  validation, the schema-3 migration and the first-start default) is in the settings the session reads at start; the
 *  Appearance level, the family list and the theme files are lazy chunks.
 *  60 → 60.5 kB (R57): phase-1 59.90 kB, the branch 60.48 kB (+0.58 kB): the decimal mark setting, the two key faces,
 *  the drawn comma, the hardware keys, and the Paste and rows holds (keyboard/route.ts) are on the key path.
 *  60.5 → 60.52 kB (R24b): phase-1 60.49 kB, the branch 60.51 kB (+0.02 kB, raw +0.06 kB): the unit pad is drawn through the
 *  keypad's own seams (the sheet's state, sheetChunk.pad; Keypad's key list and its row of legends; one hook in
 *  keyboard/route.ts), and everything else (units/pad.ts, units/padView, spec/unit-pad.yaml) is a lazy chunk.
 *  60.52 → 60.68 kB (R24c): phase-1 60.52 kB, the branch 60.68 kB (+0.16 kB): the units key is on the key path (P11),
 *  and the key alone measures 60.58 kB; the unit view itself is a lazy chunk (Opus pass 22: at most 60.70 kB).
 *  60.68 → 60.70 kB (G133f1): no app source changed; the raw chunk is the same 171.54 kB, but Giac patch 0023 gives a
 *  new engine key, and the engine's hashed file name in the chunk compresses 0.01 kB worse (phase-1's engine 60.68 kB,
 *  the branch's 60.69 kB, one build of one tree). 60.70 kB, Opus pass 22's bound, so a new engine hash alone does not trip it.
 *  60.70 → 60.95 kB (R70): phase-1 60.69 kB, the branch 60.93 kB (+0.24 kB, raw +0.92 kB): the counter of every press is on
 *  the key path (Keypad's count at each lift, the screen-tap listener and the hardware-key hooks in App.svelte,
 *  state/pressCount.ts, the counter's field); the Settings row is in the lazy sheet chunk.
 *  60.95 → 60.97 kB (R70f1): the pipeline's build of the branch measures 60.96 kB, 0.03 kB over the 60.93 kB of the first run
 *  (same sources; the order of the chunk's strings, as in G133f1); 0.01 kB of room is left under the pin.
 *  60.97 → 58.96 kB (R70f1, Opus pass 23): phase-1 60.96 kB gzip (172.46 kB raw), the branch 58.95 kB (166.61 kB raw;
 *  −2.01 kB): the entry line's work on the field (its set-up and listeners, ⌫ and Del at a template, ᴇ, 10ˣ, a power's
 *  base, the stops) runs only once MathLive is up, so it is entry/field.ts, loaded beside MathLive; keys pressed before
 *  it is there are queued as before. The room is for R24d, R38a, R71, R15c4 and R88 under the 61 kB budget.
 *  58.96 → 58.97 kB (G81): phase-1 58.95 kB, the branch 58.963 kB (166.66 kB raw, +0.05 kB): a stored constant chip keeps
 *  its basis and leaves (validChips, read back at start); their check is in basisOf, in the lazy chunks.
 *  58.97 → 59.05 kB (R24d, R24df1): phase-1 58.963 kB (G81), the branch 59.035 kB without G81 (59,035 B, rounded up to the next 0.01 kB; 166.82 kB raw); the sum is 59.05 kB. Four lines of start-chunk source
 *  changed (`Sheet.right()` runs a row's second job); the rest is the start chunk's own map of lazy chunks: the cells' store,
 *  Find in a slot and the units menu are three new lazy files (units/userCells.svelte.ts, find.ts, menu.ts), each named in the
 *  preload list of the dynamic imports that reach it. */
export const START_PIN_GZIP = 59.05 * KB;

/** Failures for the start chunk's row when it is over the pin. */
export function checkStartPin(row: Row): string[] {
  return row.gzip > START_PIN_GZIP ? [`${row.rule} is pinned at ${kB(START_PIN_GZIP)} gzip (R91), now ${kB(row.gzip)}: split more out of it, or raise START_PIN_GZIP in size-check.ts with a reason (it stays under the budget of ${kB(row.gzipMax ?? 0)})`] : [];
}

/** Failures for `srcs` that are missing as a dynamic chunk, or that are loaded at start. */
function lazyFailures(dist: string, srcs: readonly string[]): string[] {
  const manifest = readManifest(dist);
  const start = new Set(startFiles(manifest));
  const failures: string[] = [];
  for (const src of srcs) {
    const chunk = Object.values(manifest).find((c) => c.isDynamicEntry && normalSrc(c.src) === src);
    if (chunk === undefined) failures.push(`${src} is not a dynamic chunk: it is in the start chunk (import it with import())`);
    else if (start.has(chunk.file)) failures.push(`${src} (${chunk.file}) is loaded at start`);
  }
  return failures;
}

/** Failures for lazy views that are missing as a dynamic chunk, or that are loaded at start. */
export const checkSplits = (dist: string): string[] => lazyFailures(dist, LAZY_VIEWS);

/** Failures for the R91 parts, likewise. */
export const checkLazyParts = (dist: string): string[] => lazyFailures(dist, LAZY_PARTS);

/** The newest modification time (ms) of any file under `dir`; 0 when it does not exist. */
function newestMtime(dir: string): number {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    newest = Math.max(newest, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

/** A message when `dist/index.html` is older than the newest file under app/src/ or spec/ (a stale build measures old code); else null. */
export function staleMessage(dist: string): string | null {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const index = join(dist, "index.html");
  if (!existsSync(index)) return null;
  const built = statSync(index).mtimeMs;
  const newest = Math.max(newestMtime(join(root, "app/src")), newestMtime(join(root, "spec")));
  return built < newest ? `size-check: ${index} is older than the newest file under app/src/ or spec/; run npm run build first` : null;
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
  const stale = staleMessage(dist);
  if (stale !== null) {
    console.error(stale);
    process.exit(1);
  }
  try {
    const report = checkSizes(dist);
    report.failures.push(...checkSplits(dist), ...checkLazyParts(dist));
    const start = report.rows.find((r) => r.rule === "Start chunk");
    if (start !== undefined) report.failures.push(...checkStartPin(start));
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
