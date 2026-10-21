// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S6, docs/archive/r11-files.md): the backup file and how a file goes in and out of the app.
//   node tools/probes/backup-file.mjs            # sizes at the limits, the restore checks, then the Chromium checks
//   node tools/probes/backup-file.mjs --size     # sizes and the restore checks only (no browser)
// 1. Size: a backup in r11's format with every stored key at its limit (200 history rows per view, 500 definitions),
//    "typical" (rows as the app writes them for everyday inputs) and "worst" (every text field at its cap: full 2 kB,
//    preview 200, desc 120). The caps are read from the sources, not copied here.
// 2. Restore checks: the reference checker of r11 section 3.4 on a good file and on one bad file per refusal.
// 3. Chromium (Playwright's, headless, desktop Linux): `<a download>` of a Blob (does a download start, with the name
//    and the bytes?), `<input type="file">` (the bytes come back; what has focus afterwards), `navigator.share`,
//    `navigator.canShare({ files })` for a .json file, and `showSaveFilePicker`/`showOpenFilePicker`. Android's WebView
//    and Chrome for Android are annabell's (r11 section 5).
// Read-only; writes nothing outside the OS temp dir.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** An `app/` with Playwright installed: $PROBE_APP, this checkout, the main checkout, or its phase-1 worktree. */
function appDir() {
  const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  const main = dirname(common);
  const tries = [process.env.PROBE_APP, join(root, 'app'), join(main, 'app'), join(main, '.claude/worktrees/phase-1/app')].filter(Boolean);
  const hit = tries.find((d) => existsSync(join(d, 'node_modules/@playwright/test/package.json')));
  if (!hit) throw new Error(`no app/node_modules with @playwright/test in ${tries.join(', ')} (set PROBE_APP)`);
  return hit;
}
const src = (p) => readFileSync(join(root, p), 'utf8');
const num = (file, re) => {
  const m = re.exec(src(file));
  if (!m) throw new Error(`not found in ${file}: ${re}`);
  return Function(`return (${m[1]})`)();
};

// ---- the caps, from the sources
const DATA_VERSION = num('app/src/state/storage.ts', /export const DATA_VERSION = (\d+);/);
const HISTORY_LIMIT = num('app/src/state/session.svelte.ts', /const HISTORY_LIMIT = (\d+);/);
const FULL_LIMIT = num('app/src/state/session.svelte.ts', /export const FULL_LIMIT = (\d+);/);
const MAX_DEFS = num('app/src/engine/defs.ts', /export const MAX_DEFS = (\d+);/);
const PREVIEW_MAX = num('app/src/engine/defs.ts', /export const PREVIEW_MAX = (\d+);/);
const DESC_MAX = num('app/src/engine/defs.ts', /export const DESC_MAX = (\d+);/);
const LIB_MAX_BYTES = num('app/src/engine/library.ts', /export const LIB_MAX_BYTES = ([\d *]+);/);
const STAMP = '@pascaline';
const FORMAT = 'pascaline-backup';
const FORMAT_VERSION = 1;
/** The keys a backup holds (r11 section 3.2); `defsStarts` stays out (a per-install crash counter). */
const KEYS = ['settings', 'view', 'place', 'entry', 'history', 'defs', 'userKeys', 'taps', 'app.function', 'app.solve', 'units.targets', 'units.history'];

const stamp = (value) => ({ [STAMP]: DATA_VERSION, value });
const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + 'x'.repeat(n - s.length));

