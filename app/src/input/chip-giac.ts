// SPDX-License-Identifier: GPL-3.0-or-later
// A chip's value as Giac text (docs/04 section 2.8). Part of the parser chunk: only the parser needs it.
import { SerializeError } from "./errors.ts";

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * The Giac text for a chip value, in brackets so it stays one factor. A decimal becomes an exact rational
 * literal (docs/04 2.8: the digits the chip carries, not a float), so `1/3` carried as 40 digits stays 40 digits
 * in CAS too. Anything else is the engine's own exact text. Values never hold a statement (`;`, `:=`).
 */
export function chipToGiac(value: string): string {
  const v = value.trim();
  if (v === "" || /;|:=/.test(v)) throw new SerializeError("chip value is not a number or expression");
  const m = DECIMAL.exec(v);
  if (m && ((m[2] ?? "") !== "" || (m[3] ?? "") !== "")) {
    const sign = m[1] === "-" ? "-" : "";
    const frac = m[3] ?? "";
    const digits = `${m[2] ?? ""}${frac}`.replace(/^0+(?=\d)/, "");
    const exp = Number(m[4] ?? "0") - frac.length;
    if (digits === "0") return "0";
    if (exp === 0) return `(${sign}${digits})`;
    return exp > 0 ? `(${sign}${digits}*10^${exp})` : `(${sign}${digits}/10^${-exp})`;
  }
  return `(${v})`;
}
