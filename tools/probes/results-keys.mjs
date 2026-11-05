// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S25, docs/research/r19-results-and-keys.md parts 1 and 2): presses per job on past results, today and in
// results mode, and per editing action under three layouts of the six top-right keys. Counting is docs/04 5.2: every
// key, flick, tap, long press and scroll drag counts 1.
//
//   node tools/probes/results-keys.mjs            the two tables (no browser)
//   node tools/probes/results-keys.mjs --ends     also ⇤ ⇥ and a tap at the entry line's ends, in the app (Vite, ?engine=fake)
//
// Part 1's model. A row k back (k = 1 is the last) is visible when k ≤ the rows the history shows (results-geometry.mjs:
// 2.50 rows of 1÷3 at 412 × 839, 1.36 at 360 × 740, 5.4 more with S9's 44 px slice); a hidden row costs one scroll drag.
// Today: ▲ on an empty line picks the last row and ▲ walks (app/src/keyboard/route.ts historyKey :164-176); the picked
// row's five buttons (actions.svelte.ts rowButtons :291-293) or ☰ + digit act; a long press (500 ms, History.svelte :62)
// opens the row's list, then one tap on an item; a tap on a result inserts it, on an input recalls it. Results mode
// (S9, docs/archive/r13-results-mode.md 1.3): View collapses (1), a tap picks (1), a button acts (1), the slice brings the
// keypad back (1) unless the action did (Insert, Recall, Store ▶).
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---- part 1: jobs on past results
const VISIBLE = { '412 × 839': 2.5, '360 × 740': 1.36 };
const COLLAPSED_EXTRA = 5.4; // results-geometry.mjs: the 44 px slice gives 470 px, 5.4 rows of 1÷3
const scroll = (k, rows) => (k <= Math.floor(rows) ? 0 : 1);
// results mode, one action per visit: View, a tap that picks, the button, and the slice unless the action brings the
// keypad back (Insert, Recall, Store ▶); `after` is what follows the action (a name and Enter for Store ▶)
const mode = (k, r, back, after = 0) => 3 + scroll(k, r + COLLAPSED_EXTRA) + (back ? 0 : 1) + after;
// each job: [name, today by keys (k), today by touch (k, rows), results mode (k, rows)]
const JOBS = [
  ['reuse the result (insert)', (k) => k + 1, (k, r) => scroll(k, r) + 1, (k, r) => mode(k, r, true)], // ▲… Enter; a tap
  ['recall the input', (k) => k + 1, (k, r) => scroll(k, r) + 1, (k, r) => mode(k, r, true)], // ▲… Recall; a tap
  ['copy the result', (k) => (k === 1 ? 1 : k + 1), (k, r) => scroll(k, r) + 2, (k, r) => mode(k, r, false)], // Copy copies the last result
  ['delete the row', (k) => k + 1, (k, r) => scroll(k, r) + 2, (k, r) => mode(k, r, false)], // ▲… Delete button
  ['undo a delete', () => 1, () => 1, () => 1], // Undo on an empty line, or a tap on the note row (R98, docs/05 3.5)
  ['plot a CAS row (R53, not built)', (k) => k + 2, (k, r) => scroll(k, r) + 2, (k, r) => mode(k, r, false)], // ▲… ☰ 6
  ['store as a one-letter name', (k) => k + 3, (k, r) => scroll(k, r) + 4, (k, r) => mode(k, r, true, 2)], // ▲… Store ▶, A, Enter
];
console.log('PART 1: presses per job on the row k back (keys | touch | results mode, one action per visit)');
for (const [size, rows] of Object.entries(VISIBLE)) {
  console.log(`\n${size}: ${rows} rows of 1÷3 visible with the keypad up, ${(rows + COLLAPSED_EXTRA).toFixed(1)} collapsed`);
  console.log('job'.padEnd(34) + [1, 2, 3, 4, 6].map((k) => `k=${k}`.padStart(13)).join(''));
  for (const [name, keys, touch, inMode] of JOBS) {
    console.log(name.padEnd(34) + [1, 2, 3, 4, 6].map((k) => `${keys(k)}|${touch(k, rows)}|${inMode(k, rows)}`.padStart(13)).join(''));
  }
}
console.log('\nA visit with n actions on visible rows: results mode 2 + 2n (View, the slice), touch today 2n (long press + item).');
console.log('So the mode saves presses only on rows the keypad hides (one scroll each), and on nothing when the rows are visible.');

