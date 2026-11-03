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
  /** Rollup's name of the chunk: a shared chunk has no `src`, only a name (the file's base name, e.g. "finder"). */
  name?: string;
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
function subjects(manifest: Record<string, ManifestChunk>, all: string[]): { present: Subject[]; absent: string[]; missing: string[] } {
  const chunks = Object.values(manifest);
  const present: Subject[] = [];
  const absent: string[] = [];
  const missing: string[] = [];
  const add = (rule: string, files: string[], limits: Omit<Subject, "rule" | "files">, required = false): void => {
    if (files.length > 0) present.push({ rule, files, ...limits });
    else (required ? missing : absent).push(rule);
  };
  const dynamic = (prefix: string): string[] => chunks.filter((c) => c.isDynamicEntry && normalSrc(c.src).startsWith(prefix)).map((c) => c.file);

  add("Start chunk", startFiles(manifest), { rawMax: 175 * KB, gzipMax: 61 * KB });
  add("MathLive chunk", chunks.filter((c) => /(^|\/)mathlive\/mathlive\.min\.m?js$/.test(normalSrc(c.src))).map((c) => c.file), { rawMax: 830 * KB });
  // The chunk that holds src/find/finder.ts, whether it is a dynamic entry (src in the manifest) or a shared chunk
  // (units/find.ts and units/menu.ts import it statically, so Rollup names it "finder" and the manifest has no src).
  // Required: a build without it is a failure, not "not built yet" (the rule once matched nothing for weeks).
  add("Find UI chunk", [...new Set(chunks.filter((c) => normalSrc(c.src) === "src/find/finder.ts" || c.name === "finder").map((c) => c.file))], { rawMax: 30 * KB }, true);
  // The unit view (G16, R24c): one rule over src/units/, so it covers the UI chunk (units/open.ts, 23.33 kB raw) and the
  // builder that Calc.units() loads with the factor table on its first call (units/calc.ts, 9.72 kB): 34 kB (Opus pass 22);
  // 38 kB (Opus pass 24): G81's correlated constants measure 34.04 kB, and R24d and R60–R63 still add; the bar that counts
  // is the first unit result < 1 s on the Tab One (decisions.md, Units: G81, R24b and R24c).
  add("Unit view chunk", dynamic("src/units/"), { rawMax: 38 * KB });
  // The index and qalc have no fixed place yet (G4 and A2 decide); these match by location and name, so they apply wherever they land.
  add("Find index asset", all.filter((f) => f.startsWith("find/") || /(^|\/)find-index[^/]*$/.test(f)), { rawMax: 400 * KB, gzipMax: 100 * KB });
  add("qalc wasm + glue", all.filter((f) => /(^|\/)qalc[^/]*\.(wasm|mjs|js)$/.test(f)), { brotliMax: 1 * MB });
  present.push({ rule: "Precache total", files: all, rawMax: 18 * MB });
  return { present, absent, missing };
}

/** Views that only draw an open sheet stay out of the start chunk (R46): each must be its own dynamic chunk, not in `startFiles`. */
export const LAZY_VIEWS = ["src/views/Sheet.svelte"];

/** R91: code that only runs after a key press or once a result is in stays out of the start chunk too: the sheet's keys
 *  and the palette cells (loaded with the sheet's view), the result tidy-up, the palettes with their names. R70f1: how a
 *  key acts on the entry line's field, and the field's set-up (entry/field.ts, loaded with MathLive). R97: the update
 *  note's button and style (views/UpdateNote.svelte), which show only when an update waits. R103: the stored data's
 *  migration steps (state/migrations.ts, with the angle rewrite), loaded only for a record that has a step to run. */
