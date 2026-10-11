<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { keyboard, labelFor, pythonLabel, type Key } from "./keyboard.ts";

  let {
    shift,
    alpha,
    alphaLock = false,
    python = false,
    onpress,
  }: { shift: boolean; alpha: boolean; alphaLock?: boolean; python?: boolean; onpress: (key: Key) => void } = $props();

  // The legend printed above a key is its next layer; the face shows the active layer. In a Python text view
  // the Python layer's legends replace the normal ones where it has them.
  const py = (k: Key, layer: "primary" | "shift"): string | undefined => (python ? pythonLabel(keyboard, k, layer) : undefined);
  const face = (k: Key): string =>
    (!alpha ? py(k, shift ? "shift" : "primary") : undefined) ?? legend(labelFor(k, shift, alpha) || k.label.primary || "");
  const hint = (k: Key): string => {
    if (shift || alpha) return "";
    const p = py(k, "shift");
    if (p !== undefined) return p;
    const s = k.label.shift ? legend(k.label.shift) : "";
    return s;
  };
  const alphaHint = (k: Key): string => (shift || alpha || !k.label.alpha ? "" : k.label.alpha);
  const pressed = (k: Key): boolean =>
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "shift" && shift) ||
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "alpha" && alpha);
</script>

<div
  class="pad"
  class:shifted={shift}
  class:alphaed={alpha}
  style:grid-template-columns={`repeat(${keyboard.columns}, 1fr)`}
>
  {#each keyboard.keys as key (key.id)}
    <!-- pointerdown + preventDefault: the button never takes focus, so the caret stays in the entry line. -->
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.cls === "ctl" && (key.id === "shift" || key.id === "alpha") ? pressed(key) : undefined}
      data-locked={key.id === "alpha" && alphaLock ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={key.col + 1}
      onpointerdown={(ev) => {
        ev.preventDefault();
        onpress(key);
      }}
      onclick={(ev) => ev.preventDefault()}
    >
      <span class="main">{face(key)}</span>
      {#if hint(key)}<span class="shiftlegend">{hint(key)}</span>{/if}
      {#if alphaHint(key)}<span class="alphalegend">{alphaHint(key)}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .pad {
    display: grid;
    gap: 6px;
    padding: 8px;
    background: var(--panel);
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    -webkit-touch-callout: none;
  }
  .key {
    position: relative;
    min-height: 48px;
    border: 0;
    border-radius: 8px;
    color: var(--text);
    font: inherit;
    font-size: 20px;
    background: var(--key-num);
    -webkit-tap-highlight-color: transparent;
  }
  .key:active {
    filter: brightness(1.4);
  }
  .key.op {
    background: var(--key-op);
  }
  .key.fn {
    background: var(--key-fn);
    font-size: 17px;
  }
  .key.ctl {
    background: var(--key-ctl);
    font-size: 16px;
  }
  .key.nav {
    min-height: 36px;
    background: var(--key-nav);
    font-size: 15px;
  }
  .key.enter {
    background: var(--key-enter);
    color: #fff;
    font-size: 16px;
  }
  .shiftlegend {
    position: absolute;
    top: 2px;
    right: 6px;
    font-size: 11px;
    color: var(--shift);
  }
  .alphalegend {
    position: absolute;
    top: 2px;
    left: 6px;
    font-size: 11px;
    color: var(--alpha);
  }
  .shifted .main {
    color: var(--shift);
  }
  .alphaed .main {
    color: var(--alpha);
  }
  .key[aria-pressed="true"] {
    outline: 2px solid var(--shift);
  }
  .alphaed .key[data-key="alpha"][aria-pressed="true"] {
    outline-color: var(--alpha);
  }
  .key[data-locked="true"] {
    outline-width: 3px;
    background: color-mix(in srgb, var(--alpha) 25%, transparent);
  }
</style>
