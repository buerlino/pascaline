// SPDX-License-Identifier: GPL-3.0-or-later
// The three theme families' own colour values (R50c, R150), moved from tools/probes/themes-audit.mjs. Each gives a value for
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
  { id: 'n62', name: 'N62', src: 'Ours, from the logo: black and the teal #529997, with an orange accent.',
    idea: 'Black or white with the logo\'s teal; Shift is orange, Alpha the logo\'s teal, Enter the teal key.',
    dark: { bg: '#000000', panel: '#0c1011', line: '#2a3536', 'key-num': '#1b2122', 'key-op': '#121718', 'key-fn': '#121718', 'key-ctl': '#121718', 'key-nav': '#121718', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#eef2f2', 'text-dead': '#6f7d7e', muted: '#a7b4b4', shift: '#ff9a33', alpha: '#529997', error: '#ff7b72', 'chip-bg': '#163231', approx: '#529997', warn: '#f2c94c', pick: '#1c2b2b', focus: '#529997', 'key-on': '#529997', 'on-key-on': '#000000' },
    light: { bg: '#f4f6f6', panel: '#e8eded', line: '#b9c6c6', 'key-num': '#ffffff', 'key-op': '#e6ecec', 'key-fn': '#e6ecec', 'key-ctl': '#e6ecec', 'key-nav': '#e6ecec', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#0b1213', 'text-dead': '#687474', muted: '#44504f', shift: '#a14600', alpha: '#2e706e', error: '#b3261e', 'chip-bg': '#d6e8e6', approx: '#2e706e', warn: '#755600', pick: '#d3e5e3', focus: '#2e706e', 'key-on': '#2e706e', 'on-key-on': '#ffffff' } },
  { id: 'teal', name: 'Teal', src: 'Ours: N62 inside out, the whole screen in the logo\'s teal (owner, 2026-11-06).',
    idea: 'The whole screen in the logo\'s teal with N62\'s black as its text; Dark keeps N62 Dark\'s black keys, Light N62 Light\'s white keys.',
    dark: { bg: '#529997', panel: '#7dbcb9', line: '#1f4645', 'key-num': '#1b2122', 'key-op': '#121718', 'key-fn': '#121718', 'key-ctl': '#121718', 'key-nav': '#121718', 'key-enter': '#eef2f2', 'on-enter': '#000000',
      text: '#000000', 'key-text': '#eef2f2', 'text-dead': '#1f4645', 'key-text-dead': '#6f7d7e', muted: '#0a2423', 'key-muted': '#a7b4b4', shift: '#5c3a00', 'key-shift': '#ff9a33', alpha: '#04282a', 'key-alpha': '#529997',
      approx: '#062625', warn: '#362300', error: '#4a0000', 'chip-bg': '#7dbcb9', pick: '#3f7e7c', focus: '#000000', 'key-on': '#000000', 'on-key-on': '#529997' },
    light: { bg: '#529997', panel: '#f4f6f6', line: '#1f4645', 'key-num': '#ffffff', 'key-op': '#e6ecec', 'key-fn': '#e6ecec', 'key-ctl': '#e6ecec', 'key-nav': '#e6ecec', 'key-enter': '#0b1213', 'on-enter': '#ffffff',
      text: '#0b1213', 'key-text': '#0b1213', 'text-dead': '#687474', muted: '#0a2423', shift: '#a14600', alpha: '#2e706e',
      approx: '#062625', warn: '#362300', error: '#4a0000', 'chip-bg': '#f4f6f6', pick: '#8cc4c1', focus: '#0b1213', 'key-on': '#0b1213', 'on-key-on': '#ffffff' } },
  { id: 'solarized', name: 'Solarized', src: 'Solarized by Ethan Schoonover (MIT); the owner\'s grounds #2d4056 and #ffffd6 (2026-11-06), the other colours matched to them, accents lifted or deepened to 4.5:1.',
    idea: 'The well-known accents on the owner\'s own grounds: a slate blue dark and a pale yellow paper light. Low glare, a little lower contrast by design.',
    dark: { bg: '#2d4056', panel: '#354a61', line: '#566d86', 'key-num': '#3d556f', 'key-op': '#34495f', 'key-fn': '#34495f', 'key-ctl': '#34495f', 'key-nav': '#30445a', 'key-enter': '#1f6fae', 'on-enter': '#fdf6e3',
      text: '#eef0e6', 'text-dead': '#8b9aab', muted: '#c3ccce', shift: '#f0c040', alpha: '#95cdf7', error: '#ff9f9a', 'chip-bg': '#3f5a77', approx: '#5fd4c8', warn: '#f7a27a', pick: '#22344a', focus: '#f0c040', 'key-on': '#f0c040', 'on-key-on': '#2d4056' },
    light: { bg: '#ffffd6', panel: '#f4f0c2', line: '#cbc394', 'key-num': '#fffff4', 'key-op': '#f2eec4', 'key-fn': '#f2eec4', 'key-ctl': '#f2eec4', 'key-nav': '#f7f3cc', 'key-enter': '#1a6aa6', 'on-enter': '#fffff4',
      text: '#073642', 'text-dead': '#717d7c', muted: '#475c63', shift: '#765800', alpha: '#1a62a0', error: '#b1221e', 'chip-bg': '#ebe5b4', approx: '#166d66', warn: '#a1390b', pick: '#ece6b6', focus: '#1a62a0', 'key-on': '#073642', 'on-key-on': '#ffffd6' } },
];
