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
  { id: 'n62', name: 'N62', src: 'Ours, from the logo: black and the teal #529997, with an orange accent.',
    idea: 'Black or white with the logo\'s teal; Shift is orange, Alpha the logo\'s teal, Enter the teal key.',
    dark: { bg: '#000000', panel: '#0c1011', line: '#2a3536', 'key-num': '#1b2122', 'key-op': '#121718', 'key-fn': '#121718', 'key-ctl': '#121718', 'key-nav': '#121718', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#eef2f2', 'text-dead': '#6f7d7e', muted: '#a7b4b4', shift: '#ff9a33', alpha: '#529997', error: '#ff7b72', 'chip-bg': '#163231', approx: '#529997', warn: '#f2c94c', pick: '#1c2b2b', focus: '#529997', 'key-on': '#529997', 'on-key-on': '#000000' },
    light: { bg: '#f4f6f6', panel: '#e8eded', line: '#b9c6c6', 'key-num': '#ffffff', 'key-op': '#e6ecec', 'key-fn': '#e6ecec', 'key-ctl': '#e6ecec', 'key-nav': '#e6ecec', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#0b1213', 'text-dead': '#687474', muted: '#44504f', shift: '#a14600', alpha: '#2e706e', error: '#b3261e', 'chip-bg': '#d6e8e6', approx: '#2e706e', warn: '#755600', pick: '#d3e5e3', focus: '#2e706e', 'key-on': '#2e706e', 'on-key-on': '#ffffff' } },
  { id: 'graphite', name: 'Graphite', src: 'Ours (R50a), refined.',
    idea: 'A calm neutral grey; key kinds differ by a hint of tint, and amber does all the pointing.',
    dark: { bg: '#17181b', panel: '#212326', line: '#46494f', 'key-num': '#323438', 'key-op': '#2a2c30', 'key-fn': '#2b3037', 'key-ctl': '#2b3037', 'key-nav': '#26282b', 'key-enter': '#a8620f', 'on-enter': '#ffffff',
      text: '#ececea', 'text-dead': '#8a8d93', muted: '#a6a9af', shift: '#f2b45a', alpha: '#8fbdf0', error: '#ff8f80', 'chip-bg': '#3a3a42', approx: '#8fbdf0', warn: '#ffb86b', pick: '#2b2d31', focus: '#f2b45a', 'key-on': '#e9b25d', 'on-key-on': '#17181b' },
    light: { bg: '#f3f2ef', panel: '#e5e3df', line: '#a9a6a0', 'key-num': '#ffffff', 'key-op': '#e4e2dd', 'key-fn': '#e2e6ea', 'key-ctl': '#e2e6ea', 'key-nav': '#ebe9e4', 'key-enter': '#8a4a00', 'on-enter': '#ffffff',
      text: '#1c1b19', 'text-dead': '#6a6862', muted: '#55534d', shift: '#8a4a00', alpha: '#1a5c94', error: '#a92a1b', 'chip-bg': '#dcd7ce', approx: '#1a5c94', warn: '#8a4000', pick: '#dcd8d0', focus: '#8a4a00', 'key-on': '#8a4a00', 'on-key-on': '#ffffff' } },
  { id: 'solarized', name: 'Solarized', src: 'Solarized by Ethan Schoonover (MIT); the owner\'s grounds #2d4056 and #ffffd6 (2026-11-06), the other colours matched to them, accents lifted or deepened to 4.5:1.',
    idea: 'The well-known accents on the owner\'s own grounds: a slate blue dark and a pale yellow paper light. Low glare, a little lower contrast by design.',
    dark: { bg: '#2d4056', panel: '#354a61', line: '#566d86', 'key-num': '#3d556f', 'key-op': '#34495f', 'key-fn': '#34495f', 'key-ctl': '#34495f', 'key-nav': '#30445a', 'key-enter': '#1f6fae', 'on-enter': '#fdf6e3',
      text: '#eef0e6', 'text-dead': '#8b9aab', muted: '#c3ccce', shift: '#f0c040', alpha: '#95cdf7', error: '#ff9f9a', 'chip-bg': '#3f5a77', approx: '#5fd4c8', warn: '#f7a27a', pick: '#22344a', focus: '#f0c040', 'key-on': '#f0c040', 'on-key-on': '#2d4056' },
    light: { bg: '#ffffd6', panel: '#f4f0c2', line: '#cbc394', 'key-num': '#fffff4', 'key-op': '#f2eec4', 'key-fn': '#f2eec4', 'key-ctl': '#f2eec4', 'key-nav': '#f7f3cc', 'key-enter': '#1a6aa6', 'on-enter': '#fffff4',
      text: '#073642', 'text-dead': '#717d7c', muted: '#475c63', shift: '#765800', alpha: '#1a62a0', error: '#b1221e', 'chip-bg': '#ebe5b4', approx: '#166d66', warn: '#a1390b', pick: '#ece6b6', focus: '#1a62a0', 'key-on': '#073642', 'on-key-on': '#ffffd6' } },
  { id: 'gruvbox', name: 'Gruvbox', src: 'Gruvbox by Pavel Pertsev (MIT). Faded accents in light, bright in dark.',
    idea: 'Warm retro browns with soft yellow, aqua and orange; easy on the eyes in a long session.',
    dark: { bg: '#1d2021', panel: '#282828', line: '#504945', 'key-num': '#3c3836', 'key-op': '#32302f', 'key-fn': '#2f3433', 'key-ctl': '#2f3433', 'key-nav': '#2a2827', 'key-enter': '#427b58', 'on-enter': '#fbf1c7',
      text: '#ebdbb2', 'text-dead': '#928374', muted: '#bdae93', shift: '#fabd2f', alpha: '#83a598', error: '#fb4934', 'chip-bg': '#45403d', approx: '#8ec07c', warn: '#fe8019', pick: '#32302f', focus: '#fabd2f', 'key-on': '#fabd2f', 'on-key-on': '#1d2021' },
    light: { bg: '#fbf1c7', panel: '#f2e5bc', line: '#bdae93', 'key-num': '#fffaeb', 'key-op': '#ebdbb2', 'key-fn': '#e8e3c4', 'key-ctl': '#e8e3c4', 'key-nav': '#f5ebc4', 'key-enter': '#427b58', 'on-enter': '#fbf1c7',
      text: '#282828', 'text-dead': '#7c6f64', muted: '#504945', shift: '#b57614', alpha: '#076678', error: '#9d0006', 'chip-bg': '#ebdbb2', approx: '#427b58', warn: '#af3a03', pick: '#ebdbb2', focus: '#076678', 'key-on': '#3c3836', 'on-key-on': '#fbf1c7' } },
  { id: 'nord', name: 'Nord', src: 'Nord by Arctic Ice Studio (MIT); the light variant is built from its Snow Storm colours.',
    idea: 'Arctic blue-greys with frost-blue accents; cool and quiet, close to an instrument panel.',
    dark: { bg: '#2e3440', panel: '#3b4252', line: '#4c566a', 'key-num': '#434c5e', 'key-op': '#3b4252', 'key-fn': '#3a465a', 'key-ctl': '#3a465a', 'key-nav': '#363c4a', 'key-enter': '#5e81ac', 'on-enter': '#ffffff',
      text: '#eceff4', 'text-dead': '#8a93a5', muted: '#d8dee9', shift: '#ebcb8b', alpha: '#88c0d0', error: '#bf616a', 'chip-bg': '#4c566a', approx: '#8fbcbb', warn: '#d08770', pick: '#3b4252', focus: '#88c0d0', 'key-on': '#88c0d0', 'on-key-on': '#2e3440' },
    light: { bg: '#eceff4', panel: '#e5e9f0', line: '#b3bccb', 'key-num': '#ffffff', 'key-op': '#e5e9f0', 'key-fn': '#dfe6ef', 'key-ctl': '#dfe6ef', 'key-nav': '#e8ecf2', 'key-enter': '#5e81ac', 'on-enter': '#ffffff',
      text: '#2e3440', 'text-dead': '#6c7689', muted: '#4c566a', shift: '#9a6b00', alpha: '#3b6a9a', error: '#a0434d', 'chip-bg': '#d8dee9', approx: '#3b6a9a', warn: '#a3542e', pick: '#d8dee9', focus: '#5e81ac', 'key-on': '#2e3440', 'on-key-on': '#eceff4' } },
];
