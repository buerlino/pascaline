// SPDX-License-Identifier: GPL-3.0-or-later
// G97 (backlog F69): no power of a non-square matrix exists but the first, and Giac answers every one. For a base that
// is a list but not a square matrix, Giac's pow (gen.cc:6880-6886 in the pinned giac-2.1.0) warns "^ is ambiguous on
// non square matrices" and gives v·v to the n/2 for an even integer n, else the power of each element; its inv of a
// list that is not marked as a matrix is elementwise too (usual.cc:357, gen.cc:7706-7708), and a/M is a·inv(M). That is
// Giac's meaning on purpose (the warning says so), so the refusal is ours, read from the operand's shape in Giac, not
// from the text: a part `M^n` (n ≠ 1), `inv(M)` or `a/M` whose M evaluates to a matrix with rows ≠ columns. A flat
// vector ([1,2]^2 = v·v, [5,1]^-1 elementwise) keeps Giac's meaning: it is no matrix.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { type Giac } from "./numeric.ts";
import { functionsIn } from "./giacPrint.ts";
import { CHANGES_STATE } from "./novalue.ts";
import { MAX_NODES, treeOf, UNEVALUATED, type TreeNode } from "./tree.ts";
import type { ParseNode } from "./bridge.ts";

/** What can hold such a part: a power, a division or inv, and a list or a name (a stored matrix, a chip) to be M. */
const OPERATOR = /\^|\/|\binv\s*\(/;
const OPERAND = /\[|\b(?!(?:pi|e|i|euler_gamma|pasdeg|inf|infinity)\b)[A-Za-z_]\w*\b(?!\s*\()/;
/** Time the operands may take, as throughInfinity's walk (novalue.ts): a part costs at most about the whole input. */
const WALK_BUDGET_MS = 500;

/** G101: how deep the walk goes into the bodies of called functions (g calls f: two). */
const MAX_DEPTH = 8;

/** G101: a part's text under the parameters of the body it sits in (`subst(part, x=value)`), or as it is. */
type Bind = (expr: string) => string;

/** G101: a stored function whose body is known, from its tree (bridge-2): the names it binds (its parameters alone
 *  when it is walked), the names it reads, and its heads. */
export interface KnownBody {
  params: readonly string[];
  reads: readonly string[];
  heads: readonly string[];
}

/** G101: the names the input reads (G99, its tree; asked for only when a body could matter), and the stored functions:
 *  a known body, null for a stored function whose body is not known, undefined for a name that is none. */
export interface Bodies {
  reads: () => readonly string[];
  of: (name: string) => KnownBody | null | undefined;
}

export const NO_BODIES: Bodies = { reads: () => [], of: () => undefined };

/** G101: the known bodies the input reads, and those read, by name; `unknown`: the input reads a stored function whose
 *  body is not known. */
function bodiesRead(bodies: Bodies): { known: Map<string, KnownBody>; unknown: boolean } {
  const known = new Map<string, KnownBody>();
  const direct = bodies.reads();
  let unknown = false;
  const seen = new Set<string>();
  const todo = [...direct];
  while (todo.length) {
    const n = todo.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    const k = bodies.of(n);
    if (k === null && direct.includes(n)) unknown = true;
    if (!k) continue;
    known.set(n, k);
    todo.push(...k.reads);
  }
  return { known, unknown };
}

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
 * G101 (F74): a call of a stored function the input reads (`bodies`, G99's reads) whose body is known (it stores
 * nothing, declares no local: the host's table and the function's tree) is walked into, its parameters bound to the
 * call's argument values, and so on through the functions that body reads; any other function keeps the check above.
 * A function the input reads without calling it (`map(L,f)`) is not walked.
 */
export function nonSquarePower(
  giac: Giac,
  input: string,
  output: string,
  ambiguous: boolean | undefined,
  late: () => boolean,
  exactMs: number,
  userFn: (name: string) => boolean,
  bodies: Bodies = NO_BODIES,
): boolean {
  const mayPower = ambiguous !== false;
  const mayInverse = output.includes("[");
  const [powIn, invIn] = [/\^/.test(input), /\/|\binv\s*\(/.test(input)];
  const typed = mayPowerMatrix(input) && ((mayPower && powIn) || (mayInverse && invIn));
  // G101: the input's reads (its tree) when the typed text alone is not enough, or it calls a known stored function
  let read: ReturnType<typeof bodiesRead> | null = null;
  const reached = (): ReturnType<typeof bodiesRead> => (read ??= bodiesRead(bodies));
  const callsKnown = !typed || functionsIn(input).some((n) => !!bodies.of(n));
  const inBodies = (...heads: string[]): boolean =>
    callsKnown && [...reached().known.values()].some((k) => heads.some((h) => k.heads.includes(h)));
  // G101f1: a known body's heads count also when the typed text has an operator of its own (w(A)+inv(B), w(M):=M^2);
  // bridge-2's tree writes both a/b and inv(M) as the head "/" (inv(M) is stored as 1/M), so either head is a division
  const powers = mayPower && (powIn || inBodies("^"));
  const inverses = mayInverse && (invIn || inBodies("/", "inv"));
  if (!(powers || inverses) || !(typed || reached().known.size > 0)) return false;
  // G101: a call's arguments are evaluated once more to bind the body: not when the input stores, or reads a function
  // of the user's whose body is not known (the known bodies store nothing, nor do the functions they read)
  const stores = (t: string): boolean => CHANGES_STATE.test(t.replace(/"[^"]*"/g, ""));
  const inline = (): boolean => !stores(input) && !reached().unknown;
  const temps = ["pasq", "pasnb"];
  const t0 = performance.now();
  // the walk stops (nothing found) before an evaluation that could take it past WALK_BUDGET_MS, at `exactMs` each
  const overBudget = (): boolean => late() || performance.now() - t0 + exactMs > WALK_BUDGET_MS;
  try {
    const candidates: { part: string; operand: string; power: boolean; bind: Bind }[] = [];
    let nodes = 0;
    // G103: each tree (the input's, a body's) in one call (tree.ts), walked here: a power, a division or inv is a
    // candidate, a call of a known stored function is walked into
    const shape = (root: string, raw: ParseNode | null | undefined, bind: Bind, depth: number): boolean => {
      if (late()) return false;
      const tree = treeOf(raw, root);
      if (!tree) return false;
      const visit = (t: TreeNode): boolean => {
        if (++nodes > MAX_NODES) return false;
        if (t.kind === 0 || UNEVALUATED.has(t.head)) return true;
        const p = t.path;
        const op = t.head;
        // An operand that is a number literal is no matrix (the 3 of 1/3): not evaluated.
        const literal = (k: number): boolean => t.children.length === (op === "inv" ? 1 : 2) && t.children[k]!.number;
        if (t.kind === 1 && op === "^" && powers) {
          if (!literal(0)) candidates.push({ part: p, operand: `[op(${p})][0]`, power: true, bind });
        } else if (t.kind === 1 && op === "/" && inverses) {
          if (!literal(1)) candidates.push({ part: p, operand: `[op(${p})][1]`, power: false, bind });
        }
        // inv's argument is its whole feuille: op() of inv(M) would be M's rows.
        else if (t.kind === 1 && op === "inv" && inverses) {
          if (!literal(0)) candidates.push({ part: p, operand: `feuille(${p})`, power: false, bind });
        }
        else if (t.kind === 1 && op === "of" && depth < MAX_DEPTH && !into(p, bind, depth)) return false;
        return t.children.every(visit);
      };
      return visit(tree);
    };
    // G101: the call `p` of a known stored function: its body walked with its parameters (from the function's tree)
    // bound to the argument values (evaluated once, under the caller's binding). Walked only when the function's
    // parameters, in Giac, are the names its tree binds, so a local, a loop variable or a quoting command's variable
    // (each read in global scope here) is never in the body walked. False: the walk is out of nodes or time.
    const into = (p: string, bind: Bind, depth: number): boolean => {
      if (!inline()) return true;
      if (++nodes > MAX_NODES || late()) return false;
      const known = [...reached().known].filter(([, k]) => k.params.length > 0);
      if (!known.length) return true;
      const argv = `when(subtype([op(${p})][1])==1,[op(${p})][1],[[op(${p})][1]])`;
      let pick = "0";
      for (let i = known.length - 1; i >= 0; i--) {
        const [name, k] = known[i]!;
        const test = `string([op(${p})][0])=="${name}" and size(${argv})==${k.params.length} and [[op(${name})][0]]==quote([${k.params.join(",")}])`;
        pick = `when(${test},${i + 1},${pick})`;
      }
      const i = Number(giac.eval(pick).trim()) - 1;
      if (!(i >= 0 && i < known.length)) return true;
      const [name, k] = known[i]!;
      if (overBudget()) return false;
      const n = k.params.length;
      const j = temps.length;
      temps.push(`pasnf${j}`, `pasne${j}`);
      const eqs = k.params.map((x, a) => `quote(${x})=eval(${bind(n === 1 ? `[op(${p})][1]` : `[op(${p})][1][${a}]`)})`);
      // G103: the body as Giac stores it (inv(M) prints as 1/M), with its tree from bridge-3 in the same call
      const body = giac.value(`pasnf${j}:=[op(${name})][2]`, [], true).tree;
      giac.eval(`pasne${j}:=[${eqs.join(",")}]`);
      return shape(`pasnf${j}`, body, (e) => `subst(${e},pasne${j})`, depth + 1);
    };
    // G103: the quoted input stored in pasq, with its tree from bridge-3 in the same call
    if (!shape("pasq", giac.value(`pasq:=quote(${input})`, [], true).tree, (e) => e, 0)) return false;
    for (const c of candidates) {
      if (overBudget()) return false;
      const text = giac.eval(`string(${c.part})`);
      if (stores(text) || functionsIn(text).some(userFn)) continue;
      const first = c.power ? `when(eval(${c.bind(`[op(${c.part})][1]`)})==1,0,1)` : "1";
      const hit = giac.eval(`when(is_matrix(pasnb:=eval(${c.bind(c.operand)})) and rowdim(pasnb)!=coldim(pasnb),${first},0)`).trim();
      if (hit === "1") return true;
    }
    return false;
  } finally {
    giac.eval(`purge(${temps.join(",")})`);
  }
}
