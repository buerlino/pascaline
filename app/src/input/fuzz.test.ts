// SPDX-License-Identifier: GPL-3.0-or-later
// Robustness: random token soup must either parse or throw SerializeError (never another exception, never hang).
import { describe, expect, it } from "vitest";
import { SerializeError } from "./emit.ts";
import { latexToGiac } from "./latex-to-giac.ts";

const pieces = ["1", "2.5", "x", "y", "+", "-", "\\times", "\\div", "^", "_", "{", "}", "\\left(", "\\right)", "(", ")", "\\frac", "\\sqrt",
  "\\sin", "\\ln", "\\int", "dx", "d", "\\sum", "\\lim", "\\to", "=", ",", "\\begin{pmatrix}", "\\end{pmatrix}", "&", "\\\\", "\\pi", "!", "\\%",
  "\\circ", "\\left|", "\\right|", "\\operatorname{foo}", "\\mathrm{d}", "[", "]", "\\unknown", ".", "\\,", "e", "i",
  "\\emark", "\\emark-", "ᴇ", "+"];

describe("parser fuzz", () => {
  it("20000 random token strings parse or fail with SerializeError, quickly", () => {
    let seed = 12345;
    const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let ok = 0;
    let rejected = 0;
    const crashes: string[] = [];
    const slow: string[] = [];
    for (let i = 0; i < 20000; i++) {
      const len = 1 + Math.floor(rnd() * 12);
      let s = "";
      for (let k = 0; k < len; k++) s += (pieces[Math.floor(rnd() * pieces.length)] ?? "") + (rnd() < 0.3 ? " " : "");
      const t = performance.now();
      try {
        latexToGiac(s);
        ok++;
      } catch (e) {
        if (e instanceof SerializeError) rejected++;
        else crashes.push(`${JSON.stringify(s)}: ${String(e)}`);
      }
      if (performance.now() - t > 200) slow.push(JSON.stringify(s));
    }
    expect(crashes.slice(0, 5)).toEqual([]);
    expect(slow.slice(0, 5)).toEqual([]);
    expect(ok + rejected).toBe(20000);
  });
});