export const LAZY_PARTS = ["src/views/sheetKeys.ts", "src/views/tmplSheet.ts", "src/render/tidy.ts", "src/keyboard/shiftPalettes.ts", "src/units/open.ts", "src/entry/field.ts", "src/state/handOver.ts", "src/views/UpdateNote.svelte", "src/views/tipsHost.ts", "src/state/migrations.ts"];

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
 *  preload list of the dynamic imports that reach it.
 *  59.05 → 59.11 kB (R24df2, Opus pass 26): the branch merged with phase-1 3718a40 (G81) measures 59.06 kB gzip (59,059 B,
 *  166.87 kB raw), 0.01 kB over the pin; the new pin is that rounded up to the next 0.01 kB (59.06) plus 0.05 kB for build
 *  noise and merges in flight (decisions.md, Start chunk). Under the budget of 61 kB.
 *  59.11 → 59.21 kB (R61): phase-1 dc0f77e measures 59.10 kB gzip (166.97 kB raw), the branch merged with it 59.16 kB
 *  (167.12 kB raw, +0.06 kB): a stored result chip keeps its unit and σ (validChips, read back at start: the unit kept
 *  as stored, a value with σ never exact) and a σ chip passes its σ to Home (chipFactsOf); the unit's check (chipUnit)
 *  is in input/chipUnit.ts, off the start chunk (it alone measured +0.21 kB there). The pin is 59.16 + 0.05 kB.
 *  59.21 → 59.30 kB (R71): the branch merged with phase-1 2ddd358 measures 59.24 kB gzip (59,243 B, 167.37 kB raw): Shift + `,`
 *  is the ± key (a keyboard.yaml layer, its dimming rule in keyboard.ts and route.ts, one legend). The pin is 59.25 + 0.05 kB.
 *  59.30 → 59.38 kB (R93): phase-1 3499958 measures 59.25 kB gzip (167.40 kB raw), the branch 59.33 kB (167.60 kB raw,
 *  +0.08 kB): the store's read tells a value, nothing stored and a failed read apart (kvGet), and idbKv drops the writes
 *  of a key whose read failed, so a transient fault never lets defaults replace the user's record; it is read at start,
 *  so it cannot load later. The pin is 59.33 + 0.05 kB.
 *  59.38 → 59.47 kB (R94): phase-1 2fcb7bc measures 59.33 kB gzip (167.60 kB raw), the branch 59.42 kB (167.85 kB raw,
 *  +0.09 kB): a settings record from a newer schema is read and never written back, with a one-time note through i18n
 *  (owner, vg-8); it is the start's own read of the settings, so it cannot load later. The pin is 59.42 + 0.05 kB.
 *  59.47 → 59.81 kB (R95): phase-1 1032dfb measures 59.42 kB gzip (167.85 kB raw), the branch 59.76 kB (168.70 kB raw,
 *  +0.34 kB): one writer per browser profile (state/writer.ts): the Web Lock is asked for before the first store write
 *  and every write asks its answer, so it cannot load later; the note, its words and the hand-over are a lazy chunk
 *  (state/handOver.ts). The pin is 59.76 + 0.05 kB.
 *  59.81 → 59.87 kB (R99): phase-1 d578f5b measures 59.80 kB gzip (168.85 kB raw), the branch merged with it 59.82 kB
 *  (168.87 kB raw, +0.02 kB): `{,}` before a digit starts a number in the tokenizer (Home's parser) and the apps' host
 *  gets `notice` (AppHost, shell.svelte.ts); the words of the refusal are a lazy table (i18n/enNum.ts, loaded with
 *  Solve and Function; in en.ts they measured 59.84 kB). The pin is 59.82 + 0.05 kB.
 *  59.87 → 60.00 kB (R100): phase-1 8f294fc measures 59.81 kB gzip (168.87 kB raw), the branch 59.95 kB (169.12 kB raw,
 *  +0.14 kB): in comma mode a history row's input is drawn, and recalled, with `;` for its argument commas (owner,
 *  2026-10-31): the rewrite (entry/commaInput.ts), Session.input and History's input prop are on the start's own drawing
 *  of the stored history, so they cannot load later. The pin is 59.95 + 0.05 kB.
 *  60.00 → 60.25 kB (R97): phase-1 1deea7f measures 59.95 kB gzip (169.12 kB raw), the branch 60.20 kB (169.78 kB raw,
 *  +0.25 kB): App.svelte's status line is a component (views/StatusLine.svelte: the compiled component wrapper, its
 *  props read through $$props, the dynamic child) and the lazy loaders are a module (appLoaders.ts); the update note's
 *  button and style went out (views/UpdateNote.svelte, a lazy chunk) but do not pay for that. The pin is 60.20 + 0.05 kB.
 *  60.25 → 60.36 kB (R102): the branch measures 60.31 kB gzip (170.08 kB raw), +0.06 kB over the old pin: the busy
 *  state's visually hidden `role="status"` line in StatusLine.svelte (markup and its few CSS rules; a screen reader
 *  hears the job) and `error.ansTooLong`, the Ans error's text moved from session.svelte.ts into the table. Both are on
 *  the start's own path (the status line is drawn at start; Session.submit runs before any lazy chunk), so neither can
 *  load later. The pin is 60.31 + 0.05 kB.
 *  60.36 → 60.59 kB (R63): phase-1 355153b measures 60.34 kB gzip (170.29 kB raw), the branch 60.54 kB (170.89 kB raw,
 *  +0.20 kB): a unit-view result is a Home row, so the start's own drawing of the stored history draws its number with
 *  ± σ and the unit set apart (Session.display), its request with its units (History's drawnInput) and "unit dropped"
 *  under a row computed from its chip (the flag at Enter, one line in History, its words in en.ts), and its chip is the
 *  stored one checked by validChips (Session.chipFor, also Ans at Enter). The row's builder, its slots' check and the
 *  units key's prefill are in the unit view's chunk; it imports the session as types only (a value import of
 *  session.svelte.ts from that chunk made Rolldown split shared modules out of the start chunk: 61.36 kB). The pin is
 *  60.54 + 0.05 kB.
 *  60.59 → 60.94 kB (R15c4): phase-1 6747238 measures 60.58 kB gzip (171.04 kB raw), the branch 60.89 kB (171.52 kB raw,
 *  +0.31 kB): the first-start tips' decision (state/tips.ts: the flag read at start and the `tips=off` check), the
 *  lazy import of the overlay with its preload entries, and the Settings row's callback in App.svelte. The overlay
 *  (views/tipsHost.ts, tips.css, i18n/enTips.ts) is a lazy chunk in plain DOM, so none of Svelte's runtime goes into
 *  the start chunk for it (a component did: +0.47 kB). The pin is 60.89 + 0.05 kB.
 *  60.94 → 60.99 kB (R55): the branch measures 60.97 kB gzip (171.69 kB raw): the digit-group function (render/home.ts
 *  groupDigits, one regex) and the `grouped` flag from the History row through session.display and renderNumeric. The
 *  pin is 60.97 + 0.02 kB, the most that keeps it under the 61.00 kB budget with room for the test below.
 *  60.99 → 58.44 kB (R103): phase-1 d075b9c measures 60.97 kB gzip (171.69 kB raw), the branch 58.39 kB (165.75 kB raw,
 *  −2.58 kB): the stored data's migration steps load only for a record that has one to run (state/migrations.ts, with
 *  engine/angleMigration.ts), the session reads PASDEG from engine/pasdeg.ts, and the start reads Home's defaults from
 *  engine/homeDefaults.ts, so engine/homeEval.ts's graph (engine/angles.ts, engine/flags.ts, icdf.ts, stores.ts), which
 *  the entry held for the lazy chunks, left the start chunk. The pin is 58.39 + 0.05 kB.
 *  58.44 → 58.49 kB (R89): phase-1 ea6112b's start files measure 58,389 B gzip (165,819 B raw), the branch 58,444 B
 *  (166,009 B raw, +55 B): the presets' name prompt, the part that must be at start: AppShell.prompt (a reactive field
 *  the entry label reads), route.ts handing it each key first, the history row's tap ending it, and shell and entry
 *  passed to Settings. Its watch for a tap elsewhere (a sheet, an app, a view) is in the Mode chunk
 *  (views/presetsView.svelte.ts), not a setter on AppShell.sheet (−20 B). The pin was 58.44 + 0.05 kB.
 *  R33 (names marked on the entry line): +20 B for EntryController.setNames and the lazy import of
 *  entry/namemarks.ts (the observer, the paint and the name test are in that lazy chunk); the pin is 58.51 + 0.05 kB.
 *  R36 (a picked row says why): ~+10 B for the line's element and its style in App.svelte; the words and the reasons are
 *  in the clipboard chunk (clipboard/whyLine.ts, strings.ts). R36f1 measured it after merging phase-1: phase-1 0dd6086's
 *  start files are 58,507 B gzip (166,290 B raw), the branch 58,568 B (166,509 B raw, +61 B): the line's element and
 *  style in App.svelte and the stored-facts check's `rounded` key (engine/types.ts); no clipboard source is in the start
 *  chunk (tools/probes/start-chunk.mjs). The pin is 58,568 B + 0.05 kB.
 *  R98 (Clear spares a running job; Undo of Clear and Delete): phase-1 fb75a497 is 58.56 kB gzip (166.51 kB raw), the
 *  branch 59,019 B (167,878 B raw, +0.46 kB): the note row in History.svelte with its two strings, the Undo key's test
 *  in route.ts, and the session's glue (the copy's field, Clear and Delete waiting for the code, Undo, the stored copy's
 *  read and write). The copy's code is its own lazy chunk (state/removedRows.ts, 0.51 kB gzip, fetched when idle). With
 *  it Rolldown puts engine/giacPrint.ts in a chunk of its own beside the entry (its gzip is counted here); a static
 *  import measured 59.33 kB. The pin is 59,019 B + 0.05 kB.
 *  R98 fix round 2 (audit points 2, 3): 59,108 B (168,152 B raw, +89 B on 92a419e7): Clear and Delete pick their rows by
 *  id at the press and resolve false with a note ("history.notRemoved") when the Undo code does not load. The pin is
 *  59,108 B + 0.05 kB.
 *  59.16 → 59.24 kB (R96f1): phase-1 a461f046 measures 59,108 B gzip (168,152 B raw); the branch merged with it 59,185 B
 *  (168,255 B raw, +77 B): R96's store health in storage.ts (a set of the keys whose last write did not land, and kvPut
 *  settling on abort; the line itself is in the Mode sheet's chunk). R96 before its fix measured 59,167 B. The pin is
 *  59,185 B + 0.05 kB.
 *  59.24 → 59.34 kB (R121): phase-1 321fb5f1 measures 59,235 B gzip (168,422 B raw), the branch 59,290 B (168,655 B raw,
 *  +55 B): the Home row's line naming the stored values a unit result read as pure numbers, in History.svelte (the text
 *  is the row's, written by the lazy units/row.ts; no unit code is in the start chunk). The pin is 59,290 B + 0.05 kB. */
