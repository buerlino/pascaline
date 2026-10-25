// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the census's inputs. For every Find tier-1 function, the first example of Giac's help (doc/aide_cas) that calls it as one
// whole line and whose arguments the keys can type, written as keyboard LaTeX (the Find insert `\operatorname{name}\left(…\right)`
// with its arguments filled in) and, for the oracle, as a Python expression over mpmath. When every argument is a number, the last
// one is also tried as the other number kinds (an integer, a decimal, a negative, a list). Pure: no engine, no file system.

/** One census input of an entry: `k` 0 is the help's example, 1… its number variants. */
export interface Sample {
  /** The Find entry's name (its id without `fn:`). */
  name: string;
  k: number;
  latex: string;
  /** The arguments as Python expressions over oracle.py's names, or null when one is not a number the oracle can read. */
  py: string[] | null;
  /** The argument kind that differs from the example (k ≥ 1). */
  kind?: ArgKind;
}

export type ArgKind = "integer" | "decimal" | "negative" | "list";

/** Giac's help, `# name …` blocks: every name of a block with the block's example lines (lines that are not a numbered text line). */
export function helpExamples(aide: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let cur: string[] | null = null;
  for (const line of aide.split("\n")) {
    if (line.startsWith("# ")) {
      cur = [];
      for (const n of line.slice(2).trim().split(/\s+/)) if (!out.has(n)) out.set(n, cur);
    } else if (!cur || line.trim() === "" || /^-?\d+ /.test(line)) continue;
    else cur.push(line.trim());
  }
  return out;
}

// --- Giac argument text → a tree ----------------------------------------------------------------------------------------

type Node =
  | { t: "num"; v: string }
  | { t: "id"; v: string }
  | { t: "call"; f: string; args: Node[] }
  | { t: "list"; items: Node[] }
  | { t: "neg"; a: Node }
  | { t: "fact"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node };

class Unsupported extends Error {}

const TOKEN = /\s*(\d+\.\d*|\.\d+|\d+|[A-Za-z_][A-Za-z0-9_]*|<=|>=|!=|==|[-+*/^!()[\],=<>])/y;

function tokens(s: string): string[] {
  const out: string[] = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  while (at < s.length) {
    if (/^\s*$/.test(s.slice(at))) break;
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(s);
    if (!m) throw new Unsupported(`character ${JSON.stringify(s[at])}`);
    out.push(m[1]!);
    at = TOKEN.lastIndex;
  }
  // a float exponent (1e-3) or a number glued to a name (2x) is not in the help's call forms we read
  for (let i = 0; i + 1 < out.length; i++) if (/^[\d.]/.test(out[i]!) && /^[A-Za-z_]/.test(out[i + 1]!)) throw new Unsupported("number glued to a name");
  return out;
}

const REL = new Set(["=", "<", ">", "<=", ">=", "!="]);

function parseArgs(text: string): Node[] {
  const tk = tokens(text);
  let i = 0;
  const peek = (): string | undefined => tk[i];
  const eat = (t: string): void => {
    if (tk[i] !== t) throw new Unsupported(`expected ${t}`);
    i++;
  };
  const list = (close: string): Node[] => {
    const items: Node[] = [];
    if (peek() === close) return items;
    for (;;) {
      items.push(expr());
      if (peek() !== ",") return items;
      i++;
    }
  };
  const primary = (): Node => {
    const t = tk[i++];
    if (t === undefined) throw new Unsupported("end of text");
    if (/^[\d.]/.test(t)) return { t: "num", v: t };
    if (t === "(") {
      const e = expr();
      eat(")");
      return e;
    }
    if (t === "[") {
      const items = list("]");
      eat("]");
      return { t: "list", items };
    }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === "(") {
        i++;
        const args = list(")");
        eat(")");
        return { t: "call", f: t, args };
      }
      return { t: "id", v: t };
    }
    throw new Unsupported(`token ${t}`);
  };
  const postfix = (): Node => {
    let a = primary();
    while (peek() === "!") {
      i++;
      a = { t: "fact", a };
    }
    return a;
  };
  const unary = (): Node => {
    if (peek() === "-") {
      i++;
      return { t: "neg", a: unary() };
    }
    if (peek() === "+") {
      i++;
      return unary();
    }
    return pow();
  };
  const pow = (): Node => {
    const a = postfix();
    if (peek() !== "^") return a;
    i++;
    return { t: "bin", op: "^", a, b: unary() };
  };
  const mul = (): Node => {
    let a = unary();
    while (peek() === "*" || peek() === "/") a = { t: "bin", op: tk[i++]!, a, b: unary() };
    return a;
  };
  const add = (): Node => {
    let a = mul();
    while (peek() === "+" || peek() === "-") a = { t: "bin", op: tk[i++]!, a, b: mul() };
    return a;
  };
  const expr = (): Node => {
    const a = add();
    if (peek() !== undefined && REL.has(peek()!)) {
      const op = tk[i++]!;
      return { t: "bin", op, a, b: add() };
    }
    return a;
  };
  const args = list("\u0000");
  if (i !== tk.length) throw new Unsupported(`text after the arguments: ${tk.slice(i).join("")}`);
  return args;
}

