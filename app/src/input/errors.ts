// SPDX-License-Identifier: GPL-3.0-or-later
// The error the parser and the emitters throw for input they cannot turn into maths. Kept apart from emit.ts so
// the start chunk can recognise it without loading the parser chunk (decisions M4-3).
export class SerializeError extends Error {}
