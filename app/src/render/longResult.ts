// SPDX-License-Identifier: GPL-3.0-or-later
// R135 (F71): a LaTeX too long for MathLive to draw in a frame is not drawn, and never shown as source: a short note
// says so (Copy holds the whole text). Pure module: no MathLive, so the start chunk pays nothing for it.
import { t } from "../i18n/index.ts";

/** The longest LaTeX the app draws. MathLive's SSR build takes about 36 ms for 4 kB, 55 ms for 6 kB and 118 ms for 16 kB on the desktop
 *  (the Tab One is 5-8× slower), and its parser overflows the stack past ~200 kB; the longest golden or gallery result is
 *  far below this (R135's report has the measurements). */
export const MAX_DRAWN_LATEX = 6000;

/** The note drawn in place of a result that is too long (or that MathLive refused): the size of the text it speaks of,
 *  decimal units, one decimal from 1 MB. */
export const tooLongNote = (n: number): string =>
  t("render.tooLong", { size: n < 1e6 ? `${Math.max(1, Math.round(n / 1e3))} kB` : `${(n / 1e6).toFixed(1)} MB` });

/** R135f2: a result with no chip goes on the entry line as drawn; over the cut that is 1.77 MB of LaTeX for MathLive's
 *  parser (it overflowed its stack on Σ cos(k)/k to 2000), so it is not inserted at all. A chip carries its value instead. */
export const tooLongToInsert = (shown: string, hasChip: boolean): boolean => !hasChip && shown.length > MAX_DRAWN_LATEX;

/** The notice for a tap on such a result. */
export const tooLongToInsertNote = (): string => t("render.tooLongInsert");