function historyItem(i, view, worst) {
  const t = 1760918400000 + i * 7000;
  const base = {
    id: i, view, latex: worst ? pad('\\frac{\\sin\\left(x\\right)}{x}+', 400) : '\\sqrt{2}\\cdot 3.5+\\frac{1}{7}',
    status: 'done', resultLatex: worst ? pad('1.41421356237', 600) : '5.09263906496', text: worst ? pad('1.41421356237', 600) : '5.09263906496',
    approximate: true, facts: { mark: 'approx', reliableDigits: 12, shown: 12 }, startedAt: t,
  };
  if (view === 'home') base.value = { re: '5.09263906496', im: '0' };
  if (worst) {
    base.full = pad('5.0926390649634', FULL_LIMIT);
    base.fullExact = false;
    base.chips = { a: { text: pad('3', 200), exact: true } };
    base.uses = [{ name: 'a', preview: pad('3', PREVIEW_MAX), view }];
  } else {
    base.full = '5.09263906496340';
  }
  return base;
}
function defEntry(i, worst) {
  const fn = i % 4 === 0;
  const name = fn ? `f${i}` : `v${i}`;
  return {
    name, kind: fn ? 'fn' : 'var',
    cmds: [fn ? `${name}(x):=x^2*sin(x)+${i}` : `${name}:=(evalf(${worst ? pad('12345678901234567890', 120) : '3/7'},12))`],
    ...(fn ? {} : { facts: { reliableDigits: 12 } }),
    preview: worst ? pad('0.428571428571', PREVIEW_MAX) : '0.428571428571',
    view: i % 2 ? 'home' : 'cas', time: 1760918400000 + i * 1000, angle: 'rad',
    ...(worst ? { desc: pad('beam deflection', DESC_MAX) } : {}),
  };
}
function backup(worst) {
  const parts = {
    settings: stamp({ schema: 2, digits: 12, format: 'std', fixDecimals: 4, fmtCycle: ['std', 'sci', 'eng'], entry: 'textbook', haptics: 'medium' }),
    view: stamp('home'),
    place: stamp({ app: 'calc', view: 'home' }),
    entry: stamp(worst ? pad('\\sin\\left(', 400) : ''),
    history: stamp({
      home: Array.from({ length: HISTORY_LIMIT }, (_, i) => historyItem(i, 'home', worst)),
      cas: Array.from({ length: HISTORY_LIMIT }, (_, i) => historyItem(i, 'cas', worst)),
    }),
    defs: stamp(Array.from({ length: MAX_DEFS }, (_, i) => defEntry(i, worst))),
    userKeys: stamp({ U1: { primary: { label: 'Mz', action: 'f(x)' }, shift: null }, U2: { primary: { label: 'σ', action: 'sigma' } } }),
    taps: stamp({ shift: 120, alpha: 30 }),
    'app.function': stamp({ fns: ['sin(x)', 'x^2-2', '', '', '', '', '', '', '', ''], window: [-10, 10, -6, 6] }),
    'app.solve': stamp({ eqs: ['x^2=2', ''], uses: {} }),
  };
  return { [FORMAT]: FORMAT_VERSION, dataVersion: DATA_VERSION, made: '2026-10-20T02:00:00Z', parts };
}

/** r11 section 3.4: the checks a restore runs before it writes anything; the first failure refuses the whole file. */
function check(bytes) {
  if (bytes.length > 4 * 1024 * 1024) return 'over 4 MB';
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'not UTF-8 text';
  }
  let f;
  try {
    f = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return 'not JSON';
  }
  if (typeof f !== 'object' || f === null || Array.isArray(f) || !(FORMAT in f)) return 'not a Pascaline backup';
  if (!Number.isInteger(f[FORMAT]) || f[FORMAT] < 1) return 'broken format number';
  if (f[FORMAT] > FORMAT_VERSION) return `made by a newer Pascaline (backup format ${f[FORMAT]})`;
  if (typeof f.parts !== 'object' || f.parts === null || Array.isArray(f.parts)) return 'no parts';
  for (const [k, rec] of Object.entries(f.parts)) {
    if (!KEYS.includes(k)) return `unknown part ${k}`;
    if (typeof rec !== 'object' || rec === null || !(STAMP in rec) || !('value' in rec)) return `${k}: no stamp`;
    const v = rec[STAMP];
    if (!Number.isInteger(v) || v < 0) return `${k}: broken stamp`;
    if (v > DATA_VERSION) return `${k}: made by a newer Pascaline (version ${v}; this one reads up to ${DATA_VERSION})`;
  }
  return null; // then: unstamp() each part, the key's own validator, show the summary, write in one transaction
}

