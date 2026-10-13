<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import PickList from "./apps/PickList.svelte";
  import { APPS } from "./apps/registry.ts";
  import type { AppShell } from "./apps/shell.svelte.ts";
  import { VIEW_IDS, type NavDir, type ViewId } from "./apps/types.ts";
  import type { ClipActions } from "./clipboard/actions.svelte.ts";
  import { startsWithAns } from "./entry/ans.ts";
  import { ANS_CHIP } from "./entry/macros.ts";
  import type { EntryController } from "./entry/controller.ts";
  import { t, type MessageKey } from "./i18n/index.ts";
  import { vibrate } from "./input/haptics.ts";
  import Keypad from "./keyboard/Keypad.svelte";
  import { actionFor, keyboard, type ActionBody, type Key, type Layer } from "./keyboard/keyboard.ts";
  import { resultToEntry } from "./render/insertable.ts";
  import type { HistoryItem, Session } from "./state/session.svelte.ts";
  import History from "./views/History.svelte";
  import Settings from "./views/Settings.svelte";

  let { session, entry, shell }: { session: Session; entry: EntryController; shell: AppShell } = $props();

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    entry.onEnter = enter;
    entry.onEscape = () => void cancel();
  });
  let host: HTMLElement | undefined = $state();

  // Copy, paste and share (docs/04 2.6) load after the engine is ready, once the browser is idle (not in the start chunk).
  // The shell reaches them for the apps (AppHost.copy) and for the Home/CAS Menu.
  let clip = $state.raw<ClipActions | undefined>();
  let clipLoading: Promise<ClipActions> | undefined;
  function loadClip(): Promise<ClipActions> {
    clipLoading ??= import("./clipboard/actions.svelte.ts").then((m) => {
      const c = new m.ClipActions(session, shell, entry);
      shell.clip = c;
      shell.homeMenu = () => c.menu();
      clip = c;
      return c;
    });
    return clipLoading;
  }
  /** Run now when loaded, else as soon as the code has arrived (a key pressed before the idle load). */
  function withClip(run: (c: ClipActions) => void): void {
    if (clip) run(clip);
    else void loadClip().then(run);
  }
  $effect(() => {
    entry.lineMode = session.settings.entry === "line";
  });
  $effect(() => {
    // (a browser without requestIdleCallback loads it on the first use)
    if (session.engineState === "ready" && "requestIdleCallback" in window) requestIdleCallback(() => void loadClip(), { timeout: 3000 });
  });

  /** Home/CAS: the entry line is cleared as soon as the job starts; the result arrives in the history. Apps decide themselves. */
  function enter(): void {
    if (shell.app !== null) {
      shell.enter(entry.value);
      return;
    }
    if (session.submit(entry.value, undefined, entry.chips)) entry.clear();
  }

  /** L5 and docs/04 2.8: a tapped or picked result goes on the line as a chip that carries its full value. */
  function insertResult(item: HistoryItem): void {
    const shown = session.display(item).latex;
    const chip = session.chipFor(item);
    if (chip) entry.insertResult(shown, chip);
    else entry.insert(resultToEntry(shown)); // too long for a chip: as drawn
  }

  async function cancel(): Promise<void> {
    if (await shell.cancel()) return;
    if (await session.cancel()) return;
    entry.clear();
  }

  function clearKey(): void {
    if (shell.app === null && entry.value === "") session.clearHistory();
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
      case "esc":
        // Esc: close an open list, else clear the entry line (a running job is the Cancel key's business).
        if (shell.switcherOpen || shell.menuOpen) {
          shell.switcherOpen = false;
          shell.menuOpen = false;
        } else entry.clear();
        break;
      case "app":
        // Home/CAS key: from an app back to Home/CAS, else switch between the two.
        picked = null;
        if (shell.app !== null) shell.close();
        else session.toggleView();
        break;
      case "cas":
        picked = null;
        shell.close();
        session.setView("cas");
        break;
      case "settings":
        session.settingsOpen = true;
        break;
      case "apps":
        shell.menuOpen = false;
        shell.switcherOpen = !shell.switcherOpen;
        break;
      case "symb":
      case "plot":
      case "num":
        void shell.setView(name);
        break;
      case "menu":
        withClip(() => shell.toggleMenu()); // the Home/CAS menu comes with the clipboard code
        break;
      case "copy":
        withClip((c) => void c.copyKey());
        break;
      case "paste":
        withClip((c) => void c.paste());
        break;
      case "fmt":
        // Format key: Home and CAS show the last result in the next mode; the apps have no such result.
        if (shell.app === null) void session.cycleFormat();
        break;
      case "shift":
      case "alpha":
      case "none":
        break;
    }
  }

  // P4: Up on an empty entry line picks the last history row (Home/CAS); Up/Down walk the rows, Enter puts the
  // picked result on the entry line (L5; an entry without a result puts its input back), Esc drops the pick.
  // Any other key drops the pick and does its normal job.
  let picked = $state<number | null>(null);
  function historyKey(action: ActionBody): boolean {
    const items = session.items;
    const n = items.length;
    const isCmd = (name: string) => action.kind === "cmd" && action.name === name;
    if (picked === null || picked >= n) {
      picked = null;
      if (!isCmd("moveUp") || n === 0 || entry.value !== "") return false;
      picked = n - 1;
      return true;
    }
    if (isCmd("moveUp")) {
      picked = Math.max(0, picked - 1);
      return true;
    }
    if (isCmd("moveDown")) {
      picked = picked + 1 < n ? picked + 1 : null;
      return true;
    }
    const item = items[picked];
    picked = null;
    if (action.kind === "special" && action.name === "esc") return true;
    if (action.kind === "special" && action.name === "copy" && item) {
      withClip((c) => void c.copyKey(item)); // Shift + View copies the picked row
      return true;
    }
    if (action.kind === "special" && action.name === "enter" && item) {
      if (item.status === "done") insertResult(item);
      else entry.set(item.latex, item.chips); // the line is empty while picking: the entry comes back with its chips
      return true;
    }
    return false;
  }

  /** A finger went down on the keypad, or a gesture made a step: vibrate when switched on in Settings. */
  function touched(): void {
    const h = session.settings.haptics;
    if (h.on) vibrate(h.strength / 100, h.ms);
  }

  /** Shift and Alpha as one key would see them: the session's state, or the layer a gesture chose. */
  type Mods = { shift: boolean; alpha: boolean };
  const modsFor = (layer: Layer | undefined): Mods =>
    layer === undefined ? { shift: session.shift, alpha: session.alpha } : { shift: layer === "shift", alpha: layer === "alpha" };

  const layerOf = (m: Mods): Layer => (m.alpha ? "alpha" : m.shift ? "shift" : "primary");

  const NAV: Record<string, NavDir> = {
    moveUp: "up",
    moveDown: "down",
    moveToPreviousChar: "left",
    moveToNextChar: "right",
  };
  const DIGIT = /^d([0-9])$/;

  // Keys pressed while an app's code is loading wait for it, so nothing typed is lost (like MathLive's queue).
  let waiting: [Key, Layer | undefined][] = [];
  /** A key fires. `layer` (a trackpad step, a flick) overrides the Shift/Alpha state for this key only. */
  function press(key: Key, layer?: Layer): void {
    const pk = key.actions.primary;
    const switches = pk?.kind === "special" && ["cancel", "esc", "app", "cas", "apps", "symb", "plot", "num", "settings"].includes(pk.name);
    if (shell.loading !== null && !switches) {
      waiting.push([key, layer]);
      if (waiting.length === 1)
        void shell.opening.then(() => {
          const keys = waiting;
          waiting = [];
          for (const [k, l] of keys) press(k, l);
        });
      return;
    }
    const p = key.actions.primary;
    if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) {
      if (p.name === "shift") session.toggleShift();
      else session.toggleAlpha();
      return;
    }
    const mods = modsFor(layer);
    // An open list takes the digit keys (1…9, 0).
    const digit = DIGIT.exec(key.id);
    if (digit && !mods.shift && !mods.alpha && (shell.switcherOpen || shell.menuOpen)) {
      const i = (Number(digit[1]) + 9) % 10;
      if (shell.switcherOpen) {
        const a = APPS[i];
        if (a) void shell.open(a.id);
      } else shell.pick(i);
      return;
    }
    const action = actionFor(key, mods.shift, mods.alpha, session.settings.entry === "line");
    session.clearModifiers();
    if (!action) return;
    if (shell.app === null && historyKey(action)) return;
    if (action.kind === "special") return special(action.name);
    if (shell.app !== null) {
      const dir = action.kind === "cmd" ? NAV[action.name] : undefined;
      if (dir && shell.nav(dir)) return;
      if (!shell.showsEntry) return; // a view without an entry line (Plot) ignores typing
      if (action.kind === "insert" && action.latex === ANS_CHIP) return; // Ans belongs to Home and CAS
    } else if (entry.value === "" && startsWithAns(key.id, layerOf(mods)) && session.lastChip()) {
      entry.insertAns(); // docs/04 2.8: an operator on an empty line starts with Ans
    }
    entry.run(action, key.id);
  }

  const showSoftCancel = $derived(session.busy || shell.busy);
  const appName = $derived(shell.app ? t(APPS.find((a) => a.id === shell.app)?.name as MessageKey) : "");
  const appViews = $derived<readonly ViewId[]>(shell.instance?.views ?? (shell.app ? VIEW_IDS : []));
