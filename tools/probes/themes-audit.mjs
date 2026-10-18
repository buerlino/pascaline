// SPDX-License-Identifier: GPL-3.0-or-later
// The theme set of docs/mockups/themes-r50.html (owner's pick, 2026-10-18): five families in light and dark, and the
// High contrast and Plain keys transforms, with the contrast audit of every combination (5 x 2 x 2 x 2 = 40).
// The same code as the mockup's script; keep the two in step until R50c moves it into the app's theme generator.
//
//   node tools/probes/themes-audit.mjs            # one line per combination, then "40/40 pass"
//   node tools/probes/themes-audit.mjs --css      # every combination as a CSS block (what R50c generates)
//   node tools/probes/themes-audit.mjs --fixes    # which canonical colours the contrast floor moved, per family
// (High contrast, Plain keys) that derive the rest. Pure functions; run under Node for the audit.
const KEYS = ['key-num', 'key-op', 'key-fn', 'key-ctl', 'key-nav'];

// --- colour maths (sRGB, WCAG 2 contrast) -------------------------------------------------------
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
function lum(h) { const c = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function cr(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function mix(a, b, t) { const p = hex2rgb(a), q = hex2rgb(b); return rgb2hex(p.map((v, i) => v + (q[i] - v) * t)); }
function rgb2hsl(h) { let [r, g, b] = hex2rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh, s, l]; }
function hsl2hex([h, s, l]) { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (s === 0) return rgb2hex([l, l, l].map((v) => v * 255)); const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return rgb2hex([f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => v * 255)); }
function desat(h, k) { const [hh, s, l] = rgb2hsl(h); return hsl2hex([hh, s * k, l]); }
// Move fg's lightness away from the backgrounds (hue and saturation kept) until it reaches min on all of them.
function ensure(fg, bgs, min, dark) {
  if (bgs.every((b) => cr(fg, b) >= min)) return fg;
  const [h, s, l0] = rgb2hsl(fg);
  for (let i = 1; i <= 200; i++) { const l = dark ? Math.min(1, l0 + i * 0.005) : Math.max(0, l0 - i * 0.005); const c = hsl2hex([h, s, l]); if (bgs.every((b) => cr(c, b) >= min)) return c; }
  return dark ? '#ffffff' : '#000000';
}

// --- the families --------------------------------------------------------------------------------
// Each family gives its own values for every role; credit and licence in `src`.
const FAMILIES = [
  { id: 'pascaline', name: 'Pascaline', src: 'Ours, from the logo: ink blue and the amber of the P.',
    idea: 'Ink blue with one amber accent, the colours of the logo. Shift is the amber of the P; Enter is the logo blue.',
    dark: { bg: '#0b1020', panel: '#121a2e', line: '#2d3a5a', 'key-num': '#1f2a45', 'key-op': '#18233d', 'key-fn': '#172443', 'key-ctl': '#2a2433', 'key-nav': '#141d33', 'key-enter': '#2346d8', 'on-enter': '#ffffff',
      text: '#eef1f8', 'text-dead': '#76819c', muted: '#a3adc6', shift: '#ffc233', alpha: '#86c5ff', error: '#ff8e86', 'chip-bg': '#1d3070', approx: '#86c5ff', warn: '#ffc233', pick: '#1a2442', focus: '#ffc233', 'key-on': '#ffc233', 'on-key-on': '#0b1020' },
    light: { bg: '#f5f6fa', panel: '#e7eaf3', line: '#b7bfd4', 'key-num': '#ffffff', 'key-op': '#e6eaf5', 'key-fn': '#e1e8fb', 'key-ctl': '#f8ecd2', 'key-nav': '#eceef3', 'key-enter': '#0025b5', 'on-enter': '#ffffff',
      text: '#0f172a', 'text-dead': '#6b7489', muted: '#4a556e', shift: '#8a5300', alpha: '#0b4fc4', error: '#b3261e', 'chip-bg': '#d8e1fb', approx: '#0b4fc4', warn: '#8a4b00', pick: '#dde4f8', focus: '#0025b5', 'key-on': '#0025b5', 'on-key-on': '#ffffff' } },
  { id: 'graphite', name: 'Graphite', src: 'Ours (R50a), refined.',
    idea: 'A calm neutral grey; key kinds differ by a hint of tint, and amber does all the pointing.',
    dark: { bg: '#17181b', panel: '#212326', line: '#46494f', 'key-num': '#323438', 'key-op': '#2a2c30', 'key-fn': '#2b3037', 'key-ctl': '#37322c', 'key-nav': '#26282b', 'key-enter': '#a8620f', 'on-enter': '#ffffff',
      text: '#ececea', 'text-dead': '#8a8d93', muted: '#a6a9af', shift: '#f2b45a', alpha: '#8fbdf0', error: '#ff8f80', 'chip-bg': '#3a3a42', approx: '#8fbdf0', warn: '#ffb86b', pick: '#2b2d31', focus: '#f2b45a', 'key-on': '#e9b25d', 'on-key-on': '#17181b' },
    light: { bg: '#f3f2ef', panel: '#e5e3df', line: '#a9a6a0', 'key-num': '#ffffff', 'key-op': '#e4e2dd', 'key-fn': '#e2e6ea', 'key-ctl': '#eee2d0', 'key-nav': '#ebe9e4', 'key-enter': '#8a4a00', 'on-enter': '#ffffff',
      text: '#1c1b19', 'text-dead': '#6a6862', muted: '#55534d', shift: '#8a4a00', alpha: '#1a5c94', error: '#a92a1b', 'chip-bg': '#dcd7ce', approx: '#1a5c94', warn: '#8a4000', pick: '#dcd8d0', focus: '#8a4a00', 'key-on': '#8a4a00', 'on-key-on': '#ffffff' } },
  { id: 'solarized', name: 'Solarized', src: 'Solarized by Ethan Schoonover (MIT). Accents lifted or deepened where needed to reach 4.5:1 on the keys.',
    idea: 'The well-known 16 colours: the same accents on a dark teal or a warm paper ground. Low glare, a little lower contrast by design.',
    dark: { bg: '#002b36', panel: '#073642', line: '#2c5560', 'key-num': '#0a3f4c', 'key-op': '#073642', 'key-fn': '#08394f', 'key-ctl': '#1e3b3a', 'key-nav': '#04313c', 'key-enter': '#1f6fae', 'on-enter': '#fdf6e3',
      text: '#c8cfc8', 'text-dead': '#6b8288', muted: '#93a1a1', shift: '#b58900', alpha: '#268bd2', error: '#dc322f', 'chip-bg': '#0d4a5a', approx: '#2aa198', warn: '#cb4b16', pick: '#0a4250', focus: '#b58900', 'key-on': '#b58900', 'on-key-on': '#002b36' },
    light: { bg: '#fdf6e3', panel: '#eee8d5', line: '#c9c0a6', 'key-num': '#fffbf0', 'key-op': '#eee8d5', 'key-fn': '#e6e8dc', 'key-ctl': '#f3e6c6', 'key-nav': '#f5efdc', 'key-enter': '#1a6aa6', 'on-enter': '#fdf6e3',
      text: '#073642', 'text-dead': '#7f8c8d', muted: '#586e75', shift: '#b58900', alpha: '#268bd2', error: '#dc322f', 'chip-bg': '#e3dcc6', approx: '#2aa198', warn: '#cb4b16', pick: '#e8e1cb', focus: '#268bd2', 'key-on': '#073642', 'on-key-on': '#fdf6e3' } },
  { id: 'gruvbox', name: 'Gruvbox', src: 'Gruvbox by Pavel Pertsev (MIT). Faded accents in light, bright in dark.',
    idea: 'Warm retro browns with soft yellow, aqua and orange; easy on the eyes in a long session.',
    dark: { bg: '#1d2021', panel: '#282828', line: '#504945', 'key-num': '#3c3836', 'key-op': '#32302f', 'key-fn': '#2f3433', 'key-ctl': '#3a322a', 'key-nav': '#2a2827', 'key-enter': '#427b58', 'on-enter': '#fbf1c7',
      text: '#ebdbb2', 'text-dead': '#928374', muted: '#bdae93', shift: '#fabd2f', alpha: '#83a598', error: '#fb4934', 'chip-bg': '#45403d', approx: '#8ec07c', warn: '#fe8019', pick: '#32302f', focus: '#fabd2f', 'key-on': '#fabd2f', 'on-key-on': '#1d2021' },
    light: { bg: '#fbf1c7', panel: '#f2e5bc', line: '#bdae93', 'key-num': '#fffaeb', 'key-op': '#ebdbb2', 'key-fn': '#e8e3c4', 'key-ctl': '#f3dfae', 'key-nav': '#f5ebc4', 'key-enter': '#427b58', 'on-enter': '#fbf1c7',
      text: '#282828', 'text-dead': '#7c6f64', muted: '#504945', shift: '#b57614', alpha: '#076678', error: '#9d0006', 'chip-bg': '#ebdbb2', approx: '#427b58', warn: '#af3a03', pick: '#ebdbb2', focus: '#076678', 'key-on': '#3c3836', 'on-key-on': '#fbf1c7' } },
  { id: 'nord', name: 'Nord', src: 'Nord by Arctic Ice Studio (MIT); the light variant is built from its Snow Storm colours.',
    idea: 'Arctic blue-greys with frost-blue accents; cool and quiet, close to an instrument panel.',
    dark: { bg: '#2e3440', panel: '#3b4252', line: '#4c566a', 'key-num': '#434c5e', 'key-op': '#3b4252', 'key-fn': '#3a465a', 'key-ctl': '#46434f', 'key-nav': '#363c4a', 'key-enter': '#5e81ac', 'on-enter': '#ffffff',
      text: '#eceff4', 'text-dead': '#8a93a5', muted: '#d8dee9', shift: '#ebcb8b', alpha: '#88c0d0', error: '#bf616a', 'chip-bg': '#4c566a', approx: '#8fbcbb', warn: '#d08770', pick: '#3b4252', focus: '#88c0d0', 'key-on': '#88c0d0', 'on-key-on': '#2e3440' },
    light: { bg: '#eceff4', panel: '#e5e9f0', line: '#b3bccb', 'key-num': '#ffffff', 'key-op': '#e5e9f0', 'key-fn': '#dfe6ef', 'key-ctl': '#ece6e2', 'key-nav': '#e8ecf2', 'key-enter': '#5e81ac', 'on-enter': '#ffffff',
      text: '#2e3440', 'text-dead': '#6c7689', muted: '#4c566a', shift: '#9a6b00', alpha: '#3b6a9a', error: '#a0434d', 'chip-bg': '#d8dee9', approx: '#3b6a9a', warn: '#a3542e', pick: '#d8dee9', focus: '#5e81ac', 'key-on': '#2e3440', 'on-key-on': '#eceff4' } },
];

// --- the base palette after the contrast floor ------------------------------------------------
// A family's own value is kept when it passes; otherwise only its lightness moves until it does.
// `fixes` lists every role that moved, so the page can show which canonical colours were adjusted.
function base(fam, dark) {
  const t = { ...fam[dark ? 'dark' : 'light'] }, fixes = [];
  const fix = (role, bgs, min) => { const v = ensure(t[role], bgs.map((b) => t[b]), min, dark); if (v !== t[role]) { fixes.push([role, t[role], v]); t[role] = v; } };
  fix('text', [...KEYS, 'bg', 'panel', 'pick', 'chip-bg'], 4.5);
  fix('muted', ['bg', 'panel', 'key-num', 'pick'], 4.5);
  for (const r of ['shift', 'alpha']) fix(r, [...KEYS, 'panel'], 4.5);
  for (const r of ['approx', 'warn', 'error']) fix(r, ['bg', 'pick'], 4.5);
  fix('focus', ['bg', 'panel'], 3);
  fix('text-dead', KEYS.concat('panel'), 3);
  // on-enter: the key moves rather than the label, so the label keeps the family's colour
  if (cr(t['on-enter'], t['key-enter']) < 4.5) { const v = ensure(t['key-enter'], [t['on-enter']], 4.5, lum(t['on-enter']) < 0.5); fixes.push(['key-enter', t['key-enter'], v]); t['key-enter'] = v; }
  if (cr(t['on-key-on'], t['key-on']) < 4.5) { const v = ensure(t['on-key-on'], [t['key-on']], 4.5, lum(t['key-on']) < 0.2); fixes.push(['on-key-on', t['on-key-on'], v]); t['on-key-on'] = v; }
  return { t, fixes };
}

// --- High contrast: darker (or lighter) grounds, text at 7:1, legends at 7:1, a strong key outline ---
function highContrast(t, dark) {
  const o = { ...t }, ext = dark ? '#000000' : '#ffffff', ink = dark ? '#ffffff' : '#000000';
  o.bg = mix(t.bg, ext, 0.65); o.panel = mix(t.panel, ext, 0.5); o.pick = mix(t.pick, ext, 0.3);
  for (const k of KEYS) o[k] = mix(t[k], ext, dark ? 0.45 : 0.6);
  o['chip-bg'] = mix(t['chip-bg'], ext, 0.35);
  o.text = mix(t.text, ink, 0.8);
  const all = [...KEYS, 'bg', 'panel', 'pick', 'chip-bg'].map((r) => o[r]);
  o.text = ensure(o.text, all, 7, dark);
  o.muted = ensure(t.muted, [o.bg, o.panel, o['key-num'], o.pick], 7, dark);
  for (const r of ['shift', 'alpha']) o[r] = ensure(t[r], [...KEYS.map((k) => o[k]), o.panel], 7, dark);
  for (const r of ['approx', 'warn', 'error']) o[r] = ensure(t[r], [o.bg, o.pick], 7, dark);
  o['text-dead'] = ensure(t['text-dead'], [...KEYS.map((k) => o[k]), o.panel], 4.5, dark);
  o.line = ensure(mix(t.line, ink, 0.25), [o.bg, ...KEYS.map((k) => o[k])], 3, dark);
  o.focus = ensure(t.focus, [o.bg, o.panel], 4.5, dark);
  o['key-enter'] = ensure(t['key-enter'], [t['on-enter']], 7, lum(t['on-enter']) < 0.5);
  o['key-on'] = ensure(t['key-on'], [t['on-key-on']], 7, lum(t['on-key-on']) < 0.5);
  return o;
}

// --- Plain keys: no colour coding. One neutral tone for every key, the digit block one step brighter,
// legends in the text colour (Shift bold, Alpha italic), Enter inverted. ⚠ and errors keep their colour.
function plain(t, dark) {
  const o = { ...t };
  const k1 = desat(t['key-num'], 0.35), k2 = desat(mix(t['key-num'], t.bg, 0.5), 0.35);
  o['key-num'] = k1; for (const k of ['key-op', 'key-fn', 'key-ctl', 'key-nav']) o[k] = k2;
  o.shift = t.text; o.alpha = t.text; o.approx = t.text;
  o['key-enter'] = t.text; o['on-enter'] = t.bg;
  o['key-on'] = t.text; o['on-key-on'] = t.bg; o.focus = t.text;
  o['chip-bg'] = k2; o.pick = mix(t.bg, t.text, 0.1);
  // text-dead must stay dimmer than live text but readable on both tones
  o['text-dead'] = ensure(t['text-dead'], [k1, k2, o.panel], 3, dark);
  return o;
}

function theme(famId, dark, hc, pl) {
  const fam = FAMILIES.find((f) => f.id === famId);
  const { t, fixes } = base(fam, dark);
  let o = t;
  if (pl) o = plain(o, dark);
  if (hc) o = highContrast(o, dark);
  return { t: o, fixes };
}

// --- the audit: every pair the app draws ---------------------------------------------------------
function checks(t, hc) {
  const out = [], T = hc ? 7 : 4.5, D = hc ? 4.5 : 3;
  const add = (g, l, f, b, min) => out.push({ g, l, f, b, min, v: cr(t[f], t[b]) });
  add('Screen', 'text on screen', 'text', 'bg', T); add('Screen', 'input line (muted) on screen', 'muted', 'bg', T);
  add('Screen', 'error text on screen', 'error', 'bg', T); add('Screen', '≈ mark on screen', 'approx', 'bg', T); add('Screen', '⚠ mark on screen', 'warn', 'bg', T);
  add('Screen', 'text on the picked row', 'text', 'pick', T); add('Screen', 'muted on the picked row', 'muted', 'pick', T);
  add('Screen', 'text on the status line', 'text', 'panel', T); add('Screen', 'text on a chip', 'text', 'chip-bg', T);
  add('Screen', 'focus and cursor on screen (non-text)', 'focus', 'bg', 3);
  for (const k of KEYS) { for (const f of ['text', 'shift', 'alpha']) add('Keys', `${f} on ${k}`, f, k, T); add('Keys', `dead face on ${k}`, 'text-dead', k, D); }
  add('Keys', 'Enter label', 'on-enter', 'key-enter', T); add('Keys', 'label of a key that is on', 'on-key-on', 'key-on', T);
  for (const b of ['panel', 'key-num']) { for (const f of ['text', 'shift', 'muted']) add('Sheet', `${f} on ${b}`, f, b, T); add('Sheet', `disabled row on ${b}`, 'text-dead', b, D); }
  if (hc) for (const k of KEYS) add('Keys', `key outline on screen around ${k} (non-text)`, 'line', 'bg', 3);
  return out;
}
function dimmedOk(t) { return KEYS.every((k) => cr(t['text-dead'], t[k]) <= cr(t.text, t[k]) - 1); }



const args = process.argv.slice(2);
let pass = 0, total = 0;
for (const f of FAMILIES) for (const dark of [true, false]) for (const hc of [false, true]) for (const pl of [false, true]) {
  const { t, fixes } = theme(f.id, dark, hc, pl);
  const cs = checks(t, hc), bad = cs.filter((c) => c.v < c.min), ok = !bad.length && dimmedOk(t);
  const sel = `[data-family="${f.id}"][data-brightness="${dark ? 'dark' : 'light'}"]${hc ? '[data-contrast="high"]' : ''}${pl ? '[data-keys="plain"]' : ''}`;
  total++; if (ok) pass++;
  if (args.includes('--css')) console.log(`:root${sel} {\n${Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`);
  else if (args.includes('--fixes')) { if (!hc && !pl && fixes.length) console.log(f.id, dark ? 'dark' : 'light', fixes.map(([r, a, b]) => `--${r} ${a} -> ${b}`).join(', ')); }
  else console.log(`${ok ? 'ok  ' : 'FAIL'} ${sel}  ${cs.length} pairs${bad.length ? '  ' + bad.map((c) => `${c.l} ${c.v.toFixed(2)} < ${c.min}`).join('; ') : ''}${dimmedOk(t) ? '' : '  (a dead face is not 1 below a live one)'}`);
}
if (!args.includes('--css')) console.log(`${pass}/${total} pass`);
process.exitCode = pass === total ? 0 : 1;
