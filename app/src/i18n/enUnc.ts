// SPDX-License-Identifier: GPL-3.0-or-later
// R40: the uncertainty texts (Settings › Numbers › Uncertainty, R124's Marks, the Fmt key cycle row, the σ line). A table of its own,
// loaded with the Mode sheet's and the σ line's chunks, so the start chunk does not carry it (R91's pin, docs/04 8.3).
// English only so far.
export const enUnc = {
  "unc.fmtCycle": "Fmt key cycle",
  "unc.setting": "Uncertainty",
  "unc.setting.sigma": "Muted digits, σ on tap",
  "unc.setting.muted": "Muted digits",
  "unc.sigma": "σ = {s} · U = 2σ = {u} (k = 2)",
  // R124: Settings › Numbers › Marks
  "marks.setting": "Marks",
  "marks.setting.muted": "Muted",
  "marks.setting.colour": "⚠ coloured",
  "marks.setting.reason": "⚠ + reason",
  "marks.setting.muted.spoken": "Marks muted",
  "marks.setting.colour.spoken": "Warning marks in colour",
  "marks.setting.reason.spoken": "Warning marks in colour, with their reason under the result",
} as const;

export type UncKey = keyof typeof enUnc;

/** The text of `key`, each `{name}` replaced by its value. */
export const uncText = (key: UncKey, vars: Readonly<Record<string, string>> = {}): string =>
  enUnc[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
