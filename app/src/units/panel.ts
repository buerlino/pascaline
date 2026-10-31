// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's panel in the entry line's place (docs/04 4.3): the read-only formula with its slots (the
// field, made by units/open.ts), the reading of the active slot in words under it, then a refusal or the result as
// Calc.units() returns it (the full result view is R62's). Plain DOM over the view's state (a change calls `draw`).
// Loaded with the unit view.
import "./panel.css";
import { unitText } from "../i18n/enUnits.ts";
import type { UnitView } from "./view.ts";

function el(tag: string, cls: string, testid?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (testid) e.dataset["testid"] = testid;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface Panel {
  /** The panel (it holds the focus: tabindex -1, nothing editable in it). */
  readonly element: HTMLElement;
  /** Where the field goes. */
  readonly formula: HTMLElement;
  /** Draw the view's state again. */
  draw(): void;
}

/** The panel for `view`, not yet on the page. */
export function makePanel(view: () => UnitView | undefined): Panel {
  const element = el("div", "unitview", "unit-view");
  element.tabIndex = -1;
  const formula = el("div", "formula");
  const reading = el("div", "reading", "unit-reading");
  const below = el("div", "below");
  element.append(formula, reading, below);
  const draw = (): void => {
    const v = view();
    if (!v) return;
    element.dataset["slot"] = v.activeId;
    reading.replaceChildren(...v.reading.parts.flatMap((p, i) => [...(i ? [" "] : []), el("span", p.marked ? "rare" : "", undefined, p.text)]));
    const s = v.shown;
    const out: HTMLElement[] = [];
    if (s.kind === "message") {
      const m = el("div", "message", "unit-message", s.text);
      m.setAttribute("role", "alert");
      out.push(m);
    } else if (s.kind === "working") out.push(el("div", "working", "unit-working", unitText("units.view.working")));
    else if (s.kind === "result") {
      const r = el("div", "result", "unit-result");
      r.dataset["text"] = s.display;
      r.dataset["unit"] = s.unit;
      r.append(el("span", "mark", undefined, s.mark), el("span", "value", undefined, s.text));
      if (s.unit) r.append(el("span", "unit", undefined, s.unit));
      if (s.warn) r.append(el("span", "warn", "unit-warn", "⚠"));
      out.push(r);
      if (s.why) out.push(el("div", "why", "unit-why", s.why));
      if (s.note) out.push(el("div", "note", "unit-note", s.note));
    }
    below.replaceChildren(...out);
  };
  return { element, formula, draw };
}
