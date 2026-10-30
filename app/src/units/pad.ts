// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad (spec/unit-pad.yaml, docs/archive/r9-unit-pad.md section 1) as data: which cell lies on which key,
// what its tap, flick up and flick down show, and which pad action each gives (R24a's PadAction). Plain TS, loaded
// lazily with the unit view (units/padView.svelte.ts), never in the start chunk. The keypad draws a cell as the face
// and legends of its own key (`key`, read through sheetChunk.pad), so a cell cannot miss its key and fit.ts fits it
// like any legend; a press goes through the keypad's gesture code and reaches `press` by key id and layer
// (keyboard/route.ts).
import raw from "../../../spec/unit-pad.yaml";
import { unitText } from "../i18n/enUnits.ts";
import type { Action, Key } from "../keyboard/keyboard.ts";
import type { Mods, RouteCtx } from "../keyboard/route.ts";
import { unitPad } from "./padView.svelte.ts";
import type { PadAction } from "./slot.ts";

/** What a pad press hands on: R24a's actions, plus the keys that are not the slot's: Find (Math), the next slot
 *  (Enter), evaluate now (Enter, flick up), and × (units in a row multiply: it changes nothing, but it is a press). */
export type PadEmit = PadAction | { do: "find" | "next" | "evaluate" | "times" };

export type PadLayer = "primary" | "shift" | "alpha";
export type CellKind = "prefix" | "unit" | "op" | "keep" | "user";

/** One leg of a cell: the text on the key and what a press of it emits. */
export interface Leg {
  text: string;
  emit: PadEmit;
}

export interface PadCell {
  key: string;
  kind: CellKind;
  tap?: Leg;
  up?: Leg;
  down?: Leg;
}

/** A user key's three unit ids (Find ids) with the texts to show where the id is not the name (`label`). */
export interface UserSet {
  tap?: string;
  up?: string;
  down?: string;
  label?: { tap?: string; up?: string; down?: string };
}
export type UserCells = Readonly<Record<string, UserSet>>;

interface RawCell { key: string; tap?: string; up?: string; down?: string; label?: { tap?: string; up?: string; down?: string } }
interface RawSpec {
  keep: { key: string; does: string; up?: string }[];
  ops: { key: string; tap: string; up?: string }[];
  prefixes: RawCell[];
  units: RawCell[];
  user: RawCell[];
}
const spec = raw as unknown as RawSpec;

/** Ids that are drawn as another symbol: Find's ids are ASCII (`oC`, `u`, `ohm`, `deg`). */
const SYMBOL: Readonly<Record<string, string>> = { oC: "°C", oF: "°F", deg: "°", u: "µ", ohm: "Ω" };
const symbol = (id: string, label?: string): string => label ?? SYMBOL[id] ?? id;

const OPS: Readonly<Record<string, { text: string; emit: PadEmit }>> = {
  per: { text: "÷", emit: { do: "per" } },
  inverse: { text: "⁻¹", emit: { do: "power", n: -1 } },
  product: { text: "×", emit: { do: "times" } },
  square: { text: "²", emit: { do: "power", n: 2 } },
  sqrt: { text: "√", emit: { do: "sqrt" } },
  cube: { text: "³", emit: { do: "power", n: 3 } },
  fourth: { text: "⁴", emit: { do: "power", n: 4 } },
};
const KEEP: Readonly<Record<string, { text: () => string; emit: PadEmit }>> = {
  find: { text: () => unitText("units.pad.find"), emit: { do: "find" } },
  delete: { text: () => "⌫", emit: { do: "delete" } },
  next: { text: () => unitText("units.pad.enter"), emit: { do: "next" } },
  evaluate: { text: () => unitText("units.pad.evaluate"), emit: { do: "evaluate" } },
};

const DRAWN: Action = { kind: "cmd", name: "unitPad" };
const NONE: Action = { kind: "special", name: "none" };
const LEG = { primary: "tap", shift: "up", alpha: "down" } as const;

function fail(what: string): never {
  throw new Error(`unit-pad.yaml: ${what}`);
}

/** The cells of the spec's unit pad, from the spec and the user's cells (the spec's defaults when none are given). */
export class UnitPad {
  readonly #cells = new Map<string, PadCell>();

