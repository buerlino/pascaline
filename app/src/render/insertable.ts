// SPDX-License-Identifier: GPL-3.0-or-later
// L5: a history result put back on the entry line. The result's display LaTeX is turned into what our
// keyboard would have typed (constants as MathLive writes them), and wrapped in brackets when it is a sum
// or difference, so that 2× then a tapped x+1 means 2(x+1).

/** Top-level + or − after the first character (outside every group and bracket). */
function hasTopLevelSum(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      // a command name (\left, \right, \frac ...); the bracket after \left( / \right) is counted below
      while (i + 1 < s.length && /[A-Za-z]/.test(s[i + 1] as string)) i++;
    } else if (s[i] === "{" || s[i] === "(") depth++;
    else if (s[i] === "}" || s[i] === ")") depth--;
    else if (depth === 0 && i > 0 && (s[i] === "+" || s[i] === "-")) return true; // 10^{-7}: inside braces
  }
  return false;
}

export function resultToEntry(latex: string): string {
  const s = latex
    .trim()
    .replace(/\\mathrm\{i\}/g, "\\imaginaryI")
    .replace(/\\mathrm\{e\}/g, "\\exponentialE");
  return hasTopLevelSum(s) ? `\\left(${s}\\right)` : s;
}