export const START_PIN_GZIP = 59_340;

/** R103 (vr-4): the classic inline scripts of index.html run before the first paint, outside every chunk: the stored look
 *  (R50e) and the too-old WebView check. Their gzip sizes, each script alone and summed (as the start chunk sums its
 *  files), are pinned here. 1.53 kB (R103): the build of phase-1 d075b9c measures 1528 B (the look 858 B, the check
 *  670 B; 2993 B raw), rounded up to the next 0.01 kB, since the look's map of hashed theme files moves a byte or two.
 *  A package that grows them raises the pin with a reason, here and in docs/04 8.3. */
export const INLINE_PIN_GZIP = 1_530;

/** The text of each classic inline script (a `<script>` without `src`, not a module) in an HTML page, in order. */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? "";
    if (!/\bsrc\s*=/i.test(attrs) && !/\btype\s*=\s*["']?module/i.test(attrs)) out.push(m[2] ?? "");
  }
  return out;
}

/** The row of index.html's inline scripts, or null when the build has no index.html. */
function inlineRow(dist: string): Row | null {
  const index = join(dist, "index.html");
  if (!existsSync(index)) return null;
  const scripts = inlineScripts(readFileSync(index, "utf8")).map((t) => Buffer.from(t));
  const raw = scripts.reduce((n, b) => n + b.length, 0);
  const gzip = scripts.reduce((n, b) => n + gzipSync(b).length, 0);
  const failures = gzip > INLINE_PIN_GZIP ? [`Inline scripts: index.html's inline scripts are pinned at ${kB(INLINE_PIN_GZIP)} gzip (R103), now ${kB(gzip)}: they run before the first paint; move work into the bundle, or raise INLINE_PIN_GZIP in size-check.ts with a reason`] : [];
  return { rule: "Inline scripts", files: ["index.html"], raw, gzip, brotli: 0, rawMax: undefined, gzipMax: INLINE_PIN_GZIP, brotliMax: undefined, failures };
}

