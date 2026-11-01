<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R15c4: the first-start tips. A lazy chunk (App.svelte loads it when the profile has not seen the tips, or when
  // Settings › Help and about asks for them again). It dims the screen, rings the place name and ☰ from their boxes, and
  // says what each opens. Any tap or key closes it and does nothing else; Android back closes it (openLayer).
  import { onMount } from "svelte";
  import { tipsText as tr } from "../i18n/enTips.ts";
  import { openLayer } from "../input/backLayer.ts";
  import { markTipsSeen } from "../state/tips.ts";

  let { onclose }: { onclose: () => void } = $props();

  type Ring = { id: "place" | "menu"; x: number; y: number; w: number; h: number };
  const PAD = 4;
  let rings = $state<Ring[]>([]);
  const uid = `tips-dim-${Math.random().toString(36).slice(2, 8)}`;

  /** The rings sit on the controls' boxes, measured now and again whenever the screen changes size. */
  function measure(): void {
    const found: Ring[] = [];
    for (const id of ["place", "menu"] as const) {
      const r = document.querySelector(`[data-tip="${id}"]`)?.getBoundingClientRect();
      if (r && r.width > 0) found.push({ id, x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD });
    }
    rings = found;
  }
  const below = $derived(rings.reduce((m, r) => Math.max(m, r.y + r.h), 0) + 14);
  const NAMES = ["place", "menu"] as const;

  onMount(() => {
    markTipsSeen();
    measure();
    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      onclose();
    };
    // Everything is taken here, before the app sees it: a key or a tap closes the tips and does nothing else. A click
    // closes only after a pointer went down since the tips came up (the click of the press that opened them is not ours).
    let armed = false;
    const swallow = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const key = (e: KeyboardEvent): void => {
      swallow(e);
      if (e.type === "keydown") close();
    };
    const down = (e: Event): void => {
      armed = true;
      swallow(e);
    };
    const click = (e: Event): void => {
      swallow(e);
      if (armed) close();
    };
    const opts = { capture: true, passive: false } as const;
    const on: [string, (e: never) => void][] = [["keydown", key], ["keyup", key], ["keypress", key], ["pointerdown", down], ["click", click]];
    for (const [type, f] of on) window.addEventListener(type, f as EventListener, opts);
    const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    ro?.observe(document.documentElement);
    const release = openLayer(close);
    return () => {
      for (const [type, f] of on) window.removeEventListener(type, f as EventListener, opts);
      ro?.disconnect();
      release();
    };
  });
</script>

<div class="tips" data-testid="tips" role="dialog" aria-modal="true" aria-label={tr("tips.title")}>
  <svg class="dim" aria-hidden="true">
    <defs>
      <mask id={uid}>
        <rect width="100%" height="100%" fill="white" />
        {#each rings as r (r.id)}<rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="black" />{/each}
      </mask>
    </defs>
    <rect width="100%" height="100%" mask="url(#{uid})" />
  </svg>
  {#each rings as r, i (r.id)}
    <div class="ring" data-testid="tips-ring-{r.id}" style:left="{r.x}px" style:top="{r.y}px" style:width="{r.w}px" style:height="{r.h}px">
      <span class="n" aria-hidden="true">{i + 1}</span>
    </div>
  {/each}
  <div class="cards" style:top="{below}px">
    {#each NAMES as name, i (name)}
      <p class="tip"><span class="n" aria-hidden="true">{i + 1}</span>{tr(`tips.${name}`)}</p>
    {/each}
    <button type="button" class="gotit" data-testid="tips-got-it">{tr("tips.gotIt")}</button>
  </div>
</div>

<style>
  .tips {
    position: fixed;
    inset: 0;
    z-index: 50;
    animation: fade 160ms ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tips {
      animation: none;
    }
  }
  .dim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: rgba(8, 12, 24, 0.7);
  }
  .ring {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid #fff;
    border-radius: 10px;
    pointer-events: none;
  }
  .n {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    color: #0b1020;
    font: 700 12px/1 system-ui, sans-serif;
    flex: none;
  }
  .ring .n {
    position: absolute;
    right: -6px;
    bottom: -9px;
  }
  .cards {
    position: absolute;
    left: 16px;
    right: 16px;
    max-width: 420px;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tip {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 12px 14px;
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 16px;
    line-height: 1.3;
  }
  .gotit {
    align-self: flex-end;
    min-height: 44px;
    padding: 0 22px;
    border: 0;
    border-radius: 10px;
    background: var(--key-enter);
    color: var(--on-enter);
    font: inherit;
    font-weight: 600;
  }
</style>
