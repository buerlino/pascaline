// SPDX-License-Identifier: GPL-3.0-or-later
// R87: the words of Settings › Help and about. A table of its own, loaded with the Mode sheet's chunk
// (views/aboutItems.ts), so the start chunk does not carry it. English only so far.
export const enAbout = {
  "help": "Help and about",
  "title": "About Pascaline",
  "aboutTitle": "About",
  "hint": "Version, source, GPL-3.0",
  "parts": "Parts we use and their licences",
  "partsTitle": "Parts",
  "partsHint": "From THIRD_PARTY.md",
  "loading": "Loading…",
  "version": "Version",
  "licence": "Licence",
  "source": "Source code",
  "credits": "Credits",
  "credits.text": "Pascaline is free software under the GNU General Public License, version 3 or later, with no warranty. It stands on the work of others: the Giac computer algebra system by Bernard Parisse and its authors, with GMP, MPFR and GSL under it; MathLive by Arno Gourdol for the entry line and the result display; libqalculate by Hanna Knutsson for the names and titles of units and constants; JSXGraph for the plots; Svelte, Vite and Capacitor for the app; the colour schemes Solarized, Gruvbox and Nord. Every part, its licence and its full licence text are listed under Parts we use.",
  "noText": "No licence text in the app",
  "copyright": "No copyright line given",
} as const;

export type AboutKey = keyof typeof enAbout;

export function aboutText(key: AboutKey): string {
  return enAbout[key];
}
