// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4: the words of the first-start tips. A table of its own, loaded with the tips' chunk (views/tipsHost.ts), so the
// start chunk does not carry it. English only so far. (The Settings row's label is "tips.row" in enAbout.ts.)
export const enTips = {
  "tips.title": "First-start tips",
  "tips.place": "Tap the name for your apps, Home and CAS",
  "tips.menu": "Tap ☰ for the menu: copy, paste, settings",
  "tips.gotIt": "Got it",
} as const;

export type TipsKey = keyof typeof enTips;

export function tipsText(key: TipsKey): string {
  return enTips[key];
}
