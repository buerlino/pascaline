// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S9, results mode, P16): the pixels the keypad takes and what a collapsed keypad would give back, at the
// Pixel 7 profile the viewport-share test uses (app/test/status.spec.ts), and the ten benchmark tasks' presses with
// the keypad up and collapsed. Results and reasoning: docs/archive/r13-results-mode.md. S25 (r19 part 3) added the
// 360 × 740 size, every strip (status line, history, entry, rows and gaps) and the history's fit with 8 px more gap.
//
//   node tools/probes/results-geometry.mjs            geometry (starts Vite with ?engine=fake) and press counts
//   node tools/probes/results-geometry.mjs --counts   press counts only (no browser)
//   node tools/probes/results-geometry.mjs --options  also S25 part 3's room options, applied as CSS and measured
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
const url = `http://localhost:${port}/?engine=fake&tips=off`; // R15c4: no first-start tips over the keys
for (let i = 0; ; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  if (i > 120) throw new Error('vite did not start');
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch();
// S25 part 3: every strip at two widths (the Pixel 7 profile, 412 × 839, and 360 × 740, the narrow size the e2e
// tests use), and how many 1÷3 rows the history shows with today's gap between entries and with 8 px more.
const SIZES = [['412 × 839 (Pixel 7)', null], ['360 × 740', { width: 360, height: 740 }]];
try {
  for (const [label, size] of SIZES) {
    const page = await (await browser.newContext({ ...devices['Pixel 7'], ...(size ? { viewport: size } : {}) })).newPage();
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
      return { h: a[1].height, pitch: a[2].top - a[1].top, gap: a[2].top - a[1].bottom };
    });
    // the history's own box: how much of three rows it shows, now and with the gap 8 px larger (docs/05 3.5)
    const fit = (extra) => page.evaluate((x) => {
      const h = document.querySelector('.history');
      if (x) h.style.setProperty('--between', `calc(var(--sp-25) + ${x}px)`);
      const r = h.getBoundingClientRect();
      const first = document.querySelector('article.item').getBoundingClientRect();
      const out = { client: h.clientHeight, scroll: h.scrollHeight, padTop: parseFloat(getComputedStyle(h).paddingTop), firstHidden: Math.max(0, h.scrollHeight - h.clientHeight), firstTopInView: first.top - r.top + (h.scrollHeight - h.clientHeight - h.scrollTop) * -1 };
      h.style.removeProperty('--between');
      return out;
    }, extra);
    const now = await fit(0), more = await fit(8);
    // a flat row (12+3: one line in, one line out) for the worksheet's row height (r13 left its pitch to verify)
    await tapKeys(['d1', 'd2', 'add', 'd3', 'enter']);
    await page.waitForFunction(() => document.querySelectorAll('[data-status="done"]').length === 4);
    const flat = await page.evaluate(() => {
      const a = [...document.querySelectorAll('article.item')].map((e) => e.getBoundingClientRect());
      return { h: a[3].height, pitch: a[3].top - a[2].top - a[2].height + a[3].height };
    });
    await tapKeys(['up']);
    await page.getByTestId('row-actions').waitFor();
    const bar = await box('[data-testid="row-actions"]');
    const m = {
      size: label,
      window: await page.evaluate(() => window.innerHeight),
      width: await page.evaluate(() => window.innerWidth),
      header: await box('header'), screen: await box('.screen'), history: await box('.history'), entry: await box('.entry'), keys: await box('.keys'), pad: await box('.pad'),
      item, flat, bar,
    };
    console.log(`\n=== ${label}`);
    console.log(JSON.stringify(m));
    console.log('keypad rows (grid row: top, height, gap above, keys):');
    let prev = m.pad.top;
    for (const [row, o] of Object.entries(rows).sort((a, b) => a[1].top - b[1].top)) {
      console.log(`  ${row}: ${o.top.toFixed(1)}  ${(o.bottom - o.top).toFixed(1)}  ${(o.top - prev).toFixed(1)}  ${o.keys.join(' ')}`);
      prev = o.bottom;
    }
    console.log(`  pad bottom padding: ${(m.pad.top + m.pad.h - prev).toFixed(1)}; .keys below .pad: ${(m.keys.top + m.keys.h - m.pad.top - m.pad.h).toFixed(1)}`);
    const share = m.screen.h / m.window;
    console.log(`viewport share, keypad up: ${share.toFixed(4)} (${m.screen.h} of ${m.window} px); floor 0.35 = ${(0.35 * m.window).toFixed(1)} px, slack ${(m.screen.h - 0.35 * m.window).toFixed(1)} px`);
    console.log(`flat row (12+3): ${flat.h.toFixed(1)} px, pitch ${flat.pitch.toFixed(1)} px`);
    console.log(`history box ${m.history.h.toFixed(1)} px; three 1÷3 rows: gap ${item.gap.toFixed(1)} → scroll ${now.scroll} of ${now.client} (hidden ${now.firstHidden}); gap +8 → scroll ${more.scroll} of ${more.client} (hidden ${more.firstHidden})`);
    const r1 = rows['1'];
    for (const [name, slice] of [['8 px grip', 8], ['44 px slice (S9)', 44], ['one cluster row (row 0 + pad padding)', r1.bottom - m.pad.top + 4]]) {
      const gained = m.keys.h - slice;
      const sh = (m.screen.h + gained) / m.window;
      console.log(`slice ${name}: ${slice.toFixed(1)} px → viewport +${gained.toFixed(1)} px = share ${sh.toFixed(4)}, ≈ ${(gained / item.pitch).toFixed(1)} more rows (row pitch ${item.pitch.toFixed(1)} px)`);
    }
    // S25 part 3's room options, each applied as CSS on top of today's page and measured (history box, no pick and
    // with a picked row; the viewport and its share). R1: the short rows of the R82 rule (Keypad.svelte, max-height
    // 700px) at every height. R2: the keypad's gaps 6 → 4 px and its padding 8 → 4 px. R3: while a row is picked the
    // line is empty (route.ts historyKey picks only on an empty line), so the row's buttons take the entry line's place.
    if (process.argv.includes('--options')) {
      await tapKeys(['esc']); // drop the pick
      const OPTIONS = [
        ['today', ''],
        ['R1 short rows', '.pad .key{--legend-h:var(--sp-25)!important;min-height:var(--key-h-short)!important}.pad .key[data-letters="true"] .main{line-height:1!important}.pad .key.nav,.pad .key[data-zone="true"]{min-height:var(--nav-h-short)!important}'],
        ['R2 tight gaps', '.pad{gap:4px!important;padding:4px!important}'],
        ['R1 + R2', '.pad .key{--legend-h:var(--sp-25)!important;min-height:var(--key-h-short)!important}.pad .key[data-letters="true"] .main{line-height:1!important}.pad .key.nav,.pad .key[data-zone="true"]{min-height:var(--nav-h-short)!important}.pad{gap:4px!important;padding:4px!important}'],
      ];
      for (const [name, css] of OPTIONS) {
        const id = await page.evaluate((c) => { const st = document.createElement('style'); st.id = 'opt'; st.textContent = c; document.head.append(st); return st.id; }, css);
        await page.waitForTimeout(100);
        const free = await box('.history'), scr = await box('.screen'), kp = await box('.keys');
        const minKey = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.pad [data-key]')].map((k) => k.getBoundingClientRect().height)));
        await tapKeys(['up']);
        await page.getByTestId('row-actions').waitFor();
        const picked = await box('.history');
        // R3: the buttons in the entry line's place: the history gains the entry line's height less the buttons'
        // the buttons sit in the empty entry line's slot, which keeps its height: the history keeps its unpicked height
        const r3 = free.h;
        await tapKeys(['esc']);
        await page.evaluate((i) => document.getElementById(i)?.remove(), id);
        console.log(`option ${name.padEnd(14)} keypad ${kp.h.toFixed(0)} px (lowest key ${minKey.toFixed(0)}), viewport ${scr.h.toFixed(0)} = share ${(scr.h / m.window).toFixed(4)}, history ${free.h.toFixed(0)} px (${(free.h / item.pitch).toFixed(2)} rows of 1÷3), picked ${picked.h.toFixed(0)} px; with R3 picked ${r3.toFixed(0)} px`);
      }
    }
    await page.context().close();
  }
} finally {
  await browser.close();
  stop();
}
