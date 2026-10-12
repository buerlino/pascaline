<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Static 2D rendering of a LaTeX string with MathLive's renderer (the same one the entry line uses).
  // Until MathLive has loaded the LaTeX is shown as plain text.
  import { CHIP_MACROS } from "../entry/macros.ts";
  import { mathlive, renderStats } from "./mathlive.svelte.ts";

  let { latex, label = "" }: { latex: string; label?: string } = $props();

  const markup = $derived.by(() => {
    const lib = mathlive.mod;
    if (!lib) return "";
    try {
      renderStats.count++;
      // chips in a history entry (\res, \ans, \const) draw as on the entry line
      return lib.convertLatexToMarkup(latex, { macros: CHIP_MACROS });
    } catch {
      return "";
    }
  });
</script>

<span class="math" data-latex={latex} role="math" aria-label={label || latex}>
  {#if markup}{@html markup}{:else}{latex}{/if}
</span>
