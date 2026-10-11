// SPDX-License-Identifier: GPL-3.0-or-later
// P3 spike: cold lazy start of the qalc worker in Chromium (fresh browser context per run, no HTTP cache).
//   node spike/qalc/bench-chromium.mjs <out dir with qalc.{mjs,wasm}> [runs=7]
// Uses the Playwright that app/ installs (npm ci in app/; npx playwright install chromium).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2]);
const runs = Number(process.argv[3] ?? 7);
const appDir = process.env.APP_DIR ?? join(here, '../../app');  // APP_DIR=<checkout>/app from a git worktree
const { chromium } = createRequire(join(appDir, 'package.json'))('playwright');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };

const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html';
  const file = name.startsWith('qalc.') ? join(out, name) : join(here, 'page', name);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream',
      'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const rows = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  const r = await page.waitForFunction(() => window.qalcResult, null, { timeout: 30000 }).then((h) => h.jsonValue());
  rows.push(r);
  console.log(JSON.stringify({ ready_ms: +r.ready_ms.toFixed(1), first_result_ms: +r.first_result_ms.toFixed(1), first: r.first }));
  await ctx.close();
}
await browser.close();
server.close();
const med = (k) => { const v = rows.map((r) => r[k]).sort((a, b) => a - b); return +v[v.length >> 1].toFixed(1); };
console.log(JSON.stringify({ runs, median_ready_ms: med('ready_ms'), median_first_result_ms: med('first_result_ms'), ua: rows[0].ua }));
