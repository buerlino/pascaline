// SPDX-License-Identifier: GPL-3.0-or-later
// The chip macros of the entry line (docs/04 section 3.6), shared by the MathLive field and the static history
// renderer. `captureSelection` makes each chip one unit the cursor steps over and ⌫ deletes whole; `expand: false`
// keeps the macro itself in the field's value, so the parser sees `\res{k}{…}`, not the digits drawn.
// The first argument names the chip (the key in the entry's chip table, input/chips.ts), the second is only what
// it shows. Drawn upright on the accent background (--chip-bg in style.css), so a chip never looks like a variable.
// Plain data: importing this does not load MathLive.

const CHIP_STYLE = "background:var(--chip-bg);border-radius:4px;padding:0 3px";

/** MathLive's MacroDefinition, written out so this module needs no MathLive import. */
interface ChipMacro {
  def: string;
  args: number;
  captureSelection: true;
  expand: false;
}

export const CHIP_MACROS: Record<"res" | "ans" | "const", ChipMacro> = {
  /** `\res{k}{shown}`: a history result; its value is the chip table's `res:k`. */
  res: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
  /** `\ans`: the view's last result, read when Enter is pressed. */
  ans: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{Ans}}`, args: 0, captureSelection: true, expand: false },
  /** `\const{ID}{symbol}`: a constant from Find; its value is the chip table's `const:ID`. */
  const: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{#2}}`, args: 2, captureSelection: true, expand: false },
};

/** A history result as a chip: `shown` is the result's display LaTeX. */
export const resChip = (k: number, shown: string): string => `\\res{${k}}{${shown}}`;
/** A constant as a chip: `symbol` is LaTeX (`c`, `k_{B}`, `\\mu_{0}`). */
export const constChip = (id: string, symbol: string): string => `\\const{${id}}{${symbol}}`;
export const ANS_CHIP = "\\ans";

/** The LaTeX of an atom is one chip (the controller treats it as a whole term before ÷, x², xʸ, x⁻¹). */
export const isChipLatex = (latex: string): boolean => /^\\(?:res|ans|const)(?![A-Za-z])/.test(latex);
