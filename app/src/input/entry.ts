// SPDX-License-Identifier: GPL-3.0-or-later
// The one place that holds the per-view options of an entry's LaTeX → Giac step (G98, hind-2): the session and the
// golden runner both call it, so the gate checks the input the app sends.
import { latexToGiacInfo, type LatexToGiacOptions } from "./latex-to-giac.ts";

export type EntryView = "home" | "cas";

type EntryResult = ReturnType<typeof latexToGiacInfo>;

/** The Giac text of an entry in `view`. Home sends a chip that is not exact by name (`pasr_<k>`, R65/G49); a power keeps
 *  Giac's principal root in both views (R66). `o` carries what is not per view: the entry's chips and the user's functions. */
export function giacOfEntry(latex: string, view: EntryView, o: Pick<LatexToGiacOptions, "chips" | "userFunctions"> = {}): EntryResult {
  return latexToGiacInfo(latex, { ...o, ...(view === "home" ? { chipNames: true } : {}) });
}
