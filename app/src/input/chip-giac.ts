// SPDX-License-Identifier: GPL-3.0-or-later
// A chip's value as Giac text (docs/04 section 2.8). Part of the parser chunk: only the parser needs it.
import { parseError } from "../i18n/enParser.ts";
import { equalityTest } from "./emit.ts";
import { ANS_KEY } from "./chips.ts";

/** The prefix of a result chip sent by name (G49's `pasr_<k>`, engine/chipFacts.ts; kept equal there). */
const CHIP_PREFIX = "pasr_";

/**
 * The Giac name of a result chip that is not exact (R65, deep check D1): `pasr_<k>` for `\res{k}`, `pasr_ans` for Ans.
 * The engine gives it the chip's value for the run and lends the result its facts (confirmed digits, warn), as a stored
 * float's (decisions M4-7). The table key the engine takes is the part after the prefix. Undefined: not a result chip.
 */
export function chipName(key: string): string | undefined {
  if (key === ANS_KEY) return `${CHIP_PREFIX}ans`;
  const m = /^res:(\d+)$/.exec(key);
  return m ? `${CHIP_PREFIX}${m[1]}` : undefined;
}

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * The Giac text for a chip value, in brackets so it stays one factor. A decimal becomes an exact rational
 * literal (docs/04 2.8: the digits the chip carries, not a float), so `1/3` carried as 40 digits stays 40 digits
 * in CAS too. Anything else is the engine's own exact text. Values never hold a statement (`;`, `:=`).
 * Each == or ≠ test the rule left as typed in a value (`((x*y)==2)`, `[(x<>2),1]`) is sent as the value test again
 * (emit.ts equalityTest), never as Giac's own `==`, which compares the expressions (R18f3, F35; valueTests below).
 */
export function chipToGiac(value: string): string {
  const v = value.trim();
  if (v === "" || /;|:=/.test(v)) throw parseError("parse.chipValueIs");
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
  if (hasTest(v)) return `(${valueTests(v)})`;
  return `(${v})`;
}

const hasTest = (s: string): boolean => /==|<>|!=/.test(s);
const OPEN = "([{";
const CLOSE = ")]}";
/** A piece of text outside every bracket (`top`), or a whole bracket group, already rewritten. */
interface Part {
  text: string;
  top: boolean;
}

/**
 * Every open == or ≠ test in `v` (Giac's text) as the value test (emit.ts equalityTest). Giac prints an == test in
 * its own brackets, `((x*y)==2)`, and a ≠ test bare, `(x*y)<>2`, between commas or brackets; the operands of
 * `and`, `or` and `not` are bracketed (probe 2026-10-15: `[((x*y)==2),1]`, `((x<>2) and ((y==3)))`). So each
 * comma-separated piece of each bracket group holds at most one test, with nothing looser beside it. Anything else
 * (a test beside another relation, a string) cannot be carried as typed and is refused.
 */
function valueTests(v: string): string {
  if (v.includes('"')) throw parseError("parse.chipValueHolds");
  let i = 0;
  const group = (close: string): string => {
    const pieces: string[] = [];
    let parts: Part[] = [];
    let run = "";
    const flush = (): void => {
      if (run) parts.push({ text: run, top: true });
      run = "";
    };
    const endPiece = (): void => {
      flush();
      pieces.push(piece(parts));
      parts = [];
    };
    while (i < v.length) {
      const c = v.charAt(i++);
      const k = OPEN.indexOf(c);
      if (k >= 0) {
        flush();
        const inner = group(CLOSE.charAt(k));
        parts.push({ text: `${c}${inner}${CLOSE.charAt(k)}`, top: false });
      } else if (c === close) {
        endPiece();
        return pieces.join(",");
      } else if (CLOSE.includes(c)) throw parseError("parse.chipValueHas");
      else if (c === ",") endPiece();
      else run += c;
    }
    if (close !== "") throw parseError("parse.chipValueHas");
    endPiece();
    return pieces.join(",");
  };
  return group("");
}

/** One comma-separated piece: the value test when a test stands at its top level, else the piece as it is. */
function piece(parts: Part[]): string {
  const at = parts.flatMap((p, k) => (p.top ? [...p.text.matchAll(/==|<>|!=/g)].map((m) => ({ k, i: m.index, rel: m[0] })) : []));
  if (at.length === 0) return parts.map((p) => p.text).join("");
  if (at.length > 1) throw parseError("parse.chipValueHolds2");
  const { k, i, rel } = at[0]!;
  const split = parts[k]!.text;
  const before = [...parts.slice(0, k).map((p) => p.text), split.slice(0, i)];
  const after = [split.slice(i + 2), ...parts.slice(k + 1).map((p) => p.text)];
  const rest = [...parts.filter((p, n) => p.top && n !== k).map((p) => p.text), split.slice(0, i), split.slice(i + 2)].join(" ");
  if (/[=<>!]|\b(and|or|xor|not)\b/.test(rest)) throw parseError("parse.chipValueHolds3");
  const a = before.join("").trim();
  const b = after.join("").trim();
  if (!a || !b) throw parseError("parse.chipValueHolds4");
  return equalityTest({ s: `(${a})`, p: 5 }, { s: `(${b})`, p: 5 }, rel !== "==").s;
}
