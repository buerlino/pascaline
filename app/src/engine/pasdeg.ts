// SPDX-License-Identifier: GPL-3.0-or-later
// The degree factor's name alone (R103): the session reads it at start, and engine/angles.ts (the rewrite tables, with
// engine/giacPrint.ts) stays off the start chunk.

/** The engine name that holds the degree factor. Reserved: the parser and the library refuse it as a user name. */
export const PASDEG = "pasdeg";