function sizes() {
  console.log(`caps (from the sources): DATA_VERSION ${DATA_VERSION}, HISTORY_LIMIT ${HISTORY_LIMIT}, FULL_LIMIT ${FULL_LIMIT}, MAX_DEFS ${MAX_DEFS}, PREVIEW_MAX ${PREVIEW_MAX}, DESC_MAX ${DESC_MAX}, LIB_MAX_BYTES ${LIB_MAX_BYTES}`);
  for (const worst of [false, true]) {
    const b = backup(worst);
    const s = Buffer.from(JSON.stringify(b));
    const per = Object.entries(b.parts).map(([k, v]) => `${k} ${(JSON.stringify(v).length / 1024).toFixed(1)}`).join(', ');
    console.log(`${worst ? 'worst  ' : 'typical'}: ${(s.length / 1024).toFixed(0)} kB, gzip ${(gzipSync(s).length / 1024).toFixed(0)} kB; parts kB: ${per}`);
  }
  console.log('restore checks:');
  const good = backup(false);
  const cases = [
    ['good file', good],
    ['newer backup format', { ...good, [FORMAT]: FORMAT_VERSION + 1 }],
    ['newer part', { ...good, parts: { ...good.parts, defs: { [STAMP]: DATA_VERSION + 1, value: [] } } }],
    ['broken stamp (text)', { ...good, parts: { ...good.parts, view: { [STAMP]: '3', value: 'home' } } }],
    ['broken stamp (negative)', { ...good, parts: { ...good.parts, view: { [STAMP]: -1, value: 'home' } } }],
    ['no stamp', { ...good, parts: { ...good.parts, view: 'home' } }],
    ['unknown part', { ...good, parts: { ...good.parts, defsStarts: stamp(0) } }],
    ['a library file', '// pascaline library 3\nf(x):=x^2'],
    ['not UTF-8', Buffer.from([0x7b, 0xff, 0x7d])],
  ];
  for (const [name, f] of cases) {
    const bytes = Buffer.isBuffer(f) ? f : Buffer.from(typeof f === 'string' ? f : JSON.stringify(f));
    console.log(`  ${name.padEnd(24)} → ${check(bytes) ?? 'accepted'}`);
  }
}

async function chromium() {
  const req = createRequire(join(appDir(), 'package.json'));
  const { chromium } = req('@playwright/test');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  // A secure origin like Capacitor's (https://localhost): the file pickers and Web Share exist only in secure contexts.
  const html = '<!doctype html><button id=b>x</button><input id=f type=file accept=".json,application/json" style="display:none">';
  await page.route('https://localhost/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://localhost/');
  console.log(`chromium ${browser.version()} (headless, desktop)`);
  const api = await page.evaluate(() => {
    const json = new File(['{}'], 'pascaline-backup.json', { type: 'application/json' });
    const txt = new File(['{}'], 'pascaline-backup.txt', { type: 'text/plain' });
    return {
      share: typeof navigator.share,
      canShare: typeof navigator.canShare,
      canShareJson: typeof navigator.canShare === 'function' ? navigator.canShare({ files: [json] }) : null,
      canShareTxt: typeof navigator.canShare === 'function' ? navigator.canShare({ files: [txt] }) : null,
      showSaveFilePicker: typeof window.showSaveFilePicker,
      showOpenFilePicker: typeof window.showOpenFilePicker,
      secure: window.isSecureContext,
    };
  });
  console.log('  APIs:', JSON.stringify(api));
  // Out: <a download> of a Blob from a click (a user gesture).
  const body = JSON.stringify(backup(false));
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.evaluate((text) => {
    document.getElementById('b').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = 'pascaline-backup-2026-10-20.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }, body);
  await page.click('#b');
  const d = await dl;
  if (d) {
    const p = await d.path();
    const got = readFileSync(p, 'utf8');
    console.log(`  <a download>: download "${d.suggestedFilename()}", ${got.length} bytes, same bytes: ${got === body}`);
  } else console.log('  <a download>: no download event');
  // In: <input type=file> opened from a click; what has focus afterwards, and the bytes read back.
  const dir = mkdtempSync(join(tmpdir(), 's6-'));
  const file = join(dir, 'pascaline-backup.json');
  writeFileSync(file, body);
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.evaluate(() => {
    document.getElementById('b').onclick = () => document.getElementById('f').click();
  });
  await page.click('#b');
  const fc = await chooser;
  if (!fc) {
    console.log('  <input type=file>: no file chooser');
  } else {
    await fc.setFiles(file);
    const back = await page.evaluate(async () => {
      const f = document.getElementById('f');
      const a = document.activeElement;
      const text = await f.files[0].text();
      return { name: f.files[0].name, type: f.files[0].type, bytes: text.length, focus: a ? `${a.tagName.toLowerCase()}${a.type ? '[' + a.type + ']' : ''}` : null, editable: !!a && (a.isContentEditable || (a.tagName === 'INPUT' && a.type !== 'file') || a.tagName === 'TEXTAREA'), multiple: f.multiple, accept: f.accept };
    });
    console.log(`  <input type=file>: chooser opened (multiple ${fc.isMultiple()}); read back ${JSON.stringify(back)}; same bytes: ${back.bytes === body.length}`);
  }
  await browser.close();
}

sizes();
if (!process.argv.includes('--size')) await chromium();
