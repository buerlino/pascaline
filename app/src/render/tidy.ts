// SPDX-License-Identifier: GPL-3.0-or-later
// Tidy-up of Giac's latex() output so it reads like textbook maths (D4): implicit products, sized
// brackets, no redundant parentheses in fractions, matrices as pmatrix. The string is then drawn by
// MathLive's static renderer; raw engine text is never shown as the result.

/** Index of the delimiter closing the group opened at `open` (a "{" or "\left(" or "("), or -1. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Plain ( ) become \left( \right) so brackets grow with fractions. Unbalanced input is left alone. */
function sizeBrackets(s: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === "\\") {
      const m = /^\\(left|right)\s*(\\[{}|]|[()[\]|.])/.exec(s.slice(i));
      if (m) {
        out += m[0];
        i += m[0].length - 1;
      } else {
        const cmd = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i))?.[0] ?? c;
        out += cmd;
        i += cmd.length - 1;
      }
    } else if (c === "(") {
      depth++;
      out += "\\left(";
    } else if (c === ")") {
      if (--depth < 0) return s;
      out += "\\right)";
    } else out += c;
  }
  return depth === 0 ? out : s;
}

/** `\frac{\left(A\right)}{...}`: the parentheses around a whole numerator or denominator are redundant. */
function stripFracParens(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const at = s.indexOf("\\frac{", i);
    if (at < 0) break;
    out += s.slice(i, at);
    const aOpen = at + 5;
    const aClose = matchBrace(s, aOpen);
    const bOpen = aClose + 1;
    const bClose = s[bOpen] === "{" ? matchBrace(s, bOpen) : -1;
    if (aClose < 0 || bClose < 0) {
      out += s.slice(at, at + 6);
      i = at + 6;
      continue;
    }
    const arg = (g: string): string => stripFracParens(unparen(g));
    out += `\\frac{${arg(s.slice(aOpen + 1, aClose))}}{${arg(s.slice(bOpen + 1, bClose))}}`;
    i = bClose + 1;
  }
  return out + s.slice(i);
}

/** "\left(X\right)" -> "X" when the parentheses enclose the whole string. */
function unparen(g: string): string {
  const t = g.trim();
  if (!t.startsWith("\\left(") || !t.endsWith("\\right)")) return t;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.startsWith("\\left(", i)) depth++;
    else if (t.startsWith("\\right)", i) && --depth === 0 && i + 7 < t.length) return t;
  }
  return t.slice(6, -7).trim();
}

const GIAC_FUNCS: Record<string, string> = {
  asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan", asinh: "\\operatorname{arsinh}", acosh: "\\operatorname{arcosh}",
  atanh: "\\operatorname{artanh}",
};

/**
 * A product sign between a factor and a letter, command or bracket is implicit in textbook maths.
 * The left factor is a whole token: a \command (\pi, \alpha, \infty), a digit, a single letter that is not
 * the tail of a command, "}" or "\right)". A command followed by a letter keeps a space (\pi x).
 */
function implicitProducts(s: string): string {
  const left = String.raw`(\\[A-Za-z]+|\d|(?<!\\[A-Za-z]*)[A-Za-z]|\}|\\right\))`;
  const right = String.raw`(?=(\\left\(|\\(?!cdot|times)[A-Za-z]+|[A-Za-z]))`;
  return s.replace(new RegExp(`${left}\\s*\\\\cdot\\s*${right}`, "g"), (_, l: string, r: string) =>
    l.startsWith("\\") && l !== "\\right)" && /^[A-Za-z]/.test(r) ? `${l} ` : l);
}

/**
 * Giac prints a subscripted name x_1 as `\mathrm{x\_1}` (an upright name with an escaped underscore);
 * textbook form is an italic base with a subscript, `x_{1}`. A multi-letter base stays upright.
 */
function subscriptNames(s: string): string {
  return s.replace(/\\mathrm\{([A-Za-z][A-Za-z0-9]*)\\_([A-Za-z0-9]+)\}/g, (_, base: string, sub: string) =>
    `${base.length === 1 ? base : `\\mathrm{${base}}`}_{${sub}}`);
}

/**
 * R18: the Greek names that would clash in Giac are entered as beta_, gamma_, Gamma_, epsilon_ (input/parse.ts GREEK);
 * Giac draws them as `\beta_`, a letter with a stray subscript mark. They are the letters again, and ε and φ take the
 * shapes the palette shows (\varepsilon, \varphi).
 */
function greekNames(s: string): string {
  return s
    .replace(/\\(beta|gamma|Gamma|epsilon)_(?![A-Za-z0-9{])(?=([A-Za-z]?))/g, (_, n: string, letter: string) =>
      `\\${n === "epsilon" ? "varepsilon" : n}${letter ? " " : ""}`)
    .replace(/\\phi(?![A-Za-z])/g, "\\varphi");
}

export function tidyGiacLatex(raw: string): string {
  let s = raw.trim();
  s = greekNames(s);
  s = subscriptNames(s);
  // matrices
  s = s.replace(/\\left\(\\begin\{array\}\{[a-z|]*\}([\s\S]*?)\\end\{array\}\\right\)/g, (_, body: string) =>
    `\\begin{pmatrix}${body.trim()}\\end{pmatrix}`);
  s = s.replace(/\\mathrm\{(asin|acos|atan|asinh|acosh|atanh)\}/g, (_, f: string) => GIAC_FUNCS[f] as string);
  s = s.replace(/\\mathrm\{factorial\}\\left\(([^()]*)\\right\)/g, "\\left($1\\right)!");
  s = sizeBrackets(s);
  s = stripFracParens(s);
  s = s.replace(/\*/g, "\\cdot ");
  s = s.replace(/(?<![A-Za-z\\])e\^/g, "\\mathrm{e}^");
  s = implicitProducts(s);
  return s.replace(/\s+/g, " ").trim();
}
