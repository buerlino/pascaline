// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Counters › Export the counts (R127): the press counts (state/taps.svelte.ts, `exportText`) as one JSON file
// through the file port, for the user's own AI or study. Loaded only on the press (never in the start chunk). The same
// text is what R128 writes into the sync folder as counters.json.
import { dataText } from "../i18n/enData.ts";

/** `pascaline-counts-YYYY-MM-DD.json`, by the local date. */
export function countsName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `pascaline-counts-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Hands the text to the file port and returns the notice to show. Never throws. */
export async function saveCounts(text: string, now: Date = new Date()): Promise<string> {
  try {
    const { saveFile } = await import("../clipboard/files.ts");
    const result = await saveFile(countsName(now), "application/json", text);
    const notice = { saved: "counts.saved", offered: "counts.offered", cancelled: "counts.cancelled", failed: "counts.failed" } as const;
    return dataText(notice[result]);
  } catch {
    return dataText("counts.failed");
  }
}
