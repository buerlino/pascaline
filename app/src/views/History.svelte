<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { t } from "../i18n/index.ts";
  import Math from "../render/Math.svelte";
  import type { HistoryItem } from "../state/session.svelte.ts";

  let {
    items,
    onrecall,
    oncancel,
  }: { items: HistoryItem[]; onrecall: (latex: string) => void; oncancel: () => void } = $props();

  let scroller: HTMLElement | undefined = $state();
  // Keep the newest entry in view.
  $effect(() => {
    void items.length;
    void items.at(-1)?.status;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  // After this long a running job gets a prominent Cancel (D3: CAS soft budget).
  const SOFT_MS = 10_000;
  let now = $state(performance.now());
  $effect(() => {
    if (!items.some((i) => i.status === "pending")) return;
    const timer = setInterval(() => (now = performance.now()), 500);
    return () => clearInterval(timer);
  });
</script>

<section class="history" aria-label={t("history.label")} bind:this={scroller}>
  {#if items.length === 0}
    <p class="empty">{t("history.empty")}</p>
  {/if}
  {#each items as item (item.id)}
    <article class="item" data-status={item.status}>
      <button type="button" class="in" title={t("history.recall")} onclick={() => onrecall(item.latex)}>
        <Math latex={item.latex} />
      </button>
      <div class="out" data-testid="result">
        {#if item.status === "pending"}
          <span class="working">{t("history.working")}</span>
          <button type="button" class="cancel" class:prominent={now - item.startedAt > SOFT_MS} onclick={oncancel}>
            {t("history.cancel")}
          </button>
        {:else if item.status === "cancelled"}
          <span class="note">{t("history.cancelled")}</span>
        {:else if item.status === "error"}
          <span class="error" role="alert">{item.text}</span>
        {:else}
          <span class="result" data-text={item.text}>
            <Math latex={item.resultLatex} />
          </span>
          {#if item.approximate}<span class="note">{t("history.approximate")}</span>{/if}
        {/if}
      </div>
    </article>
  {/each}
</section>

<style>
  .history {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty {
    margin: auto;
    color: var(--muted);
    text-align: center;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: auto;
  }
  .item + .item {
    margin-top: 0;
  }
  .in {
    all: unset;
    cursor: pointer;
    font-size: 22px;
    color: var(--muted);
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
  }
  .out {
    align-self: flex-end;
    font-size: 26px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    max-width: 100%;
    overflow-x: auto;
  }
  .result {
    color: var(--text);
  }
  .note,
  .working {
    font-size: 14px;
    color: var(--muted);
  }
  .error {
    font-size: 16px;
    color: var(--error);
  }
  .cancel {
    font: inherit;
    font-size: 14px;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
  }
  .cancel.prominent {
    background: var(--error);
    color: #fff;
    border-color: var(--error);
    font-weight: 700;
  }
</style>
