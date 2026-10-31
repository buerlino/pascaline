// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the units key (Shift + Tmpl, a flick up on Tmpl) opens the unit view in the entry line's place (docs/04 4.3,
// docs/archive/r9-unit-pad.md 2.1): the line (or a picked row's input) read-only with its slots, the pad up on the
// keys (R24b). Key owners while it is up (docs/04 5.5): an open sheet (Find on units), then the pad's cells
// (UnitPad.route), then this view for the keys that are no cell (◀ ▶ between slots, Esc leaves and the line keeps its
// slots, a key that changes place leaves first; any other key is dead). A hardware key on the field takes the keypad's
// path through the entry line's own map (entry/hwkeys.ts, `onKey`), so it reaches the pad's actions or does nothing, and
// does on the field what it does on the line. The view writes a slot only with setPromptValue. What it takes from the
// start chunk is the route context `c` alone, so the start chunk holds only the units key's import (R24c).
// A lazy chunk: route.ts imports it on the first press of the units key. units/pad.ts is in it (a static import: as a
// chunk of its own beside this one, the two imported each other through units/padView, and Rolldown then split Svelte's
// runtime out of the start chunk, +1.1 kB gzip at start).
import type { MathfieldElement } from "mathlive";
import { unitText } from "../i18n/enUnits.ts";
import type { Key } from "../keyboard/keyboard.ts";
import type { Mods, RouteCtx } from "../keyboard/route.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { UnitPad } from "./pad.ts";
import { unitPad } from "./padView.svelte.ts";
import { slotCatalogue } from "./slot.ts";
import { makePanel } from "./panel.ts";
import { UnitView, type ViewHost } from "./view.ts";

/** The open unit view (window.pascaline.unitView in the e2e). */
export interface OpenUnitView {
  readonly view: UnitView;
  readonly field: MathfieldElement;
  /** The view's own element: it holds the focus and takes the hardware keys (not editable: no system keyboard). */
  readonly element: HTMLElement;
  /** Leave; the line keeps its slots. */
  close(): void;
}

let current: OpenUnitView | null = null;

/** Keys that change place: the unit view closes first, then they do their job. */
const PLACES: readonly string[] = ["home", "cas", "switch", "apps", "symb", "plot", "num", "settings", "mode"];

/** Open the unit view on the line, or on a picked history row's input (it becomes the line). Dead in an app. */
export async function openUnits(c: RouteCtx, row?: HistoryItem): Promise<void> {
  const entryEl = document.querySelector<HTMLElement>(".entry");
  const fieldEl = entryEl?.querySelector<HTMLElement>(".field");
  if (current || c.shell.app !== null || !entryEl || !fieldEl) return c.dead();
  if (row) c.entry.set(row.latex, row.chips);
  const line = c.entry.value;
  const chips = c.entry.chips;
  // MathLive comes with the entry line (its field is up once `ready`): the class is taken from the element registry
  const [, index, hw] = await Promise.all([c.entry.ready, import("../find/finder.ts").then((m) => m.loadIndex(true)), import("../entry/hwkeys.ts")]);
  const Field = customElements.get("math-field") as typeof MathfieldElement | undefined;
  if (!Field) return c.dead();
  const mf = new Field();
  mf.dataset["testid"] = "unit-field";
  const host: ViewHost = {
    write: (id, latex) => mf.setPromptValue(id, latex, {}),
    evaluate: (req) => c.shell.calc.units(req, c.session.settings),
    find: () => void showUnitFind(c, view),
    dead: () => c.dead(),
    changed: () => panel.draw(),
  };
  let made: UnitView | undefined;
  const panel = makePanel(() => made);
  const view = new UnitView(slotCatalogue(index.items), line, chips, host);
  made = view;
  entryEl.insertBefore(panel.element, fieldEl);
  fieldEl.style.display = "none";
  panel.draw();
  // MathLive takes options only once the field is mounted (as the entry line's, entry/controller.ts)
  const mounted = new Promise<void>((resolve) => {
    mf.addEventListener("mount", () => resolve(), { once: true });
    setTimeout(resolve, 1000);
  });
  const element = panel.element;
  panel.formula.append(mf);
  await mounted;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  setUp(mf, element, c, hw);
  mf.value = view.formula.latex;
  // locked: MathLive edits no prompt itself (and gives a tap on the field no focus); setPromptValue still writes
  for (const id of view.ids) mf.setPromptState(id, "undefined", true);
  view.start();

  const close = (): void => {
    if (current?.view !== view) return;
    current = null;
    view.keep();
    unitPad.model = null;
    unitPad.on = () => {};
    unitPad.other = undefined;
    element.remove();
    fieldEl.style.display = "";
    window.pascaline.unitView = undefined;
    c.entry.focus();
  };
  current = { view, field: mf, element, close };
  window.pascaline.unitView = current;
  // every press keeps the focus on the view (as the entry line's keys keep it on the line), for the hardware keys
  const keep = (): void => element.focus({ preventScroll: true });
  unitPad.on = (e) => {
    view.apply(e);
    if (current?.view === view && e.do !== "find") keep();
  };
  unitPad.other = (c2, key, mods) => {
    const a = layerAction(key, mods);
    if (a?.kind === "special" && PLACES.includes(a.name)) {
      close();
      return false; // the key does its job
    }
    c2.session.clearModifiers();
    if (a?.kind === "cmd" && a.name === "moveToPreviousChar") view.move(-1);
    else if (a?.kind === "cmd" && a.name === "moveToNextChar") view.move(1);
    else if (a?.kind === "special" && a.name === "esc") close();
    else c2.dead();
    if (current?.view === view) keep();
    return true;
  };
  unitPad.model = new UnitPad();
  element.focus();
}

