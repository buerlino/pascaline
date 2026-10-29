// SPDX-License-Identifier: GPL-3.0-or-later
// G130 (backlog F125): Giac's matrix subtype (11: matrix(2,3), zeros, idn, tran, a matrix times one) prints `matrix[…]`,
// engine text Home and CAS do not show (docs/04: never raw engine text). A `[[…]]` vector is the same matrix to Giac (its
// arithmetic gives the subtype back), so the answer's slot is rewritten as plain rows, each row plain too
// (matrix({{1,2},{3,4}}) keeps rows of the list type, `matrix[list[1,2],list[3,4]]`); the elements stay as they are.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import type { GiacValue } from "./bridge.ts";
import type { Giac } from "./numeric.ts";

/** How Giac prints a value of its matrix subtype. */
export const MATRIX_TYPE = "matrix[";

export function matrixTyped(text: string): boolean {
  return text.startsWith(MATRIX_TYPE);
}

/** Giac text of the matrix `slot` holds as plain rows. */
function rowsOf(slot: string): string {
  return `apply(pasrow->[op(pasrow)],[op(${slot})])`;
}

const failed = (text: string): boolean => text.startsWith("GIAC_ERROR");

/** Home: `v`, the value `slot` holds, stored back as plain rows (one bridge-3 call, `at` as the caller asks, in the
 *  caller's Digits); `v` itself when it is no matrix type or Giac fails. */
export function plainRows(giac: Giac, slot: string, v: GiacValue, at: readonly number[]): GiacValue {
  if (!matrixTyped(v.text)) return v;
  const rows = giac.value(`${slot}:=${rowsOf(slot)}`, at);
  return failed(rows.text) ? v : rows;
}

/** CAS: Giac's print of `slot` stored back as plain rows (one call); `text` itself when it is no matrix type or Giac fails. */
export function plainRowsText(giac: { eval(text: string): string }, slot: string, text: string): string {
  if (!matrixTyped(text)) return text;
  const rows = giac.eval(`${slot}:=${rowsOf(slot)}`);
  return failed(rows) ? text : rows;
}