</script>

<main class="app">
  <header>
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={shell.app === null && session.view === "home"}
        data-view="home"
        onclick={() => {
          shell.close();
          session.setView("home");
        }}>{t("view.home")}</button>
      <button
        type="button"
        role="tab"
        aria-selected={shell.app === null && session.view === "cas"}
        data-view="cas"
        onclick={() => {
          shell.close();
          session.setView("cas");
        }}>{t("view.cas")}</button>
      {#if shell.app !== null}
        <span class="appname" data-app={shell.app}>{appName}</span>
        {#each appViews as v (v)}
          <button type="button" role="tab" aria-selected={shell.view === v} data-view={v} onclick={() => void shell.setView(v)}
            >{t(`view.${v}`)}</button>
        {/each}
      {/if}
    </div>
    <span class="status" data-engine={session.engineState} data-busy={showSoftCancel}>
      {#if session.engineState === "starting"}{t("engine.starting")}{/if}
      {#if session.engineState === "failed"}{t("engine.error")}{/if}
    </span>
  </header>

  <div class="stage">
    {#if shell.app === null}
      <History
        items={session.items}
        selected={picked}
        display={(item) => session.display(item)}
        mark={(item) => session.mark(item)}
        onrecall={(item) => entry.set(item.latex, item.chips)}
        oninsert={insertResult}
        oncancel={() => void cancel()}
        onlongpress={(item) => withClip((c) => c.openRowMenu(item))}
      />
    {:else if shell.current}
      {@const C = shell.current.Root}
      <C app={shell.current.instance} view={shell.view} />
    {:else}
      <p class="loading">{t("apps.loading")}</p>
    {/if}

    {#if shell.switcherOpen}
      <PickList
        testid="apps"
        title={t("apps.title")}
        items={APPS.map((a) => ({ label: t(a.name) }))}
        onpick={(i) => void shell.open(APPS[i]?.id ?? "function")}
        onclose={() => (shell.switcherOpen = false)}
      />
    {:else if shell.menuOpen}
      <PickList
        testid="menu"
        title={shell.menuTitle ?? t("menu.title")}
        items={shell.menuItems}
        onpick={(i) => shell.pick(i)}
        onclose={() => (shell.menuOpen = false)}
      />
    {/if}
  </div>

  {#if clip?.notice}<div class="notice" role="status" data-testid="notice">{clip.notice}</div>{/if}

  <div class="entry" class:hidden={!shell.showsEntry} aria-label={t("entry.label")}>
    {#if shell.entryLabel}<span class="entrylabel" data-testid="entry-label">{shell.entryLabel}</span>{/if}
    <div class="field" bind:this={host}></div>
  </div>

  <Keypad shift={session.shift} alpha={session.alpha} alphaLock={session.alphaLock} onpress={press} ontouch={touched} />

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
  .tabs {
    flex-wrap: wrap;
    gap: 2px;
  }
  .tabs button {
    font: inherit;
    font-size: 15px;
    padding: 6px 9px;
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
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .loading {
    margin: auto;
    color: var(--muted);
  }
  .appname {
    align-self: center;
    margin: 0 4px 0 6px;
    font-size: 15px;
    font-weight: 700;
    color: var(--shift);
  }
  .notice {
    position: relative;
    align-self: center;
    margin: 0 12px 4px;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 14px;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    /* room for the field before MathLive has loaded, so nothing jumps */
    min-height: 66px;
  }
  .entry.hidden {
    display: none;
  }
  .entrylabel {
    color: var(--muted);
    white-space: nowrap;
  }
  .field {
    flex: 1;
    min-width: 0;
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
