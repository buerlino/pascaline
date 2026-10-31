<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R95: another tab holds the store, so nothing typed here is kept; Use here hands it to this tab (state/handOver.ts). -->
<script lang="ts">
  import { t } from "../i18n/index.ts";
  import { writerNote } from "../state/writerNote.svelte.ts";
</script>

<p class="writernote" role="status" data-testid="writer-note" title={t("writer.notKept")}>
  <span>{t("writer.elsewhere")}</span>
  <button type="button" data-testid="writer-use" disabled={writerNote.take === null} onclick={() => writerNote.take?.()}
    >{t("writer.useHere")}</button>
</p>

<style>
  .writernote {
    margin: 0;
    padding: 4px 4px 4px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 14px;
    pointer-events: auto;
  }
  button {
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
