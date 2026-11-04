// SPDX-License-Identifier: GPL-3.0-or-later
// R125: the digit groups of Solve's and Function's readouts, with the separator of Settings › Numbers › Digit groups.
// Drawn text only: Copy, the entry line, the stored values and the cells' data-text stay plain.
import { groupSepFor } from "../render/home.ts";
import { groupMarked } from "../render/groupText.ts";
import type { AppHost } from "./types.ts";

/** A readout's text (already with the decimal comma when that is the mark) in groups, as Home's row draws them. */
export function drawnGroups(text: string, settings: AppHost["settings"]): string {
  const comma = settings.decimalMark === "comma";
  return groupMarked(text, groupSepFor(settings.groupSep, comma), comma);
}
