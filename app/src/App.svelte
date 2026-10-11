<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { EntryController } from "./entry/controller.ts";
  import { t } from "./i18n/index.ts";
  import Keypad from "./keyboard/Keypad.svelte";
  import { actionFor, type ActionBody, type Key } from "./keyboard/keyboard.ts";
  import type { Session } from "./state/session.svelte.ts";
  import History from "./views/History.svelte";
  import Settings from "./views/Settings.svelte";

  let { session, entry }: { session: Session; entry: EntryController } = $props();

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    entry.onEnter = enter;
    entry.onEscape = () => void cancel();
  });
  let host: HTMLElement | undefined = $state();

  /** The entry line is cleared as soon as the job starts; the result arrives in the history. */
  function enter(): void {
    if (session.submit(entry.value)) entry.clear();
  }

  async function cancel(): Promise<void> {
    if (await session.cancel()) return;
    entry.clear();
  }

  function clearKey(): void {
    if (entry.value === "") session.clearHistory();
    else entry.clear();
  }

  function special(name: Extract<ActionBody, { kind: "special" }>["name"]): void {
    switch (name) {
      case "enter":
        enter();
        break;
      case "cancel":
        void cancel();
        break;
      case "clear":
        clearKey();
        break;
      case "app":
        session.toggleView();
        break;
      case "settings":
        session.settingsOpen = true;
        break;
      case "shift":
      case "alpha":
        break;
    }
  }

  function press(key: Key): void {
    const p = key.actions.primary;
    if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) {
      if (p.name === "shift") session.toggleShift();
      else session.toggleAlpha();
      return;
    }
    const action = actionFor(key, session.shift, session.alpha, session.settings.entry === "line");
    session.clearModifiers();
    if (!action) return;
    if (action.kind === "special") special(action.name);
    else entry.run(action);
  }

  const showSoftCancel = $derived(session.busy);
</script>

<main class="app">
  <header>
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={session.view === "home"}
        data-view="home"
        onclick={() => session.setView("home")}>{t("view.home")}</button>
      <button
        type="button"
        role="tab"
        aria-selected={session.view === "cas"}
        data-view="cas"
        onclick={() => session.setView("cas")}>{t("view.cas")}</button>
    </div>
    <span class="status" data-engine={session.engineState} data-busy={showSoftCancel}>
      {#if session.engineState === "starting"}{t("engine.starting")}{/if}
      {#if session.engineState === "failed"}{t("engine.error")}{/if}
    </span>
  </header>

  <History
    items={session.items}
    display={(item) => session.display(item)}
    onrecall={(latex) => entry.set(latex)}
    oncancel={() => void cancel()}
  />

  <div class="entry" aria-label={t("entry.label")} bind:this={host}></div>

  <Keypad shift={session.shift} alpha={session.alpha} onpress={press} />

  {#if session.settingsOpen}<Settings {session} />{/if}
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 720px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--line);
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    font: inherit;
    padding: 6px 16px;
    border-radius: 8px;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .tabs button[aria-selected="true"] {
    background: var(--panel);
    color: var(--text);
    font-weight: 700;
  }
  .status {
    font-size: 13px;
    color: var(--muted);
  }
  .entry {
    padding: 8px 12px;
    /* room for the field before MathLive has loaded, so nothing jumps */
    min-height: 66px;
  }
  .entry :global(math-field) {
    display: block;
    width: 100%;
    font-size: 28px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--line);
    --caret-color: var(--shift);
    --selection-background-color: #36506b;
  }
  .entry :global(math-field::part(virtual-keyboard-toggle)),
  .entry :global(math-field::part(menu-toggle)) {
    display: none;
  }
</style>