/** The action of a key that is no cell, in the layer it was pressed in (keyboard.ts actionFor, for the keys the view
 *  reads: ◀ ▶, Esc and the place keys; Alpha falls back to the tap). */
function layerAction(key: Key, mods: Mods): Key["actions"]["primary"] {
  return mods.alpha ? (key.actions.alpha ?? key.actions.primary) : mods.shift ? key.actions.shift : key.actions.primary;
}

/** The field: read-only, never MathLive's keyboard nor the system keyboard (inputmode none, as the entry line), with
 *  the entry line's macros (chips, ᴇ). The view's element holds the focus (tabindex -1, nothing editable in it, so no system
 *  keyboard) and its capture keydown sends a hardware key down the keypad's path, from the field too; a paste, a drop,
 *  a cut and the browser's own text input (an IME) are stopped. MathLive's own beforeinput for setPromptValue is not
 *  trusted and goes through (cancelling it would cancel the write). */
function setUp(mf: MathfieldElement, element: HTMLElement, c: RouteCtx, hw: Hw): void {
  mf.mathVirtualKeyboardPolicy = "manual";
  mf.menuItems = [];
  mf.inlineShortcuts = {};
  mf.macros = c.entry.field?.macros ?? mf.macros; // the entry line's, with ENTRY_MACROS (it is up: entry.ready)
  mf.readOnly = true;
  const enforce = (): void => {
    for (const el of mf.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
      el.setAttribute("inputmode", "none");
      el.setAttribute("virtualkeyboardpolicy", "manual");
    }
  };
  enforce();
  mf.addEventListener("focusin", enforce);
  element.addEventListener("keydown", (ev) => hardwareKey(ev, c, hw), { capture: true });
  const stop = (ev: Event): void => {
    if (ev.type === "beforeinput" && !ev.isTrusted) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  for (const type of ["paste", "drop", "cut", "beforeinput"]) element.addEventListener(type, stop, { capture: true });
}

type Hw = typeof import("../entry/hwkeys.ts");

/** A hardware key on the unit view's field: the keypad key it stands for, pressed as a tap through the entry line's
 *  own path (`onKey`) and map (entry/hwkeys.ts: ⌫, Del, the arrows, Enter, Esc, and the characters a keypad key types:
 *  a digit is its prefix cell); anything else does nothing. Copy and select all stay MathLive's. */
function hardwareKey(ev: KeyboardEvent, c: RouteCtx, hw: Hw): void {
  if (ev.isComposing) return;
  const mod = (ev.ctrlKey || ev.metaKey || ev.altKey) && !ev.getModifierState("AltGraph");
  if (mod && (ev.key === "c" || ev.key === "a")) return;
  if (ev.key === "Tab" || ev.key === "Shift" || ev.key === "Control" || ev.key === "Alt" || ev.key === "Meta") return;
  ev.preventDefault();
  ev.stopPropagation();
  if (mod) return c.dead();
  const k = hw.controlKey(ev) ?? (ev.key.length === 1 ? hw.keypadKeyOf(ev.key, c.entry.decimalComma) : undefined);
  if (k) c.entry.onKey(k[0], k[1], ev.repeat);
  else c.dead();
}

/** Math in a slot: Find on units (its Units category; docs/archive/r9-unit-pad.md 2.9). A unit's pick goes into the
 *  slot, a prefix's arms it. */
async function showUnitFind(c: RouteCtx, view: UnitView): Promise<void> {
  const m = await import("../find/finder.ts");
  const index = await m.loadIndex(true);
  const { categories } = m.findMenu(index, (it) => {
    const id = it.id.slice(it.kind.length + 1); // ("unit:m", "pfx:k")
    if (it.kind === "unit") view.apply({ do: "unit", id });
    else if (it.kind === "pfx") view.apply({ do: "prefix", id });
    else c.dead();
  });
  const units = categories.find((x) => x.id === "cat:units")?.submenu;
  if (!units) return c.dead();
  c.shell.showFind(unitText("units.pad.find"), units.items, units.search ?? (() => []));
}
