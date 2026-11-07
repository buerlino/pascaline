// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad text never gets cut and never overlaps (docs/05 3.7, U0): every face and legend marked `data-fit` is
// shrunk until it fits its key. One rule for all keys and layers; no per-key sizes.

/** Smallest size (px) a face or legend may shrink to. Anything that still does not fit at this size is a bug in the layout, which the keypad e2e test catches. */
export const MIN_FACE_PX = 9;
export const MIN_LEGEND_PX = 8;

/** A legend's font is at most this many times its line's height: the design's own largest ratio (11 px in the 10 px line of a short screen). */
const LEGEND_MAX_EM = 1.1;

/**
 * Fit the faces and legends of every key under `pad`. A face and each legend may use the key's width minus its side
 * padding, and (R41, the Android font scale) its own line: a face the room between the two legend lines of a key, a
 * legend its line's height, so a larger system font never makes a face rise into a legend or a legend overlap its face.
 * Passes, so the browser lays out as seldom as it can: reset with the faces shrunk to nothing and measure the room,
 * reset and measure the text, write.
 */
export function fitLegends(pad: HTMLElement): void {
  const keys = [...pad.querySelectorAll<HTMLElement>(".key")];
  const items: { el: HTMLElement; legend: boolean; key: HTMLElement; base: number }[] = [];
  for (const key of keys)
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
      const legend = el.dataset["fit"] === "legend";
      el.style.fontSize = legend ? "" : "1px"; // a face of 1 px leaves the key at its own height
      items.push({ el, legend, key, base: 0 });
    }
  // measure the room: the key's height less its padding and its legend lines is the face's line
  const lineH = new Map<HTMLElement, number>();
  for (const key of keys) {
    const cs = getComputedStyle(key);
    let room = key.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const legends = [...key.querySelectorAll<HTMLElement>("[data-fit='legend']")];
    for (const el of legends) {
      const h = el.getBoundingClientRect().height;
      room -= h;
      lineH.set(el, h * LEGEND_MAX_EM);
    }
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit='face']")) lineH.set(el, room);
  }
  for (const it of items) if (!it.legend) it.el.style.fontSize = "";
  // measure the text
  const natural = new Map<HTMLElement, number>();
  const cap = new Map<HTMLElement, number>();
  for (const it of items) {
    const cs = getComputedStyle(it.el);
    it.base = parseFloat(cs.fontSize);
    if (it.legend) cap.set(it.el, lineH.get(it.el) ?? 0);
    else {
      // the face's line is its font size times the line-height ratio (1.1, or 1 in a letter row of a short screen)
      const ratio = parseFloat(cs.lineHeight) / it.base;
      cap.set(it.el, (lineH.get(it.el) ?? 0) / (ratio > 0 ? ratio : 1.2));
    }
    // an element is as wide as its text here (white-space: nowrap, a flex or grid item): scrollWidth is its content width
    natural.set(it.el, it.el.scrollWidth);
  }
  const avail = new Map<HTMLElement, number>();
  for (const key of keys) {
    const cs = getComputedStyle(key);
    const inner = key.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // each legend has its own line (the shift function above the face, the letter below it): the key's whole width
    // R143: the menu mark ▾ hangs after the text out of the flow (scrollWidth counts it): it may use 6 px of the key's side padding, so the mark does not shrink the text
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) avail.set(el, inner + (el.dataset["opens"] ? 6 : 0));
  }
  // write
  for (const it of items) {
    const w = natural.get(it.el) ?? 0;
    const room = avail.get(it.el) ?? 0;
    const line = cap.get(it.el) ?? 0;
    let size = it.base;
    if (w > 0 && w > room) size = Math.min(size, (it.base * room) / w);
    if (line > 0) size = Math.min(size, line);
    size = Math.floor(size * 10) / 10;
    if (size >= it.base) continue;
    it.el.style.fontSize = `${Math.max(it.legend ? MIN_LEGEND_PX : MIN_FACE_PX, size)}px`;
  }
}
