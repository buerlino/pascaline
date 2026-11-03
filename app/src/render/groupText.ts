// SPDX-License-Identifier: GPL-3.0-or-later
// R120: R55's digit groups in plain text, for the unit view. A file of its own so it rides in the unit view's lazy chunk,
// not in the start chunk beside groupDigits (render/home.ts), and stays out of the units text ratchet (G88).
import { groupDigits } from "./home.ts";

/** Each number of `s` grouped as a mantissa is (R55), a thin space (U+2009) between the groups. */
export const groupText = (s: string): string => s.replace(/\d+(?:\.\d+)?/g, (n) => groupDigits(n).replace(/\\,/g, "\u2009"));
