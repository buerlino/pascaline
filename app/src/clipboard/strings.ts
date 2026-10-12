// SPDX-License-Identifier: GPL-3.0-or-later
// English strings of Copy, Paste and Share. They sit beside the code, which loads on first use (not in the start
// chunk, docs/04 section 8.3); the keyboard legends (key.copy, key.paste, key.view) stay in i18n/en.ts.
const clip = {
  "clip.title": "Menu",
  "clip.rowTitle": "This result",
  "clip.copy": "Copy",
  "clip.asShown": "Copy as shown",
  "clip.exact": "Copy exact",
  "clip.latex": "Copy LaTeX",
  "clip.paste": "Paste",
  "clip.share": "Share session",
  "clip.clear": "Clear history",
  "clip.csv": "Copy table as CSV",
  "clip.copied": "Copied",
  "clip.copiedTable": "Copied the table as CSV",
  "clip.nothing": "Nothing to copy",
  "clip.noExact": "No exact form",
  "clip.notNumber": "Paste: not a number",
  "clip.unavailable": "The clipboard is not available",
  "clip.shared": "Shared",
  "clip.sharedAsCopy": "This device cannot share: copied instead",
  "clip.sessionTitle": "Pascaline session",
} as const;

export type ClipKey = keyof typeof clip;

/** Look up a Copy/Paste message. */
export function tc(key: ClipKey): string {
  return clip[key];
}
