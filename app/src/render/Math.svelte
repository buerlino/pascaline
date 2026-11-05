<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Static 2D rendering of a LaTeX string with MathLive's renderer (the same one the entry line uses).
  // Until MathLive has loaded the LaTeX is shown as plain text. A LaTeX over MAX_DRAWN_LATEX, or one MathLive refuses,
  // is a note instead (R135): LaTeX source is never shown for a result, and a too long one never reaches MathLive.
  import { ENTRY_MACROS } from "../entry/macros.ts";
  import { MAX_DRAWN_LATEX, tooLongNote } from "./longResult.ts";
  import { mathlive, renderStats } from "./mathlive.svelte.ts";

  /** `size`: the length of the result's text, for the note (default: the LaTeX's own). */
  let { latex, label = "", size }: { latex: string; label?: string; size?: number } = $props();

  /** The markup; "" before MathLive is up (the plain text shows); null: not drawn, the note shows. */
  const markup = $derived.by((): string | null => {
    if (latex.length > MAX_DRAWN_LATEX) return null;
    const lib = mathlive.mod;
    if (!lib) return "";
    try {
      renderStats.count++;
      // chips in a history entry (\res, \ans, \const) and the exponent mark ᴇ draw as on the entry line
      return lib.convertLatexToMarkup(latex, { macros: ENTRY_MACROS });
    } catch {
      return null;
    }
  });
  const note = $derived(markup === null ? tooLongNote(size ?? latex.length) : "");
</script>

<span class="math" data-latex={note ? undefined : latex} role="math" aria-label={note || label || latex}>
  {#if note}{note}{:else if markup}{@html markup}{:else}{latex}{/if}
</span>

<style>
  /* the SI prefix of the PFX format (render/home.ts) */
  .math :global(.pfx) {
    color: var(--shift);
  }
  /* R40: the digits past what a constant's σ leaves (render/uncMute.ts mutedTail); --muted keeps the text floor */
  .math :global(.unc) {
    color: var(--muted);
  }
  /* R135: the note for a result too long to draw */
  .math:not([data-latex]) {
    color: var(--muted);
    font-size: var(--fs-note);
    white-space: nowrap;
  }
</style>
