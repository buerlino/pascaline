<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Plot view of the Python app: the 320×240 drawing surface, scaled to fit with square pixels.
  import type { PythonApp } from "./app.svelte.ts";

  let { app }: { app: PythonApp } = $props();
  let host: HTMLElement | undefined = $state();

  $effect(() => {
    if (!host) return;
    const c = app.gfx.canvas;
    host.append(c);
    return () => c.remove();
  });
</script>

<div class="wrap"><div class="screen" bind:this={host}></div></div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  .screen {
    width: min(100%, calc((100vh - 360px) * 4 / 3));
    min-width: 160px;
    aspect-ratio: 4 / 3;
  }
  .screen :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    box-shadow: 0 0 0 1px var(--muted);
  }
</style>
