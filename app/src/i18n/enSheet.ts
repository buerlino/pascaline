// SPDX-License-Identifier: GPL-3.0-or-later
// The texts only the sheet's own view draws (views/Sheet.svelte: close, back, the item count, the stepper buttons, no match).
// A table of its own, loaded with that lazy chunk, so the start chunk does not carry it (R91's pin, docs/04 8.3; moved
// out of en.ts by R145f1). English only so far.
export const enSheet = {
  "apps.close": "Close",
  "sheet.back": "Back",
  "sheet.count": "{n} items",
  "sheet.stepDown": "Previous value",
  "sheet.stepUp": "Next value",
  "sheet.noMatch": "No match",
} as const;

export type SheetKey = keyof typeof enSheet;

/** The text of `key`, each `{name}` replaced by its value. */
export const sheetText = (key: SheetKey, vars?: Readonly<Record<string, string>>): string =>
  vars ? enSheet[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m) : enSheet[key];