  constructor(user: UserCells = defaultUser()) {
    const add = (c: PadCell): void => {
      if (this.#cells.has(c.key)) fail(`key ${c.key} holds two cells`);
      this.#cells.set(c.key, c);
    };
    for (const k of spec.keep) {
      if (k.does === "shift" || k.does === "alpha") continue; // Shift and Alpha stay the keypad's own
      const tap = KEEP[k.does] ?? fail(`unknown keep ${k.does}`);
      const up = k.up === undefined ? undefined : (KEEP[k.up] ?? fail(`unknown keep ${k.up}`));
      add({ key: k.key, kind: "keep", tap: { text: tap.text(), emit: tap.emit }, ...(up ? { up: { text: up.text(), emit: up.emit } } : {}) });
    }
    for (const o of spec.ops) {
      const leg = (n: string): Leg => OPS[n] ?? fail(`unknown op ${n}`);
      add({ key: o.key, kind: "op", tap: leg(o.tap), ...(o.up ? { up: leg(o.up) } : {}) });
    }
    for (const [kind, list] of [["prefix", spec.prefixes], ["unit", spec.units]] as const)
      for (const c of list) add(cellOf(c.key, kind, c));
    for (const [key, set] of Object.entries(user)) add(cellOf(key, "user", set));
    for (const c of spec.user) if (!this.#cells.has(c.key)) add(cellOf(c.key, "user", {})); // an unset user key is an empty cell
  }

  get cells(): readonly PadCell[] {
    return [...this.#cells.values()];
  }

  cell(key: string): PadCell | undefined {
    return this.#cells.get(key);
  }

  /** The key as the keypad draws it while the pad is up (Keypad.svelte, through sheetChunk.pad): the cell's three legs
   *  as the key's three legends, so a cell lies on its key by construction and fit.ts fits it like any legend. A leg the
   *  cell has not is a dead layer (not a fall-back to the tap). undefined for a key that is not a pad cell. */
  key(k: Key, sheet: unknown): Key | undefined {
    const c = this.#cells.get(k.id);
    if (!c || sheet) return undefined; // (a sheet over the keys: the keypad's own)
    const label: Partial<Record<PadLayer, string>> = {};
    const actions: Partial<Record<PadLayer, Action>> = {};
    for (const layer of ["primary", "shift", "alpha"] as const) {
      const leg = c[LEG[layer]];
      if (leg) label[layer] = leg.text;
      // (only whether a layer has an action matters to the drawing: the press goes to `route`)
      actions[layer] = leg ? DRAWN : NONE;
    }
    const empty = c.kind === "user" && c.tap === undefined;
    if (empty) label.primary = "+";
    const { user, ...rest } = k; // (a user cell is drawn as the pad's, not by the user's own slots)
    void user;
    return { ...rest, label, actions, pad: empty ? "empty" : c.kind };
  }

  /** A key press while the pad is up (keyboard/route.ts): a cell emits its action in the layer it was pressed in and
   *  uses up a one-shot Shift or Alpha, a cell with nothing there is a dead key; true when the key was a cell. */
  route(c: RouteCtx, key: Key, mods: Mods): boolean {
    if (c.shell.sheet) return false; // (a sheet over the keys takes them)
    const emit = this.press(key.id, mods.alpha ? "alpha" : mods.shift ? "shift" : "primary");
    if (emit === undefined) return false;
    c.session.clearModifiers();
    if (emit === null) c.dead();
    else unitPad.on(emit);
    return true;
  }

  /** A press of `key` in `layer`: what it emits; null where the cell has nothing (a dead key); undefined where the key
   *  is not a pad cell (the keypad's own routing takes it). */
  press(key: string, layer: PadLayer): PadEmit | null | undefined {
    const c = this.#cells.get(key);
    return c ? (c[LEG[layer]]?.emit ?? null) : undefined;
  }
}

function cellOf(key: string, kind: CellKind, c: UserSet): PadCell {
  const leg = (l: "tap" | "up" | "down"): { [k in typeof l]?: Leg } => {
    const id = c[l];
    if (id === undefined) return {};
    return { [l]: { text: symbol(id, c.label?.[l]), emit: kind === "prefix" ? { do: "prefix", id } : { do: "unit", id } } };
  };
  return { key, kind, ...leg("tap"), ...leg("up"), ...leg("down") };
}

/** The spec's user cells (U1–U6 and their defaults). */
export function defaultUser(): UserCells {
  return Object.fromEntries(spec.user.map((c) => [c.key, { ...(c.tap ? { tap: c.tap } : {}), ...(c.up ? { up: c.up } : {}), ...(c.down ? { down: c.down } : {}), ...(c.label ? { label: c.label } : {}) }]));
}
