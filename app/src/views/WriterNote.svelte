<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R95/R111: another tab holds the store, so nothing done here is kept (said in words under the first line); Use here hands it to this tab (state/handOver.ts
     mounts this line above the stage, in its own lazy chunk). -->
<script lang="ts">
  import { writerText } from "../i18n/enWriter.ts";

  let { take }: { take: (() => void) | null } = $props();
  let asked = $state(false);
</script>

<p class="writernote" role="status" data-testid="writer-note">
  <span class="words"><span>{writerText("writer.elsewhere")}</span><span class="sub">{writerText("writer.notKept")}</span></span>
  {#if take}
    <button type="button" data-testid="writer-use" disabled={asked} onclick={() => { asked = true; take?.(); }}
      >{writerText("writer.useHere")}</button>
  {/if}
</p>

<style>
  .writernote {
    flex: none;
    margin: var(--sp-15) var(--sp-2) 0;
    padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-35);
    min-height: var(--slot-h);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-25);
    border-radius: var(--radius-pill);
    background: var(--panel);
    border: var(--stroke-thin) solid var(--line);
    color: var(--muted);
    font-size: var(--fs-note);
  }
  .words {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }
  .sub {
    font-size: var(--fs-caption);
  }
  button {
    flex: none;
    padding: var(--sp-1) var(--sp-3);
    border: 0;
    border-radius: var(--radius-l);
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
