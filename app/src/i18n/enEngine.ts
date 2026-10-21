// SPDX-License-Identifier: GPL-3.0-or-later
// G39: the messages the engine side gives with a refusal (engine/converge.ts; G78 engine/novalue.ts; G58 the time-out, engine/homeEval.ts) and a why-line (format.ts PrecisionWhy).
// A table of its own, so the engine worker carries these few lines and not the app's whole table; en.ts includes it.
// English only so far.
export const enEngine = {
  "error.integralDiverges": "The integral does not converge",
  "error.seriesDiverges": "The series does not converge",
  "error.noLimit": "No limit",
  "error.timeout": "Stopped: it took too long",
  "error.divisionByZero": "Division by zero",
  "error.overflow": "Overflow: the number is too large",
  "error.underflow": "Underflow: the number is too small",
  "error.noValue": "No value found",
  "error.notSquare": "The matrix is not square",
  "error.undecided": "undecided: the value sits on a cut Giac cannot decide",
  "why.pairDiffers": "The exact and numeric answers differ",
} as const;
