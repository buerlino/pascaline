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

/** A product sign between a factor and a letter, command or bracket is implicit in textbook maths. */
function implicitProducts(s: string): string {
  return s.replace(/(\d|[A-Za-z]|\}|\\right\))\s*\\cdot\s*(?=(?:\\left\(|\\(?!cdot|times)[A-Za-z]+|[A-Za-z]))/g, (_, left: string) => left);
}

export function tidyGiacLatex(raw: string): string {
  let s = raw.trim();
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
