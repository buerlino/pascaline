// SPDX-License-Identifier: GPL-3.0-or-later
// Giac's exact text of a result, when it has one. Small enough for the start chunk: the Menu needs it to grey out an item.
import type { Rational } from "../state/displayMode.ts";

export function copyExact(i: { status: string; rational?: Rational; full?: string; fullExact?: boolean }): string | undefined {
  if (i.status !== "done") return undefined;
  if (i.rational) return i.rational.d === "1" ? i.rational.n : `${i.rational.n}/${i.rational.d}`;
  if (i.fullExact && i.full) return i.full;
  return undefined;
}
