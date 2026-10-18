// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S9, results mode, P16): the pixels the keypad takes and what a collapsed keypad would give back, at the
// Pixel 7 profile the viewport-share test uses (app/test/status.spec.ts), and the ten benchmark tasks' presses with
// the keypad up and collapsed. Results and reasoning: docs/research/r13-results-mode.md.
//
//   node tools/probes/results-geometry.mjs            geometry (starts Vite with ?engine=fake) and press counts
//   node tools/probes/results-geometry.mjs --counts   press counts only (no browser)
//
// Geometry: the window, the status line, the viewport (.screen), the entry line, the keypad (.keys), each keypad
// row's top and height, a history row's height (1÷3 with the fake engine, which echoes), and the R11 action line's
// height. Counting (docs/04 5.2): every key and every screen tap counts 1; a collapsed keypad costs the one tap that
// brings it back (on the slice, or View on a hardware keyboard) before the first key.
// Needs app/node_modules (Playwright and its Chromium, `yaml`), from this checkout or the main one. Read-only.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function appDir() {
  if (existsSync(join(root, 'app/node_modules'))) return join(root, 'app');
  const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return join(dirname(common), 'app');
}
const req = createRequire(join(appDir(), 'package.json'));
const YAML = req('yaml');

// ---- press counts (tests/tasks/tasks.yaml)
const tasks = YAML.parse(readFileSync(join(root, 'tests/tasks/tasks.yaml'), 'utf8')).tasks;
console.log('task  planned(up) planned(collapsed)  baseline(up) baseline(collapsed)  title');
for (const t of tasks) {
  const plan = Array.isArray(t.keys) ? t.keys.length : null;
  const base = t.baseline && Array.isArray(t.baseline.keys) ? t.baseline.keys.length : null;
  const c = (n) => (n === null ? '—' : String(n + 1));
  console.log(`${t.id}   ${String(plan ?? '—').padStart(4)}        ${c(plan).padStart(4)}               ${String(base ?? '—').padStart(4)}          ${c(base).padStart(4)}            ${t.title}`);
}
if (process.argv.includes('--counts')) process.exit(0);

// ---- geometry
const { chromium, devices } = req('@playwright/test');
const port = 5300 + Math.floor(Math.random() * 400);
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: join(root, 'app'), stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-vite.pid); } catch { /* gone */ } };
process.on('exit', stop);
const url = `http://localhost:${port}/?engine=fake`;
for (let i = 0; ; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  if (i > 120) throw new Error('vite did not start');
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  await page.goto(url);
  await page.waitForFunction(() => customElements.get('math-field') !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { top: r.top, h: r.height } : null; }, sel);
  const rows = await page.evaluate(() => {
    const out = {};
    for (const k of document.querySelectorAll('.pad [data-key]')) {
      const row = getComputedStyle(k).gridRowStart;
      const r = k.getBoundingClientRect();
      const o = (out[row] ??= { top: r.top, bottom: r.bottom, keys: [] });
      o.top = Math.min(o.top, r.top); o.bottom = Math.max(o.bottom, r.bottom); o.keys.push(k.getAttribute('data-key'));
    }
    return out;
  });
  const tapKeys = async (ids) => { for (const id of ids) await page.locator(`[data-key="${id}"]`).tap(); };
  for (let i = 0; i < 3; i++) await tapKeys(['d1', 'div', 'd3', 'enter']);
  await page.waitForFunction(() => document.querySelectorAll('[data-status="done"]').length === 3);
  const item = await page.evaluate(() => {
    const a = [...document.querySelectorAll('article.item')].map((e) => e.getBoundingClientRect());
    return { h: a[1].height, pitch: a[2].top - a[1].top };
  });
  await tapKeys(['up']);
  await page.getByTestId('row-actions').waitFor();
  const bar = await box('[data-testid="row-actions"]');
  const m = {
    window: await page.evaluate(() => window.innerHeight),
    width: await page.evaluate(() => window.innerWidth),
    header: await box('header'), screen: await box('.screen'), entry: await box('.entry'), keys: await box('.keys'), pad: await box('.pad'),
    item, bar,
  };
  console.log(JSON.stringify(m, null, 1));
  console.log('keypad rows (grid row: top, height, keys):');
  for (const [row, o] of Object.entries(rows)) console.log(`  ${row}: ${o.top.toFixed(1)}  ${(o.bottom - o.top).toFixed(1)}  ${o.keys.join(' ')}`);
  const share = m.screen.h / m.window;
  console.log(`viewport share, keypad up: ${share.toFixed(4)} (${m.screen.h} of ${m.window} px)`);
  const r1 = rows['1'];
  for (const [name, slice] of [['8 px grip', 8], ['one cluster row (row 0 + pad padding)', r1.bottom - m.pad.top + 4]]) {
    const gained = m.keys.h - slice;
    const sh = (m.screen.h + gained) / m.window;
    console.log(`slice ${name}: ${slice.toFixed(1)} px → viewport +${gained.toFixed(1)} px = share ${sh.toFixed(4)}, ≈ ${(gained / item.pitch).toFixed(1)} more rows (row pitch ${item.pitch.toFixed(1)} px)`);
  }
} finally {
  await browser.close();
  stop();
}
