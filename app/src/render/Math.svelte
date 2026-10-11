<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Static 2D rendering of a LaTeX string with MathLive's renderer (the same one the entry line uses).
  import { convertLatexToMarkup } from "mathlive";

  let { latex, label = "" }: { latex: string; label?: string } = $props();

  const markup = $derived.by(() => {
    try {
      return convertLatexToMarkup(latex);
    } catch {
      return "";
    }
  });
</script>

<span class="math" data-latex={latex} role="math" aria-label={label || latex}>
  {#if markup}{@html markup}{:else}{latex}{/if}
</span>