// --- a tree → keyboard LaTeX ---------------------------------------------------------------------------------------------

/** The keys' names for Giac's functions (log is ln in Giac; the ln key writes \ln, the log key log10). */
const LATEX_FN: Readonly<Record<string, string>> = {
  sin: "\\sin", cos: "\\cos", tan: "\\tan", asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan",
  sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh", ln: "\\ln", log: "\\ln", exp: "\\exp", log10: "\\log",
};
const PREC: Readonly<Record<string, number>> = { "=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "!=": 1, "+": 2, "-": 2, "*": 3, "/": 3, "^": 5 };
const RELTEX: Readonly<Record<string, string>> = { "=": "=", "<": "<", ">": ">", "<=": "\\le ", ">=": "\\ge ", "!=": "\\ne " };

export const latexName = (n: string): string => n.replace(/_/g, "\\_");
const op = (n: string, inner: string): string => `\\operatorname{${latexName(n)}}\\left(${inner}\\right)`;

function prec(n: Node): number {
  if (n.t === "bin") return n.op === "/" ? 7 : PREC[n.op]!; // \frac is a closed form
  if (n.t === "neg") return 2.5;
  if (n.t === "fact") return 6;
  return 7;
}

function wrap(n: Node, min: number): string {
  const s = tex(n);
  return prec(n) < min ? `\\left(${s}\\right)` : s;
}

function tex(n: Node): string {
  switch (n.t) {
    case "num":
      return n.v.startsWith(".") ? `0${n.v}` : n.v.endsWith(".") ? `${n.v}0` : n.v;
    case "id":
      if (n.v === "pi") return "\\pi";
      if (n.v === "inf" || n.v === "infinity") return "\\infty";
      if (/^[A-Za-z]$/.test(n.v)) return n.v;
      throw new Unsupported(`name ${n.v}`);
    case "call": {
      const args = n.args.map(tex).join(",");
      if (n.f === "sqrt" && n.args.length === 1) return `\\sqrt{${args}}`;
      if (LATEX_FN[n.f] && n.args.length === 1) return `${LATEX_FN[n.f]}\\left(${args}\\right)`;
      if (n.f.length < 2) throw new Unsupported(`one-letter function ${n.f}`);
      return op(n.f, args);
    }
    case "list": {
      if (!n.items.length) throw new Unsupported("empty list");
      const rows = n.items.every((r) => r.t === "list" && r.items.length > 0 && r.items.length === (n.items[0] as { items: Node[] }).items.length && r.items.every((c) => c.t !== "list"));
      if (rows) return `\\begin{pmatrix}${n.items.map((r) => (r as { items: Node[] }).items.map(tex).join("&")).join("\\\\")}\\end{pmatrix}`;
      return `\\left\\{${n.items.map(tex).join(",")}\\right\\}`;
    }
    case "neg":
      return `-${wrap(n.a, 3)}`;
    case "fact":
      return `${wrap(n.a, 7)}!`;
    case "bin": {
      if (n.op === "/") return `\\frac{${tex(n.a)}}{${tex(n.b)}}`;
      if (n.op === "^") return `${n.a.t === "bin" && n.a.op === "/" ? `\\left(${tex(n.a)}\\right)` : wrap(n.a, 6)}^{${tex(n.b)}}`;
      const p = PREC[n.op]!;
      if (p === 1) return `${wrap(n.a, 2)}${RELTEX[n.op]}${wrap(n.b, 2)}`;
      const right = wrap(n.b, n.op === "+" ? 2.6 : p + 1);
      return `${wrap(n.a, p)}${n.op === "*" ? "\\cdot " : n.op}${right}`;
    }
  }
}

// --- a tree → a Python expression for oracle.py --------------------------------------------------------------------------

const PY_FN: Readonly<Record<string, string>> = { sqrt: "sqrt", exp: "exp", ln: "log", log: "log", sin: "sin", cos: "cos", tan: "tan" };

function py(n: Node): string {
  switch (n.t) {
    case "num":
      return `N('${n.v.startsWith(".") ? `0${n.v}` : n.v}')`;
    case "id":
      if (n.v === "pi") return "pi";
      if (n.v === "e") return "e";
      if (n.v === "i") return "mpc(0,1)";
      throw new Unsupported("symbol");
    case "call":
      if (!PY_FN[n.f] || n.args.length !== 1) throw new Unsupported("call");
      return `${PY_FN[n.f]}(${py(n.args[0]!)})`;
    case "list":
      return `[${n.items.map(py).join(",")}]`;
    case "neg":
      return `(-${py(n.a)})`;
    case "fact":
      return `factorial(${py(n.a)})`;
    case "bin":
      if (PREC[n.op] === 1) throw new Unsupported("relation");
      return `(${py(n.a)}${n.op === "^" ? "**" : n.op}${py(n.b)})`;
  }
}

function pyArgs(args: Node[]): string[] | null {
  try {
    return args.map(py);
  } catch (e) {
    if (e instanceof Unsupported) return null;
    throw e;
  }
}

// --- samples ------------------------------------------------------------------------------------------------------------

const kindOf = (n: Node): ArgKind | null =>
  n.t === "num" ? (n.v.includes(".") ? "decimal" : "integer") : n.t === "neg" && n.a.t === "num" ? "negative" : null;

/** The other kinds of a number argument: an integer, a decimal, a negative and a list of two (derived inputs, not values). */
const VARIANTS: Readonly<Record<ArgKind, Node>> = {
  integer: { t: "num", v: "3" },
  decimal: { t: "num", v: "0.5" },
  negative: { t: "neg", a: { t: "num", v: "2" } },
  list: { t: "list", items: [{ t: "num", v: "1" }, { t: "num", v: "2" }] },
};

/** A whole-line call `name(…)` of the help's example: its argument text, or null. */
function callArgs(line: string, names: readonly string[]): { name: string; args: string } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)\s*;?\s*$/.exec(line);
  if (!m || !names.includes(m[1]!)) return null;
  // the brackets must close at the very end
  let depth = 0;
  const body = m[2]!;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")" && --depth < 0) return null;
  }
  return depth === 0 ? { name: m[1]!, args: body } : null;
}

