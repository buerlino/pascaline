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

export const CHIP_MACROS: Record<"res" | "ans" | "const" | "unit" | "pfx", ChipMacro> = {
  /** `\res{k}{shown}`: a history result; its value is the chip table's `res:k`. */
  res: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
  /** `\ans`: the view's last result, read when Enter is pressed. */
  ans: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{Ans}}`, args: 0, captureSelection: true, expand: false },
  /** `\const{ID}{symbol}`: a constant from Find; its value is the chip table's `const:ID`. */
  const: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{#2}}`, args: 2, captureSelection: true, expand: false },
  /** `\unit{ID}{symbol}`: a unit from Find (R4a); `symbol` is upright LaTeX already (`\mathrm{km/h}`). */
  unit: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
  /** `\pfx{ID}{symbol}`: an SI prefix from Find (R4a). */
  pfx: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
};

/**
 * The exponent mark (R14, P12 point 4): `1.5\emark-3` is 1.5·10⁻³, drawn `1.5ᴇ-3` (U+1D07, the small-capital E the
 * reference draws). A macro, not the bare character, for two reasons found by probing MathLive 0.111.1: as a bare
 * ordinary character it made the minus after it a binary operator (drawn `1.5ᴇ − 3`, spaced like a subtraction),
 * and `\mathopen{ᴇ}` alone is a group the cursor steps into. `\mathopen` gives the tight spacing (an opening atom
 * makes the following minus a sign), `captureSelection` makes it one step for the cursor and ⌫.
 */
export const EMARK = "\\emark";
const EMARK_MACRO: ChipMacro = { def: "\\mathopen{\u1D07}", args: 0, captureSelection: true, expand: false };

/** Every macro of the entry line, for the field and for the static renderer. */
export const ENTRY_MACROS: Record<"res" | "ans" | "const" | "unit" | "pfx" | "emark", ChipMacro> = {
  ...CHIP_MACROS,
  emark: EMARK_MACRO,
};

/** A history result as a chip: `shown` is the result's display LaTeX. */
export const resChip = (k: number, shown: string): string => `\\res{${k}}{${shown}}`;
/** A constant as a chip: `symbol` is LaTeX (`c`, `k_{B}`, `\\mu_{0}`). */
export const constChip = (id: string, symbol: string): string => `\\const{${id}}{${symbol}}`;
export const ANS_CHIP = "\\ans";

/** The LaTeX of an atom is one chip (the controller treats it as a whole term before ÷, x², xʸ, x⁻¹). */
export const isChipLatex = (latex: string): boolean => /^\\(?:res|ans|const|unit|pfx)(?![A-Za-z])/.test(latex);
