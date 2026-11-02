// SPDX-License-Identifier: GPL-3.0-or-later
// R33 (deep-dive item 15): a name that holds a value is drawn in the stored-name colour (--name-mark) on the entry line.
// Only the render is touched: the colour is set on the rendered letter, so `getValue()`, the cursor and ⌫ are as they
// were. MathLive rebuilds its nodes on every edit, so a MutationObserver on the shadow root marks again after each
// render (a microtask, before the next paint). Loaded with MathLive (outside the start chunk), plain TS.
import type { MathfieldElement } from "mathlive";

/** Set on the rendered letter; `--name-mark` is a colour role of src/style.css. */
const MARK = "var(--name-mark)";

/**
 * A rendered variable letter that is the whole name: an italic leaf (`ML__mathit`; an upright letter is a unit, a
 * constant or part of a function name), not the base of a subscript (`x_1` is another name) and not inside a chip
 * (a chip is worth its table value, whatever it shows).
 */
function isWholeName(s: HTMLElement): boolean {
  const next = s.nextElementSibling;
  if (next?.classList.contains("ML__msubsup") && next.querySelector(".ML__vlist-t2")) return false; // a subscript: two rows
  return s.closest('[style*="--chip-bg"]') === null;
}

export class NameMarks {
  private names: ReadonlySet<string> = new Set();
  private readonly mf: MathfieldElement;

  constructor(mf: MathfieldElement) {
    this.mf = mf;
    const root = mf.shadowRoot;
    if (root) new MutationObserver(() => this.paint()).observe(root, { childList: true, subtree: true });
    this.paint();
  }

  /** The stored single-letter names (variables and functions); the marks follow at once. */
  setNames(names: string[]): void {
    this.names = new Set(names);
    this.paint();
  }

  private paint(): void {
    const root = this.mf.shadowRoot;
    if (!root) return;
    for (const s of root.querySelectorAll<HTMLElement>(".ML__latex .ML__mathit")) {
      if (s.children.length > 0) continue;
      const on = this.names.has(s.textContent ?? "") && isWholeName(s);
      const now = s.style.color !== "";
      if (on !== now) s.style.color = on ? MARK : "";
    }
  }
}
