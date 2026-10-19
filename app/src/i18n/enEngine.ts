// SPDX-License-Identifier: GPL-3.0-or-later
// G39: the messages the engine side gives with a refusal (engine/converge.ts) and a why-line (format.ts PrecisionWhy).
// A table of its own, so the engine worker carries these few lines and not the app's whole table; en.ts includes it.
// English only so far.
export const enEngine = {
  "error.integralDiverges": "The integral does not converge",
  "error.seriesDiverges": "The series does not converge",
  "error.noLimit": "No limit",
  "why.pairDiffers": "The exact and numeric answers differ",
} as const;
