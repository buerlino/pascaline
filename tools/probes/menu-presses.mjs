// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S2, the menu audit): how many presses it takes to pick each cell of a grid palette, by keys and by touch.
// Grids: the Tmpl palette as built (spec/keyboard.yaml `templates:`, R10) and the two Shift palettes R18 will build
// (cells as listed in docs/shifts/brief.md, section 7 "R18"). Results and reasoning: docs/research/r8-menus.md.
//
//   node tools/probes/menu-presses.mjs            summary per grid
//   node tools/probes/menu-presses.mjs --cells    plus the cost of every cell
//
// Move model: a copy of Level.gridMove in app/src/views/sheet.svelte.ts (▲ ▼ = one row up or down, round the ends of
// the column; ◀ ▶ = one cell back or on in reading order, round the ends of the grid). The highlight starts on cell 1
// (the first open; later opens start on the last pick, which makes a repeat 2 presses). Counting (docs/04 5.2): every
// press counts 1; Shift counts 1; a flick up counts 1; a tap on a cell counts 1.
//   keys      open + arrow presses (shortest path) + Enter
//   at place  open + the key at the cell's place (only for a grid that fits the digit block, 4 x 3: 7 8 9 ÷ / 4 5 6 × /
//             1 2 3 −; how the G2 picks in its Shift + 6 palette, brief R18)
//   touch     open + a tap on the cell
// Needs app/node_modules (the `yaml` package), from this checkout or the main one.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function yamlFrom() {
  const here = join(root, 'app/node_modules/yaml');
  if (existsSync(here)) return createRequire(join(root, 'app/package.json'))('yaml');
  // a git worktree has no node_modules: use the main checkout's
  const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return createRequire(join(dirname(common), 'app/package.json'))('yaml');
}
const { parse } = yamlFrom();
const CELLS = process.argv.includes('--cells');

const spec = parse(readFileSync(join(root, 'spec/keyboard.yaml'), 'utf8'));
const tmpl = spec.templates;

/** The grids: columns, cell names in reading order, how the palette opens (presses), and whether cells are picked by
 *  the key at their place. */
const GRIDS = [
  {
    name: 'Tmpl (built, R10)',
    columns: tmpl.columns,
    cells: [...tmpl.items].sort((a, b) => a.row - b.row || a.col - b.col).map((x) => x.id),
    open: { keys: 1, flick: 1 }, // Tmpl
  },
  {
    name: 'Shift + 6 (planned, R18)',
    columns: 4,
    cells: ['<', '≤', '>', '≥', '==', '≠', 'AND', 'OR', 'NOT', 'XOR', 'EQ'],
    open: { keys: 2, flick: 1 }, // Shift, 6 | flick up on 6
    atPlace: ['d7', 'd8', 'd9', 'div', 'd4', 'd5', 'd6', 'mul', 'd1', 'd2', 'd3'],
  },
  {
    name: 'Shift + 9 (planned, R18)',
    columns: 8,
    cells: ['!', '→', '∞', '°', '′', '″', '&', 'Å', 'α', 'β', 'γ', 'Δ', 'δ', 'ε', 'θ', 'λ', 'μ', 'ρ', 'Σ', 'σ', 'τ', 'φ', 'χ', 'Ω'],
    open: { keys: 2, flick: 1 }, // Shift, 9 | flick up on 9
  },
];

/** Level.gridMove (app/src/views/sheet.svelte.ts), for one press from cell i. */
function moves(i, n, cols) {
  const out = [];
  const col = i % cols;
  const last = col + cols * Math.floor((n - 1 - col) / cols);
  for (const [by, column] of [[cols, true], [-cols, true], [1, false], [-1, false]]) {
    let next = i + by;
    if (column) {
      if (next < 0) next = last;
      else if (next >= n) next = col;
    } else next = (next + n) % n;
    out.push(next);
  }
  return out;
}

/** Fewest arrow presses from cell 0 to every cell (breadth-first). */
function arrowDistances(n, cols) {
  const d = new Array(n).fill(Infinity);
  d[0] = 0;
  const queue = [0];
  while (queue.length) {
    const i = queue.shift();
    for (const j of moves(i, n, cols)) if (d[j] === Infinity) ((d[j] = d[i] + 1), queue.push(j));
  }
  return d;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (xs) => `median ${median(xs)}, mean ${mean(xs).toFixed(2)}, max ${Math.max(...xs)}`;

for (const g of GRIDS) {
  const n = g.cells.length;
  const d = arrowDistances(n, g.columns);
  const keys = d.map((x) => g.open.keys + x + 1);
  const flick = d.map((x) => g.open.flick + x + 1);
  console.log(`\n${g.name}: ${g.columns} x ${Math.ceil(n / g.columns)}, ${n} cells`);
  console.log(`  keys (tap to open)   ${fmt(keys)}`);
  if (g.open.flick !== g.open.keys) console.log(`  keys (flick to open) ${fmt(flick)}`);
  if (g.atPlace) console.log(`  key at place         ${g.open.keys + 1} (tap to open), ${g.open.flick + 1} (flick) for every cell`);
  console.log(`  touch                ${g.open.keys + 1} (tap to open), ${g.open.flick + 1} (flick) for every cell`);
  console.log(`  repeat of the last pick: ${g.open.keys + 1} (open, Enter)`);
  if (CELLS) console.log('  ' + g.cells.map((c, i) => `${c} ${keys[i]}`).join(' · '));
}
