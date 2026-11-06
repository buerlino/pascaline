// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's panel in the entry line's place (docs/04 4.3): the read-only formula with its slots (the
// field, made by units/open.ts), the reading of the active slot in words under it, then a refusal or the result as
// Calc.units() returns it (R62: the value line, σ, the note and the alternatives row, units/result.ts). Plain DOM over the
// view's state (a change calls `draw`).
// Loaded with the unit view.
import "./panel.css";
import { unitText } from "../i18n/enUnits.ts";
import type { UnitShown } from "./result.ts";
import type { UnitView } from "./view.ts";
import type { MarkStyle } from "../state/session.svelte.ts";

function el(tag: string, cls: string, testid?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (testid) e.dataset["testid"] = testid;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The value line, σ's lines, the note and the alternatives row of a result (`docs/mockups/unit-result.html` at `b1c44ee4`). */
function resultRows(s: UnitShown, v: UnitView, fit: (row: HTMLElement) => void): HTMLElement[] {
  const r = el("div", "result", "unit-result");
  r.dataset["text"] = s.display;
  r.dataset["unit"] = s.unit;
  const mark = el("span", "mark", "unit-mark", s.markText);
  mark.dataset["mark"] = s.mark;
  const value = el("span", "value");
  if (s.sigma) {
    value.append(s.sigma.head);
    if (s.warn) value.append(el("span", "warn", "unit-warn", "⚠"));
    value.append(s.sigma.tail);
  } else {
    value.append(s.text);
    if (s.warn) value.append(el("span", "warn", "unit-warn", "⚠"));
  }
  r.append(mark, value);
  if (s.unit) r.append(el("span", "unit", "unit-unit", s.unit));
  if (s.dim) r.append(el("span", "dim", "unit-dim", s.dim));
  const out = [r];
  if (s.sub) out.push(el("div", "sub", "unit-sub", s.sub));
  if (s.why) out.push(el("div", "why", "unit-why", s.why));
  if (s.note) out.push(el("div", "note", "unit-note", s.note));
  if (s.names) out.push(el("div", "note", "unit-names", s.names));
  if (s.dimension !== "") {
    const row = el("div", "alts", "unit-alts");
    row.setAttribute("role", "toolbar");
    row.setAttribute("aria-label", unitText("units.result.alts"));
    const chip = (text: string, i: number, testid: string, cls: string): HTMLElement => {
      const b = el("button", `alt ${cls}`, testid, text);
      b.tabIndex = -1;
      b.dataset["i"] = `${i}`;
      b.addEventListener("pointerdown", (e) => e.preventDefault()); // the view keeps the focus (hardware keys)
      b.addEventListener("click", () => void v.pick(i));
      return b;
    };
    s.alts.forEach((a, i) => row.append(chip(a.text, i, "unit-alt", "")));
    const more = chip(unitText("units.result.more"), s.alts.length, "unit-more", "more");
    more.setAttribute("aria-label", unitText("units.result.moreLabel"));
    row.append(more);
    out.push(row);
    queueMicrotask(() => fit(row));
  }
  return out;
}

export interface Panel {
  /** The panel (it holds the focus: tabindex -1, nothing editable in it). */
  readonly element: HTMLElement;
  /** Where the field goes. */
  readonly formula: HTMLElement;
  /** Draw the view's state again. */
  draw(): void;
}

/** The panel for `view`, not yet on the page. `marks` (R124): Settings › Numbers › Marks, which panel.css follows. */
export function makePanel(view: () => UnitView | undefined, marks: () => MarkStyle = () => "reason"): Panel {
  const element = el("div", "unitview", "unit-view");
  element.tabIndex = -1;
  const formula = el("div", "formula");
  const reading = el("div", "reading", "unit-reading");
  const below = el("div", "below");
  element.append(formula, reading, below);
  /** Hide the chips that do not fit beside "More…" (at least as many as the view can use) and tell the view how many fit. */
  const fitRow = (row: HTMLElement): void => {
    const v = view();
    const chips = [...row.querySelectorAll<HTMLElement>(".alt:not(.more)")];
    const more = row.querySelector<HTMLElement>(".more");
    if (!v || !more) return;
    let n = chips.length;
    if (row.isConnected && row.clientWidth > 0) {
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      let used = more.offsetWidth;
      n = 0;
      for (const c of chips) {
        if (used + gap + c.offsetWidth > row.clientWidth) break;
        used += gap + c.offsetWidth;
        n++;
      }
      v.fit = n;
    }
    chips.forEach((c, i) => {
      c.hidden = i >= n;
      c.toggleAttribute("data-focus", v.row === i);
    });
    more.toggleAttribute("data-focus", v.row === n);
    row.dataset["fit"] = `${n}`;
  };
  /** The state `below` was built from: a draw with the same state (▼, ▲, a new width) keeps its elements and refits the
   *  row, since a chip replaced under a finger drops its tap (G153 fix round 1: a tap on the knot chip did nothing). */
  let built: UnitView["shown"] | undefined;
  const draw = (): void => {
    const v = view();
    if (!v) return;
    element.dataset["slot"] = v.activeId;
    element.dataset["marks"] = marks();
    reading.replaceChildren(...v.reading.parts.flatMap((p, i) => [...(i ? [" "] : []), el("span", p.marked ? "rare" : "", undefined, p.text)]));
    const s = v.shown;
    if (s === built) {
      const row = below.querySelector<HTMLElement>(".alts");
      if (row) fitRow(row);
      return;
    }
    built = s;
    const out: HTMLElement[] = [];
    if (s.kind === "message") {
      const m = el("div", "message", "unit-message", s.text);
      m.setAttribute("role", "alert");
      out.push(m);
    } else if (s.kind === "working") out.push(el("div", "working", "unit-working", unitText("units.view.working")));
    else if (s.kind === "result") out.push(...resultRows(s, v, fitRow));
    below.replaceChildren(...out);
  };
  // a new width changes how many chips fit (the first callback is the size at the start: the draws measure it themselves)
  let width = -1;
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => {
      const was = width;
      width = element.clientWidth;
      if (was >= 0 && width !== was) draw();
    }).observe(element);
  return { element, formula, draw };
}
