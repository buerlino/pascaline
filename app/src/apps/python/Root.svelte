<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { ViewId } from "../types.ts";
  import type { PythonApp } from "./app.svelte.ts";
  import Editor from "./Editor.svelte";
  import Graphics from "./Graphics.svelte";
  import Shell from "./Shell.svelte";

  let { app, view }: { app: PythonApp; view: ViewId } = $props();
</script>

<div class="python" data-testid="python" data-status={app.status}>
  {#if view === "symb"}
    <Editor {app} />
  {:else if view === "plot"}
    <Graphics {app} />
  {:else}
    <Shell {app} />
  {/if}
</div>

<style>
  .python {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
