// SPDX-License-Identifier: GPL-3.0-or-later
// R135 (F71): a LaTeX too long for MathLive to draw in a frame is not drawn, and never shown as source: a short note
// says so (Copy holds the whole text). Pure module: no MathLive, so the start chunk pays nothing for it.
import { t } from "../i18n/index.ts";

/** The longest LaTeX the app draws. MathLive's SSR build takes about 36 ms for 4 kB, 55 ms for 6 kB and 118 ms for 16 kB on the desktop
 *  (the Tab One is 5-8× slower), and its parser overflows the stack past ~200 kB; the longest golden or gallery result is
 *  far below this (R135's report has the measurements). */
export const MAX_DRAWN_LATEX = 6000;

export const tooLongToDraw = (latex: string): boolean => latex.length > MAX_DRAWN_LATEX;

/** "1.7 MB", "12 kB": the size of the text the note speaks of (decimal units, one decimal from 1 MB). */
export function sizeText(chars: number): string {
  if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(chars / 1000))} kB`;
}

/** The note drawn in place of a result that is too long (or that MathLive refused). */
export const tooLongNote = (chars: number): string => t("render.tooLong", { size: sizeText(chars) });
