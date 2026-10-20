// SPDX-License-Identifier: GPL-3.0-or-later
// The contrast audit of the theme set (5 families x light/dark x High contrast x Plain keys = 40 combinations), now
// a thin wrapper: the code is the app's theme generator (app/scripts/theme-gen.ts, R50c).
//
//   node tools/probes/themes-audit.mjs            # one line per combination, then "40/40 pass"
//   node tools/probes/themes-audit.mjs --css      # every combination as a CSS block (what the generator writes)
//   node tools/probes/themes-audit.mjs --fixes    # which canonical colours the contrast floor moved, per family
import { block, combos, theme } from '../../app/scripts/theme-gen.ts';
import { spawnSync } from 'node:child_process';

const arg = process.argv[2];
if (arg === '--css') for (const c of combos()) console.log(block(c));
else if (arg === '--fixes') {
  for (const c of combos()) {
    if (c.high || c.plain) continue;
    const { fixes } = theme(c);
    if (fixes.length) console.log(c.family, c.brightness, fixes.map(([r, a, b]) => `--${r} ${a} -> ${b}`).join(', '));
  }
} else {
  const r = spawnSync(process.execPath, [new URL('../../app/scripts/theme-gen.ts', import.meta.url).pathname, '--audit'], { stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
}
