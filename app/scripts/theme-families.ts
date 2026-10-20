// SPDX-License-Identifier: GPL-3.0-or-later
// The five theme families' own colour values (R50c), moved from tools/probes/themes-audit.mjs. Each gives a value for
// every role except --on-error and the derived ones, which theme-gen.ts adds; credit and licence in `src`
// (THIRD_PARTY.md "Theme colours"). Edit here, then `npm run themes` rewrites the generated CSS.

export type Palette = Record<string, string>;
export interface Family {
  id: string;
  name: string;
  src: string;
  idea: string;
  dark: Palette;
  light: Palette;
}

export const FAMILIES: readonly Family[] = [
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
