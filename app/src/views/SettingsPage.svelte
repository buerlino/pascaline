<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // The Settings page (R21b, decisions.md "R21", docs/05 3.4): one scrolling page over everything, status line and
  // keypad included, with a heading per section instead of submenus. A value row has ◀ ▶ buttons of at least 44 × 44 px;
  // a switch toggles on a tap; a disabled row keeps its reason. Closed by ×, Android back or Esc. The hardware keys
  // (▲ ▼ move, ◀ ▶ step, Enter or space toggles, Esc closes) are read here; the keypad's keys come through App.svelte.
  import { t } from "../i18n/index.ts";
  import type { SettingsPage } from "./settingsPage.svelte.ts";

  let { page, onclose }: { page: SettingsPage; onclose: () => void } = $props();

  let body: HTMLDivElement | undefined = $state();

  /** The keys of a hardware keyboard act on the page; nothing reaches the entry line behind it. */
  function onkeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const handled = ((): boolean => {
      switch (e.key) {
        case "ArrowUp":
          page.move(-1);
          return true;
        case "ArrowDown":
          page.move(1);
          return true;
        case "ArrowLeft":
          page.step(-1);
          return true;
        case "ArrowRight":
          page.step(1);
          return true;
        case "Enter":
        case " ":
          page.activate(page.highlight);
          return true;
        case "Escape":
          onclose();
          return true;
        default:
          return false;
      }
    })();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // the highlighted row stays in view
  $effect(() => {
    void page.highlight;
    body?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  });

  /** Keep the caret in the entry line: nothing on the page takes focus. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<svelte:window onkeydowncapture={onkeydown} />

<!-- svelte-ignore a11y_interactive_supports_focus (nothing on the page takes focus: the caret stays in the entry line) -->
<div class="page" role="dialog" aria-label={t("settings.title")} data-testid="settings" onpointerdown={noFocus}>
  <header>
    <h1 data-testid="settings-title">{t("settings.title")}</h1>
    <button type="button" class="close" data-testid="settings-close" aria-label={t("settings.close")} onclick={onclose}>×</button>
  </header>
  <div class="body" bind:this={body}>
    {#each page.sections as section (section.id)}
      <section data-section={section.id}>
        <h2>{section.title}</h2>
        {#if section.hint}<p class="hint">{section.hint}</p>{/if}
        {#each section.items as item (item.id)}
          {@const index = page.rows.indexOf(item)}
          {@const steps = item.adjust !== undefined}
          {@const sw = item.selected !== undefined}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus (the keys drive the rows; nothing here takes focus) -->
          <div
            class="row"
            role={sw ? "switch" : "group"}
            aria-checked={sw ? item.selected : undefined}
            aria-label={item.label}
            aria-disabled={item.disabled ? "true" : undefined}
            data-testid="settings-row"
            data-id={item.id}
            data-active={index === page.highlight}
            data-disabled={item.disabled ? "true" : undefined}
            onclick={() => page.activate(index)}
          >
            <span class="text"><span class="label">{item.label}</span>{#if item.disabled && item.reason}<span class="reason" data-testid="settings-reason">{item.reason}</span>{/if}</span>
            {#if steps}<button type="button" class="step" data-testid="step-down" aria-label={t("sheet.stepDown")} disabled={item.disabled} onclick={(e) => { e.stopPropagation(); page.stepAt(index, -1); }}>◀</button>{/if}
            {#if item.value !== undefined}<span class="value" data-testid="settings-value">{item.value}</span>{/if}
            {#if steps}<button type="button" class="step" data-testid="step-up" aria-label={t("sheet.stepUp")} disabled={item.disabled} onclick={(e) => { e.stopPropagation(); page.stepAt(index, 1); }}>▶</button>{/if}
            {#if sw}<span class="tick" data-testid="settings-tick" aria-hidden="true">{item.selected ? "✓" : ""}</span>{/if}
          </div>
        {/each}
      </section>
    {/each}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-sizing: border-box;
  }
  header,
  .body {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    box-sizing: border-box;
  }
  header {
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 8px 0 16px;
    min-height: 52px;
    border-bottom: 1px solid var(--line);
  }
  h1 {
    flex: 1;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  .close {
    width: 48px;
    height: 48px;
    border: 0;
    background: none;
    color: var(--text);
    font-size: 28px;
    line-height: 1;
    border-radius: 24px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 16px 24px;
  }
  h2 {
    margin: 20px 0 4px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .hint {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 2px 8px;
    border-radius: 8px;
    border-bottom: 1px solid var(--line);
  }
  .row[data-active="true"] {
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .row[data-disabled="true"] .label {
    color: var(--muted);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .reason {
    font-size: 12px;
    color: var(--muted);
  }
  .value {
    min-width: 3.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .step {
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    font-size: 16px;
  }
  .step:disabled {
    opacity: 0.4;
  }
  .tick {
    width: 44px;
    text-align: center;
    font-size: 20px;
  }
</style>