// ---- part 2: the six keys
// The editing actions and the layouts. A tap on a key is 1, its Shift layer 2 (Shift then the key) or 1 by a flick
// up (P7): both are given. The task list (tests/tasks/tasks.yaml) uses none of the six keys, so every layout costs
// the ten tasks 0 presses.
const ACTIONS = ['Esc', 'Clear', 'View (results)', 'Help', 'Undo', 'Redo', 'Copy', 'Paste', 'line start', 'line end', 'box start', 'box end'];
const LAYOUTS = {
  'K0 today (R3, spec/keyboard.yaml:88-111)': { tap: ['View (results)', 'Esc', 'Undo', 'Copy', 'line start', 'line end'], shift: ['Help', 'Clear', 'Redo', 'Paste', 'box start', 'box end'] },
  'K1 partners on one layer, everything kept': { tap: ['View (results)', 'Esc', 'Undo', 'Redo', 'Copy', 'Paste'], shift: ['Help', 'Clear', 'line start', 'line end', 'box start', 'box end'] },
  'K2 partners on one layer, ⇤ ⇥ off the keys': { tap: ['View (results)', 'Esc', 'Undo', 'Redo', 'Copy', 'Paste'], shift: ['Help', 'Clear', null, null, null, null] },
};
const TAP_ENDS = 1; // a tap at the line's start or end (--ends checks that it lands there); a box end by a tap inside it
console.log('\nPART 2: presses per action (tap = 1; a Shift layer 2 by Shift + key, 1 by a flick up)');
console.log('action'.padEnd(16) + Object.keys(LAYOUTS).map((n) => n.slice(0, 2).padStart(10)).join(''));
const sums = Object.fromEntries(Object.keys(LAYOUTS).map((n) => [n, 0]));
for (const a of ACTIONS) {
  let row = a.padEnd(16);
  for (const [n, l] of Object.entries(LAYOUTS)) {
    const t = l.tap.indexOf(a), s = l.shift.indexOf(a);
    const v = t >= 0 ? '1' : s >= 0 ? '2/1' : `tap ${TAP_ENDS}`;
    sums[n] += t >= 0 ? 1 : s >= 0 ? 2 : TAP_ENDS;
    row += v.padStart(10);
  }
  console.log(row);
}
for (const [n, l] of Object.entries(LAYOUTS)) {
  const pairs = [0, 2, 4].map((i) => `${l.tap[i]} | ${l.tap[i + 1]}`).join(', ');
  const shiftPairs = [0, 2, 4].map((i) => `${l.shift[i] ?? '–'} | ${l.shift[i + 1] ?? '–'}`).join(', ');
  console.log(`${n}: tap ${pairs}; Shift ${shiftPairs}; sum over the twelve actions (Shift = 2) ${sums[n]}; free Shift cells ${l.shift.filter((x) => x === null).length}`);
}
if (!process.argv.includes('--ends')) process.exit(0);

// ---- --ends: ⇤ ⇥ and a tap at the line's ends, in the app
function appDir() {
  if (existsSync(join(root, 'app/node_modules'))) return join(root, 'app');
  const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return join(dirname(common), 'app');
}
const req = createRequire(join(appDir(), 'package.json'));
const { chromium, devices } = req('@playwright/test');
const port = 5300 + Math.floor(Math.random() * 400);
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: join(root, 'app'), stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-vite.pid); } catch { /* gone */ } };
process.on('exit', stop);
const url = `http://localhost:${port}/?engine=fake&tips=off`;
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
  const keys = async (ids) => { for (const id of ids) await page.locator(`[data-key="${id}"]`).tap(); };
  const caret = () => page.evaluate(() => { const mf = document.querySelector('math-field'); return { pos: mf.position, last: mf.lastOffset }; });
  // a line with a fraction in the middle: 12 + 3/4 + 56
  const line = ['d1', 'd2', 'add', 'd3', 'div', 'd4', 'right', 'add', 'd5', 'd6'];
  await keys(line);
  const end = await caret();
  console.log(`\n--ends: line 12+3/4+56 typed; caret at ${end.pos} of ${end.last}`);
  await keys(['lstart']); console.log(`⇤ from the end → ${(await caret()).pos} (0 = the start)`);
  await keys(['lend']); console.log(`⇥ from the start → ${(await caret()).pos} (${end.last} = the end)`);
  // the caret's walk by ▶ from the start, then Shift + ⇤ and Shift + ⇥ from inside the numerator (the 3)
  await keys(['lstart']);
  const walk = [];
  for (let i = 0; i < 6; i++) { await keys(['right']); walk.push((await caret()).pos); }
  console.log(`▶ from the start walks ${walk.join(' ')}`);
  await keys(['lstart', 'right', 'right', 'right', 'right']);
  const inBox = (await caret()).pos;
  await keys(['shift', 'lend']); const boxEnd = (await caret()).pos;
  await keys(['shift', 'lstart']); const boxStart = (await caret()).pos;
  console.log(`caret after ▶ ▶ ▶ ▶ (in the numerator) at ${inBox}; Shift + ⇥ → ${boxEnd}; then Shift + ⇤ → ${boxStart}`);
  // a tap at the entry line's right end (past the formula) and at its left end, each from the caret at 2
  const box = await page.locator('math-field').boundingBox();
  const at = async (x) => {
    await keys(['lstart', 'right', 'right']);
    const from = (await caret()).pos;
    await page.evaluate(() => document.querySelector('math-field').focus());
    await page.waitForTimeout(550); // MathLive reads a second tap within 500 ms as a double tap (app/test/tap.spec.ts)
    await page.touchscreen.tap(x, box.y + box.height / 2);
    await page.waitForTimeout(300);
    return `${from} → ${(await caret()).pos}`;
  };
  // the formula's own box inside the field (MathLive's shadow root)
  const content = await page.evaluate(() => {
    const r = document.querySelector('math-field').shadowRoot.querySelector('.ML__content')?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right } : null;
  });
  console.log(`field ${box.x.toFixed(0)}..${(box.x + box.width).toFixed(0)} px; formula box ${content ? `${content.left.toFixed(0)}..${content.right.toFixed(0)}` : 'not found'}`);
  const spots = [['the field\'s right end', box.x + box.width - 6], ['the field\'s left end', box.x + 4]];
  if (content) spots.push(['8 px right of the formula box', content.right + 8], ['2 px inside the formula box\'s right edge', content.right - 2], ['2 px inside its left edge', content.left + 2]);
  for (const [name, x] of spots) console.log(`tap at ${name} (x = ${x.toFixed(0)}): caret ${await at(x)} (0 = the start, ${end.last} = the end)`);
} finally {
  await browser.close();
  stop();
}
