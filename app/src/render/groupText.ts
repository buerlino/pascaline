// SPDX-License-Identifier: GPL-3.0-or-later
// R120: R55's digit groups in plain text, for the unit view. A file of its own so it rides in the unit view's lazy chunk,
// not in the start chunk beside groupDigits (render/home.ts), and stays out of the units text ratchet (G88).
import { groupDigits, type GroupSep } from "./home.ts";

/** R125: each separator in plain text: the thin space (U+2009), the apostrophe as MathLive draws it in a row (’), the comma. */
const GROUP_TEXT: Readonly<Record<GroupSep, string>> = { thin: "\u2009", apos: "’", comma: "," };

/** Each number of `s` grouped as a mantissa is (R55), `sep` between the groups (the caller has applied groupSepFor); R125f1:
 *  only the thin space groups the digits after the point. */
export const groupText = (s: string, sep: GroupSep = "thin"): string => s.replace(/\d+(?:\.\d+)?/g, (n) => groupDigits(n, GROUP_TEXT[sep], sep === "thin"));

/** R125: a number as an app's readout draws it (Solve, Function): its text, the decimal comma's `,` included when that
 *  is the mark (R108: elements are then separated by `;`, so a comma between digits is the mark), grouped as Home's row. */
export const groupMarked = (s: string, sep: GroupSep, decimalComma: boolean): string =>
  decimalComma ? s.replace(/\d+(?:,\d+)?/g, (n) => groupDigits(n.replace(",", "."), GROUP_TEXT[sep], sep === "thin").replace(".", ",")) : groupText(s, sep);
