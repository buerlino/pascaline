// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4: the first-start tips. This module and tips.css are one lazy chunk, loaded only when the tips are due
// (state/tips.ts, decided in the start chunk) or when Settings › Help and about asks for them again. Plain DOM, not a
// Svelte component: a component would pull Svelte's runtime functions it alone uses into the start chunk.
//
// It dims the screen, rings the place name and ☰ from their boxes, and says what each opens. Any tap or key closes it
// and does nothing else; Android back closes it (openLayer).
import "./tips.css";
import { tipsText as tr } from "../i18n/enTips.ts";
import { openLayer } from "../input/backLayer.ts";
import { markTipsSeen } from "../state/tips.ts";

const PAD = 4;
const SVG = "http://www.w3.org/2000/svg";
let release: (() => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, parent?: Node): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent: Node): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}

/** Put the tips on the page (once at a time). */
export function showTips(): void {
  if (release) return;
  markTipsSeen();
  const root = el("div", "tips", undefined, document.body);
  root.dataset["testid"] = "tips";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", tr("tips.title"));

  // the dimmed screen, with a hole at each ring
  const dim = svg("svg", { class: "dim", "aria-hidden": "true" }, root);
  const mask = svg("mask", { id: "tips-dim" }, svg("defs", {}, dim));
  svg("rect", { width: "100%", height: "100%", fill: "white" }, mask);
  svg("rect", { width: "100%", height: "100%", mask: "url(#tips-dim)" }, dim);
  const cards = el("div", "cards", undefined, root);
  [tr("tips.place"), tr("tips.menu")].forEach((line, i) => {
    const p = el("p", "tip", undefined, cards);
    el("span", "n", String(i + 1), p).setAttribute("aria-hidden", "true");
    p.append(line);
  });
  const gotIt = el("button", "gotit", tr("tips.gotIt"), cards);
  gotIt.type = "button";
  gotIt.dataset["testid"] = "tips-got-it";

  // the rings sit on the controls' boxes, measured now and whenever the screen changes size
  const rings: HTMLElement[] = [];
  const holes: SVGRectElement[] = [];
  const measure = (): void => {
    let bottom = 0;
    (["place", "menu"] as const).forEach((id, i) => {
      const r = document.querySelector(`[data-tip="${id}"]`)?.getBoundingClientRect();
      if (!r || r.width <= 0) return;
      // padded, but never off the screen (a ring over the screen's edge would lose its border there)
      const x = Math.max(2, r.left - PAD), y = Math.max(2, r.top - PAD);
      const box = { x, y, w: Math.min(innerWidth - 2, r.right + PAD) - x, h: r.bottom + PAD - y };
      let ring = rings[i];
      if (!ring) {
        ring = rings[i] = el("div", "ring", undefined, root);
        ring.dataset["testid"] = `tips-ring-${id}`;
        el("span", "n", String(i + 1), ring).setAttribute("aria-hidden", "true");
        holes[i] = svg("rect", { rx: "10", fill: "black" }, mask);
      }
      Object.assign(ring.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
      for (const [k, v] of Object.entries({ x: box.x, y: box.y, width: box.w, height: box.h })) holes[i]?.setAttribute(k, String(v));
      bottom = Math.max(bottom, box.y + box.h);
    });
    cards.style.top = `${bottom + 14}px`;
  };
  measure();
  const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
  ro?.observe(document.documentElement);

  const close = (): void => {
    if (!release) return;
    const done = release;
    release = null;
    for (const [type, f] of on) window.removeEventListener(type, f as EventListener, opts);
    ro?.disconnect();
    root.remove();
    done();
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
  release = openLayer(close);
}
