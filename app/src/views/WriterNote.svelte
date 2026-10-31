<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R95: another tab holds the store, so nothing done here is kept; Use here hands it to this tab (state/handOver.ts
     mounts this line above the stage, in its own lazy chunk). -->
<script lang="ts">
  import { writerText } from "../i18n/enWriter.ts";

  let { take }: { take: (() => void) | null } = $props();
  let asked = $state(false);
</script>

<p class="writernote" role="status" data-testid="writer-note" title={writerText("writer.notKept")}>
  <span>{writerText("writer.elsewhere")}</span>
  {#if take}
    <button type="button" data-testid="writer-use" disabled={asked} onclick={() => { asked = true; take?.(); }}
      >{writerText("writer.useHere")}</button>
  {/if}
</p>

<style>
  .writernote {
    flex: none;
    margin: 6px 8px 0;
    padding: 4px 4px 4px 14px;
    min-height: 32px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 14px;
  }
  button {
    flex: none;
    padding: 4px 12px;
    border: 0;
    border-radius: 12px;
    background: var(--key-nav);
    color: inherit;
    font: inherit;
    font-weight: 700;
    white-space: nowrap;
  }
  button:disabled {
    opacity: 0.5;
  }
</style>
