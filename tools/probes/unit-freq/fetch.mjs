// SPDX-License-Identifier: GPL-3.0-or-later
// S5: download the articles of articles.yaml once (wikitext of the current revision, English Wikipedia API) into
// tools/probes/_out/unit-freq/cache/ (gitignored) and write their revision ids and SHA-256 to sources.lock.yaml.
// The only probe here that uses the network; count.mjs works offline. Rerun only to refresh the corpus on purpose
// (the counts then change with the revisions). Needs app/node_modules (the `yaml` package).
//   node tools/probes/unit-freq/fetch.mjs
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const { parse, stringify } = createRequire(join(root, 'app/package.json'))('yaml');
const lists = parse(readFileSync(join(here, 'articles.yaml'), 'utf8'));
const cache = join(root, 'tools/probes/_out/unit-freq/cache');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'PascalineUnitCount/1.0 (offline research probe; https://github.com/buerlino/pascaline)';
export const fileOf = (title) => title.replace(/[^\p{L}\p{N}]+/gu, '_') + '.wiki';

const lock = {};
for (const [field, titles] of Object.entries(lists)) {
  mkdirSync(join(cache, field), { recursive: true });
  lock[field] = [];
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const url = `${API}?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvprop=ids|content&rvslots=main&titles=${encodeURIComponent(batch.join('|'))}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} for ${batch.join(', ')}`);
    const j = await res.json();
    const redirect = new Map((j.query.redirects ?? []).map((r) => [r.to, r.from]));
    const norm = new Map((j.query.normalized ?? []).map((r) => [r.to, r.from]));
    for (const page of j.query.pages) {
      if (page.missing) throw new Error(`missing article: ${page.title}`);
      const asked = norm.get(redirect.get(page.title) ?? page.title) ?? redirect.get(page.title) ?? page.title;
      const text = page.revisions[0].slots.main.content;
      const file = fileOf(asked);
      writeFileSync(join(cache, field, file), text);
      lock[field].push({ title: asked, page: page.title, revid: page.revisions[0].revid, file, sha256: createHash('sha256').update(text).digest('hex') });
    }
  }
  if (lock[field].length !== titles.length) throw new Error(`${field}: got ${lock[field].length} of ${titles.length}`);
  lock[field].sort((a, b) => titles.indexOf(a.title) - titles.indexOf(b.title));
}
const head = `# SPDX-License-Identifier: GPL-3.0-or-later\n# Written by fetch.mjs on ${new Date().toISOString().slice(0, 10)}: each article's revision and the SHA-256 of its wikitext in the cache.\n`;
writeFileSync(join(here, 'sources.lock.yaml'), head + stringify(lock, { lineWidth: 0 }));
console.log(Object.entries(lock).map(([f, l]) => `${f}: ${l.length}`).join(', '));
