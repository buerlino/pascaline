// SPDX-License-Identifier: GPL-3.0-or-later
// R34 (F30): the entry line survives a kill. Android kills a background app when memory runs short, so on hide the
// line is stored with the view it was typed in and the values of its chips; at start it comes back into that view.
// Enter (and every other clear of the line) clears it, so a computed line never comes back.
// The reader (kept.ts) loads lazily: only this save path is in the start chunk.
import type { ChipTable } from "../input/chips.ts";
import type { Kv } from "../state/storage.ts";

/** The store key (stamped like every other key, state/storage.ts). */
export const LINE_KEY = "entry";

export interface KeptLine {
  view: "home" | "cas";
  latex: string;
  chips: ChipTable;
}

/** What is stored for a line: null when it is empty (nothing to keep). `chips` are the line's own (`entry.chips`). */
export function lineRecord(view: KeptLine["view"], latex: string, chips: ChipTable): KeptLine | null {
  return latex === "" ? null : { view, latex, chips };
}

export interface LineKeeper {
  /** The kept line, if it was typed in `view`. */
  read(view: string): Promise<KeptLine | undefined>;
  /** Store the line, or (null) clear it: the line was emptied (Enter, Esc) and a kill now must not bring it back. */
  save(line: KeptLine | null): void;
}

/** Reads and writes the kept line; writes only when there is something new to store or something stored to clear. */
export function lineKeeper(kv: Kv): LineKeeper {
  let stored = false;
  return {
    async read(view) {
      const x = await kv.get<unknown>(LINE_KEY);
      if (x == null) return undefined;
      stored = true; // a damaged record or another view's line is cleared too, at the next save
      return (await import("./kept.ts")).keptLine(x, view);
    },
    save(line) {
      if (!line && !stored) return;
      stored = line !== null;
      void kv.set(LINE_KEY, line);
    },
  };
}
