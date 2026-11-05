// SPDX-License-Identifier: GPL-3.0-or-later
// An entry's LaTeX as plain text (R134): what a shared session and the why line write for people. Its own module so the
// why line (in the tidy chunk) does not pull the copy code of text.ts with it.

/** A fraction part or exponent: bare when it is one token, else in brackets. */
const group = (s: string): string => (/^-?[\w.]+$/.test(s) ? s : `(${s})`);

/** The LaTeX commands an entry may hold that are one character or word in plain text: the Greek letters (the Symbols
 *  palette's and the constants' and units' symbols) and its other cells (spec/keyboard.yaml `symbols:`, text.test.ts
 *  checks that every insert is here), π, the arrows. A command not in the table is left as it is. */
const COMMANDS: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", hbar: "ħ",
  infty: "∞", degree: "°", prime: "′", doubleprime: "″", AA: "Å", to: " → ", rightarrow: " → ",
};

/** The command names the table holds (for the test that the Symbols palette is covered). */
export const PLAIN_COMMANDS: readonly string[] = Object.keys(COMMANDS);

/** The `{…}` group that starts at `s[i]` (a `{`): its content and the index after its `}`; undefined if it never closes. */
function group1(s: string, i: number): { body: string; end: number } | undefined {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++; // an escaped brace (`\{`) is no group
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return undefined;
}

/** Every `\name{…}…{…}` with `argc` brace groups (the groups may hold braces), in order: where it starts and ends in `s`
 *  and the groups' text. A macro whose groups do not close is not listed. */
export function macroCalls(s: string, name: string, argc: number): { start: number; end: number; args: string[] }[] {
  const out: { start: number; end: number; args: string[] }[] = [];
  const head = new RegExp(`\\\\${name}(?![A-Za-z])`, "g");
  for (let m = head.exec(s); m; m = head.exec(s)) {
    const args: string[] = [];
    let at = m.index + m[0].length;
    while (args.length < argc && s[at] === "{") {
      const g = group1(s, at);
      if (!g) break;
      args.push(g.body);
      at = g.end;
    }
    if (args.length === argc) {
      out.push({ start: m.index, end: at, args });
      head.lastIndex = at;
    }
  }
  return out;
}

/** `\name{a}{b}` (and the like) written as its argument number `keep`; repeated, so a wrapper inside a wrapper goes too. */
function unwrap(s: string, name: string, argc: number, keep: number): string {
  let out = s;
  for (let n = 0; n < 8; n++) {
    const calls = macroCalls(out, name, argc);
    if (!calls.length) break;
    for (const c of calls.reverse()) out = out.slice(0, c.start) + (c.args[keep] ?? "") + out.slice(c.end);
  }
  return out;
}

/** An entry as plain text for a shared session: the LaTeX as typed (the parser's output is for the engine, not for people).
 *  Wrappers and chips first (a chip's symbol is LaTeX too), then the commands, then `\mathrm`, so `\to\mathrm{m}` is
 *  read as `\to` and `m`, never `\tom`. */
export function entryText(latex: string): string {
  let s = latex.replace(/\\left|\\right/g, "");
  s = unwrap(unwrap(s, "class", 2, 1), "htmlStyle", 2, 1);
  s = unwrap(unwrap(unwrap(unwrap(s, "const", 2, 1), "res", 2, 1), "unit", 2, 1), "pfx", 2, 1);
  s = s.replace(/\\([_&%])/g, "$1").replace(/\\([A-Za-z]+)/g, (m, name: string) => COMMANDS[name] ?? m);
  // \mathrm after the commands (so `\to\mathrm{m}` is not `\tom`); a symbol like `deg^{2}` holds braces
  s = unwrap(unwrap(s, "mathrm", 1, 0), "operatorname", 1, 0);
  s = s.replace(/\\(?:t|d)?frac(?!\{)(\w)(\w)/g, "\\frac{$1}{$2}"); // MathLive writes \frac13 for 1/3
  // the groups with no brace inside, innermost first: repeated, so `\frac{\mathrm{M}m^{2}}{s}` gets its exponent first
  for (let n = 0; n < 6; n++) {
    const was = s;
    s = s
      .replace(/\\(?:t|d)?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a)}/${group(b)}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => `^${group(a)}`)
      .replace(/_\{([^{}]*)\}/g, "_$1");
    if (s === was) break;
  }
  return s
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\imaginaryI/g, "i")
    .replace(/\\exponentialE/g, "e")
    .replace(/\\blacktriangleright/g, "▶")
    .replace(/\\pm(?![A-Za-z])/g, "±")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\ans(?![A-Za-z])/g, "Ans")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
