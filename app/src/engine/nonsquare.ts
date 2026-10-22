// SPDX-License-Identifier: GPL-3.0-or-later
// G97 (backlog F69): no power of a non-square matrix exists but the first, and Giac answers every one. For a base that
// is a list but not a square matrix, Giac's pow (gen.cc:6880-6886 in the pinned giac-2.1.0) warns "^ is ambiguous on
// non square matrices" and gives v·v to the n/2 for an even integer n, else the power of each element; its inv of a
// list that is not marked as a matrix is elementwise too (usual.cc:357, gen.cc:7706-7708), and a/M is a·inv(M). That is
// Giac's meaning on purpose (the warning says so), so the refusal is ours, read from the operand's shape in Giac, not
// from the text: a part `M^n` (n ≠ 1), `inv(M)` or `a/M` whose M evaluates to a matrix with rows ≠ columns. A flat
// vector ([1,2]^2 = v·v, [5,1]^-1 elementwise) keeps Giac's meaning: it is no matrix.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { functionsIn, type Giac } from "./numeric.ts";
import { CHANGES_STATE, UNEVALUATED } from "./novalue.ts";

/** What can hold such a part: a power, a division or inv, and a list or a name (a stored matrix, a chip) to be M. */
const OPERATOR = /\^|\/|\binv\s*\(/;
const OPERAND = /\[|\b(?!(?:pi|e|i|euler_gamma|pasdeg|inf|infinity)\b)[A-Za-z_]\w*\b(?!\s*\()/;
/** Most parts looked at; a larger input is not checked (its result stands). */
const MAX_NODES = 200;
/** Time the operands may take, as throughInfinity's walk (novalue.ts): a part costs at most about the whole input. */
const WALK_BUDGET_MS = 500;

/** Cheap text test: could `input` hold a power, inverse or division of a matrix? */
export function mayPowerMatrix(input: string): boolean {
  const t = input.replace(/"[^"]*"/g, "");
  return OPERATOR.test(t) && OPERAND.test(t);
}

/**
 * F69: `input` (decimals exact), whose result is `output`, holds a part `M^n` with n ≠ 1, `inv(M)` or `a/M` whose M
 * evaluates to a matrix that is not square. Looked for only where Giac says it may be there: a power when the run
 * printed Giac's warning for a list base (`ambiguous`; undefined = not known, looked for), an inverse or a division
 * when the result holds a list (each is elementwise; a·inv(M) of a non-square M is a list). Then one engine call per
 * part for the shape (no evaluation), and two per candidate operand; a candidate whose text changes state
 * (CHANGES_STATE) or calls a function `userFn` names is not evaluated again, and the walk stops (nothing found) before
 * a part that could take it past WALK_BUDGET_MS, at `exactMs` per part, or once `late()`.
 */
export function nonSquarePower(
  giac: Giac,
  input: string,
  output: string,
  ambiguous: boolean | undefined,
  late: () => boolean,
  exactMs: number,
  userFn: (name: string) => boolean,
): boolean {
  const powers = ambiguous !== false && /\^/.test(input);
  const inverses = output.includes("[") && /\/|\binv\s*\(/.test(input);
  if (!(powers || inverses) || !mayPowerMatrix(input)) return false;
  if (giac.eval(`pasq:=quote(${input})`).startsWith("GIAC_ERROR")) return false;
  try {
    const candidates: { part: string; operand: string; power: boolean }[] = [];
    let nodes = 0;
    const shape = (p: string): boolean => {
      if (++nodes > MAX_NODES || late()) return false;
      const m = /^\[([12]),"'?(.*?)'?",(\d+)\]$/.exec(
        giac.eval(`when(type(${p})==DOM_SYMBOLIC,[1,string(sommet(${p})),size([op(${p})])],when(type(${p})==DOM_LIST,[2,"",size(${p})],[0]))`).replace(/\s/g, ""),
      );
      if (!m) return true;
      const op = m[2]!;
      if (UNEVALUATED.has(op)) return true;
      if (m[1] === "1" && op === "^" && powers) candidates.push({ part: p, operand: `[op(${p})][0]`, power: true });
      else if (m[1] === "1" && op === "/" && inverses) candidates.push({ part: p, operand: `[op(${p})][1]`, power: false });
      // inv's argument is its whole feuille: op() of inv(M) would be M's rows.
      else if (m[1] === "1" && op === "inv" && inverses) candidates.push({ part: p, operand: `feuille(${p})`, power: false });
      for (let k = 0; k < Number(m[3]); k++) if (!shape(`[op(${p})][${k}]`)) return false;
      return true;
    };
    if (!shape("pasq")) return false;
    const t0 = performance.now();
    for (const c of candidates) {
      if (late() || performance.now() - t0 + exactMs > WALK_BUDGET_MS) return false;
      const text = giac.eval(`string(${c.part})`);
      if (CHANGES_STATE.test(text.replace(/"[^"]*"/g, "")) || functionsIn(text).some(userFn)) continue;
      const first = c.power ? `when(eval([op(${c.part})][1])==1,0,1)` : "1";
      const hit = giac.eval(`when(is_matrix(pasnb:=eval(${c.operand})) and rowdim(pasnb)!=coldim(pasnb),${first},0)`).trim();
      if (hit === "1") return true;
    }
    return false;
  } finally {
    giac.eval("purge(pasq,pasnb)");
  }
}
