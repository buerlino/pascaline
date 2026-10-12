<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { PAD_KEYS, Stepper, type PadDir } from "./gestures.ts";
  import { gridPlace, keyboard, labelFor, pythonLabel, type Key, type Layer } from "./keyboard.ts";

  let {
    shift,
    alpha,
    alphaLock = false,
    python = false,
    onpress,
    ontouch = () => {},
  }: {
    shift: boolean;
    alpha: boolean;
    alphaLock?: boolean;
    python?: boolean;
    /** A key fires; `layer` overrides the Shift/Alpha state (trackpad steps, flicks). */
    onpress: (key: Key, layer?: Layer) => void;
    /** A finger went down, or a gesture made a step: the haptic tick. */
    ontouch?: () => void;
  } = $props();

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

  // ---- gestures (docs/decisions.md P7). One pointer handler on the whole pad, one gesture per finger.
  // The trackpad (K1): the four arrow keys are its tap zones; a drag steps in 2D (gestures.ts), a tap is one step.
  const isPadKey = (k: Key): boolean => (PAD_KEYS as readonly string[]).includes(k.id);
  const padArea = ((): { rows: string; cols: string } | undefined => {
    const keys = keyboard.keys.filter(isPadKey);
    if (keys.length === 0) return undefined;
    const rows = keys.map((k) => k.row);
    const starts = keys.map((k) => gridPlace(keyboard, k).start);
    const ends = keys.map((k) => gridPlace(keyboard, k).start + gridPlace(keyboard, k).span);
    return { rows: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, cols: `${Math.min(...starts)} / ${Math.max(...ends)}` };
  })();

  type Gesture = { kind: "pad"; key: Key | undefined; x0: number; y0: number; steps: Stepper };
  const gestures = new Map<number, Gesture>();
  let padEl: HTMLDivElement | undefined = $state();

  function targetOf(ev: PointerEvent): Key | "pad" | undefined {
    const el = ev.target instanceof Element ? ev.target.closest<HTMLElement>("[data-key],[data-trackpad]") : null;
    if (!el) return undefined;
    if (el.dataset["trackpad"] !== undefined) return "pad";
    return keyboard.byId.get(el.dataset["key"] ?? "");
  }

  function down(ev: PointerEvent): void {
    // the keys never take focus, so the caret stays in the entry line
    ev.preventDefault();
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    // a second finger finishes the first one's gesture, so fast two-thumb typing keeps its order
    for (const g of gestures.values()) finish(g);
    gestures.clear();
    const target = targetOf(ev);
    if (!target) return;
    ontouch();
    if (target !== "pad" && !isPadKey(target)) return onpress(target);
    try {
      padEl?.setPointerCapture(ev.pointerId);
    } catch {
      // a synthetic event without an active pointer: the gesture still works while the finger stays on the pad
    }
    gestures.set(ev.pointerId, { kind: "pad", key: target === "pad" ? undefined : target, x0: ev.clientX, y0: ev.clientY, steps: new Stepper() });
  }

  function move(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    for (const dir of g.steps.move(ev.clientX - g.x0, ev.clientY - g.y0)) step(dir);
  }

  function step(dir: PadDir): void {
    const key = keyboard.byId.get(dir);
    if (!key) return;
    ontouch();
    onpress(key, "primary");
  }

  function up(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    move(ev);
    gestures.delete(ev.pointerId);
    finish(g);
  }

  /** The finger lifts (or another one comes down): a trackpad touch without a step was a tap on its zone. */
  function finish(g: Gesture): void {
    if (g.steps.count === 0 && g.key) onpress(g.key);
  }
</script>

<div
  class="pad"
  class:shifted={shift}
  class:alphaed={alpha}
  style:grid-template-columns={`repeat(${keyboard.units}, 1fr)`}
  bind:this={padEl}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={(ev) => gestures.delete(ev.pointerId)}
  onclick={(ev) => ev.preventDefault()}
  role="presentation"
>
  {#if padArea}<div class="trackpad" data-trackpad style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#each keyboard.keys as key (key.id)}
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.cls === "ctl" && (key.id === "shift" || key.id === "alpha") ? pressed(key) : undefined}
      data-locked={key.id === "alpha" && alphaLock ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={`${gridPlace(keyboard, key).start} / span ${gridPlace(keyboard, key).span}`}
      data-reserved={key.actions.primary?.kind === "special" && key.actions.primary.name === "none" ? "true" : undefined}
      data-zone={isPadKey(key) ? "true" : undefined}
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
    /* no scrolling or zooming from the pad: every touch is a key, a flick or a trackpad drag */
    touch-action: none;
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
  /* the trackpad and Cancel in the upper cluster: as low as the app keys beside them */
  .key[data-key="cancel"],
  .key[data-zone="true"] {
    min-height: 36px;
  }
  /* the trackpad (K1): one surface under the four arrow keys, which stay as its tap zones */
  .trackpad {
    border-radius: 12px;
    background: var(--key-ctl);
  }
  .key[data-zone="true"] {
    background: transparent;
    opacity: 0.7;
  }
  .key[data-zone="true"]:active {
    filter: none;
    opacity: 1;
  }
  /* a key whose function we don't have yet: only its letter matters */
  .key[data-reserved="true"] .main {
    opacity: 0.4;
    font-size: 14px;
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