/** Why an entry has no sample (no example, or none the keys can type), or its samples. */
export function samplesOf(name: string, names: readonly string[], examples: readonly string[]): Sample[] | { none: string } {
  let why = examples.length ? "no example the keys can type" : "no example in Giac's help";
  for (const line of examples) {
    const c = callArgs(line, names);
    if (!c) continue;
    let args: Node[];
    try {
      args = c.args.trim() === "" ? [] : parseArgs(c.args);
      const latex = op(name, args.map(tex).join(","));
      const out: Sample[] = [{ name, k: 0, latex, py: pyArgs(args) }];
      const last = args.at(-1);
      const kind = last ? kindOf(last) : null;
      if (kind && args.every((a) => kindOf(a) !== null)) {
        for (const k of ["integer", "decimal", "negative", "list"] as const) {
          if (k === kind) continue;
          const v = [...args.slice(0, -1), VARIANTS[k]];
          out.push({ name, k: out.length, latex: op(name, v.map(tex).join(",")), py: pyArgs(v), kind: k });
        }
      }
      return out;
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      why = `no example the keys can type (${e.message})`;
    }
  }
  return { none: why };
}

/** Exported for the tests: one argument text as keyboard LaTeX. */
export function argsLatex(text: string): string {
  return parseArgs(text).map(tex).join(",");
}
