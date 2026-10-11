<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // A numbered list over the view area (the app switcher and the view menus). The keypad stays usable:
  // digit keys pick an item (1…9, then 0), Cancel closes the list.
  import { t } from "../i18n/index.ts";

  let {
    title,
    items,
    onpick,
    onclose,
    testid,
  }: {
    title: string;
    items: readonly { label: string; disabled?: boolean | undefined }[];
    onpick: (i: number) => void;
    onclose: () => void;
    testid: string;
  } = $props();
</script>

<div class="overlay" data-testid={testid}>
  <div class="list" role="menu" aria-label={title}>
    <div class="head">
      <span>{title}</span>
      <button type="button" class="x" aria-label={t("apps.close")} onpointerdown={(e) => e.preventDefault()} onclick={onclose}>×</button>
    </div>
    {#each items as item, i (i)}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => onpick(i)}
      >
        <span class="n">{(i + 1) % 10}</span>{item.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 5;
  }
  .list {
    width: min(100%, 420px);
    margin: 8px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 16px);
    overflow-y: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    color: var(--muted);
    font-size: 14px;
  }
  .x {
    all: unset;
    font-size: 22px;
    padding: 0 6px;
    cursor: pointer;
  }
  button[role="menuitem"] {
    all: unset;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
  }
  button[role="menuitem"]:hover,
  button[role="menuitem"]:focus-visible {
    background: var(--key-num);
  }
  button[role="menuitem"]:disabled {
    opacity: 0.4;
  }
  .n {
    color: var(--shift);
    font-size: 14px;
    min-width: 1ch;
  }
</style>
