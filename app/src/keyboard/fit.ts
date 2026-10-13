// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad text never gets cut and never overlaps (docs/05 3.7, U0): every face and legend marked `data-fit` is
// shrunk until it fits its key. One rule for all keys and layers; no per-key sizes.

/** Smallest size (px) a face or legend may shrink to. Anything that still does not fit at this size is a bug in the layout, which the keypad e2e test catches. */
export const MIN_FACE_PX = 9;
export const MIN_LEGEND_PX = 8;

/**
 * Fit the faces and legends of every key under `pad`. Three passes so the browser lays out once: reset, measure,
 * write. A face may use the key's width minus its side padding; the two legends share the same width.
 */
export function fitLegends(pad: HTMLElement): void {
  const keys = [...pad.querySelectorAll<HTMLElement>(".key")];
  const items: { el: HTMLElement; legend: boolean; key: HTMLElement; base: number }[] = [];
  for (const key of keys)
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
      el.style.fontSize = "";
      items.push({ el, legend: el.dataset["fit"] === "legend", key, base: 0 });
    }
  // measure
  const natural = new Map<HTMLElement, number>();
  for (const it of items) {
    it.base = parseFloat(getComputedStyle(it.el).fontSize);
    // an element is as wide as its text here (white-space: nowrap, a flex or grid item): scrollWidth is its content width
    natural.set(it.el, it.el.scrollWidth);
  }
  const avail = new Map<HTMLElement, number>();
  for (const key of keys) {
    const cs = getComputedStyle(key);
    const inner = key.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const legends = [...key.querySelectorAll<HTMLElement>('[data-fit="legend"]')];
    const [a, s] = [legends[0], legends[1]];
    const face = key.querySelector<HTMLElement>('[data-fit="face"]');
    if (face) avail.set(face, inner);
    // legends: the two share the line; each gets its natural width when both fit, else a share in proportion
    const wa = a ? (natural.get(a) ?? 0) : 0;
    const ws = s ? (natural.get(s) ?? 0) : 0;
    const gap = 2;
    const room = inner - (wa > 0 && ws > 0 ? gap : 0);
    const scale = wa + ws > room ? room / (wa + ws) : 1;
    if (a) avail.set(a, wa * scale);
    if (s) avail.set(s, ws * scale);
  }
  // write
  for (const it of items) {
    const w = natural.get(it.el) ?? 0;
    const room = avail.get(it.el) ?? 0;
    if (w <= 0 || w <= room) continue;
    const size = Math.max(it.legend ? MIN_LEGEND_PX : MIN_FACE_PX, Math.floor((it.base * room) / w * 10) / 10);
    it.el.style.fontSize = `${size}px`;
  }
}
