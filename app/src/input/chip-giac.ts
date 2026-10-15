// SPDX-License-Identifier: GPL-3.0-or-later
// A chip's value as Giac text (docs/04 section 2.8). Part of the parser chunk: only the parser needs it.
import { SerializeError } from "./errors.ts";
import { equalityTest } from "./emit.ts";

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * The Giac text for a chip value, in brackets so it stays one factor. A decimal becomes an exact rational
 * literal (docs/04 2.8: the digits the chip carries, not a float), so `1/3` carried as 40 digits stays 40 digits
 * in CAS too. Anything else is the engine's own exact text. Values never hold a statement (`;`, `:=`).
 * A value that is an == or ≠ test the rule left as typed (`((x*y)==2)`, `x<>2`) is sent as the value test again
 * (emit.ts equalityTest), never as Giac's own `==`, which compares the expressions (R18f3, F35). A value with a test
 * deeper inside it (a list, an `and`) cannot be carried that way and is refused.
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
  const t = testSides(v);
  if (t) {
    if ([t.a, t.b].some(hasTest)) throw new SerializeError("chip value holds a test inside a test");
    return equalityTest({ s: `(${t.a})`, p: 5 }, { s: `(${t.b})`, p: 5 }, t.negate).s;
  }
  if (hasTest(v)) throw new SerializeError("chip value holds a test that stays as typed");
  return `(${v})`;
}

const hasTest = (s: string): boolean => s.includes("==") || s.includes("<>");

/** Where `rel` stands outside every bracket of `s`, when it does so exactly once; else -1. */
function topLevel(s: string, rel: string): number {
  let depth = 0;
  let found = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && s.startsWith(rel, i)) {
      if (found >= 0) return -1;
      found = i;
      i += rel.length - 1;
    }
  }
  return found;
}

/** Brackets that pair up and never close below depth 0. */
function balanced(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth < 0) return false;
  }
  return depth === 0;
}

/** The sides of an open test as Giac prints it: `((a)==(b))` or `(x==2)` for ==, `(a)<>(b)` or `x<>2` for ≠; else null. */
function testSides(v: string): { a: string; b: string; negate: boolean } | null {
  const inner = v.startsWith("(") && v.endsWith(")") && balanced(v.slice(1, -1)) ? v.slice(1, -1) : null;
  const eq = inner === null ? -1 : topLevel(inner, "==");
  if (inner !== null && eq >= 0) return { a: inner.slice(0, eq), b: inner.slice(eq + 2), negate: false };
  const ne = topLevel(v, "<>");
  return ne >= 0 ? { a: v.slice(0, ne), b: v.slice(ne + 2), negate: true } : null;
}