/** Failures for the start chunk's row when it is over the pin. */
export function checkStartPin(row: Row): string[] {
  return row.gzip > START_PIN_GZIP ? [`${row.rule} is pinned at ${kB(START_PIN_GZIP)} gzip (R91), now ${kB(row.gzip)}: split more out of it, or raise START_PIN_GZIP in size-check.ts with a reason (it stays under the budget of ${kB(row.gzipMax ?? 0)})`] : [];
}

/** The chunk of `src` when it is loaded on demand: a dynamic entry (src in the manifest), or a shared chunk Rollup named
 *  after it (no src: a lazy chunk imports it statically too, as state/backup.ts does state/migrations.ts, R103). */
function lazyChunk(manifest: Record<string, ManifestChunk>, src: string): ManifestChunk | undefined {
  const name = src.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const chunks = Object.values(manifest);
  return chunks.find((c) => c.isDynamicEntry && normalSrc(c.src) === src) ?? chunks.find((c) => c.src === undefined && c.name === name);
}

/** Failures for `srcs` that are missing as a dynamic chunk, or that are loaded at start. */
function lazyFailures(dist: string, srcs: readonly string[]): string[] {
  const manifest = readManifest(dist);
  const start = new Set(startFiles(manifest));
  const failures: string[] = [];
  for (const src of srcs) {
    const chunk = lazyChunk(manifest, src);
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
  const { present, absent, missing } = subjects(readManifest(dist), all);
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
  const inline = inlineRow(dist);
  if (inline !== null) rows.splice(1, 0, inline);
  else absent.unshift("Inline scripts");
  const missingFailures = missing.map((rule) => `${rule}: no chunk holds src/find/finder.ts (neither a dynamic entry nor a shared chunk named "finder"); the rule measures nothing`);
  return { rows, notBuilt: absent, failures: [...rows.flatMap((r) => r.failures), ...missingFailures] };
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
