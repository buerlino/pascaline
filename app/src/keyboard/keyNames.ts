// SPDX-License-Identifier: GPL-3.0-or-later
// R41: the names a screen reader gets for a key: its aria-label (what a tap gives in the layer that is on) and its
// aria-description (the other layers). The chunk of its own, loaded after the first paint (keyNamesLoader.svelte.ts).
import { enKeyNames, type KeyNameKey } from "../i18n/enKeyNames.ts";
import { legend } from "../i18n/index.ts";
import { keyboard, labelFor, type Key, type Layer } from "./keyboard.ts";

const LAYERS = ["primary", "shift", "alpha"] as const;

/** The key has this layer: a tap is always a layer; Shift and Alpha only where they do something. */
export function hasLayer(key: Key, layer: Layer): boolean {
  const a = key.actions[layer];
  if (layer === "primary") return true;
  return a !== undefined && !(a.kind === "special" && a.name === "none");
}

/** The key as the spec has it, when this layer of `key` is still the spec's (not a user's binding, the decimal comma, a unit cell). */
function specLayer(key: Key, layer: Layer): boolean {
  const o = keyboard.byId.get(key.id);
  return o !== undefined && key.label[layer] === o.label[layer] && JSON.stringify(key.actions[layer]) === JSON.stringify(o.actions[layer]);
}

const word = (k: KeyNameKey): string => enKeyNames[k];
const named = (k: string): string | undefined => (k in enKeyNames ? enKeyNames[k as KeyNameKey] : undefined);

/**
 * What one layer of a key is called: the table's name for the spec's own layers, the key's face for a layer the app changed
 * (a user key's binding, a unit cell). An Alpha letter is the letter, in the case the view types (`cas`, R58; `shift` is Shift + Alpha).
 */
export function layerName(key: Key, layer: Layer, cas: boolean, shift = false): string | undefined {
  if (!hasLayer(key, layer)) return undefined;
  const face = (): string => legend(labelFor(key, shift && layer === "alpha", layer === "alpha", cas) || key.label.primary || "");
  if (!specLayer(key, layer)) return face() || named(key.id) || undefined;
  if (layer === "alpha" && /^[A-Z]$/.test(key.label.alpha ?? "")) return face();
  return named(layer === "primary" ? key.id : `${key.id}.${layer}`) ?? face();
}

/**
 * The key's aria-label and aria-description for the modifier state. The label is the layer a tap gives now (Alpha before
 * Shift, as the face shows it); a layer the key lacks leaves its tap name. The description lists the Shift and Alpha layers
 * that are not the label, "Shift: arc sine. Alpha: G".
 */
export function keyLabels(key: Key, shift: boolean, alpha: boolean, cas: boolean): { label: string; description: string } {
  const now: Layer = alpha && hasLayer(key, "alpha") ? "alpha" : shift && !alpha && hasLayer(key, "shift") ? "shift" : "primary";
  const parts: string[] = [];
  for (const l of LAYERS)
    if (l !== "primary" && l !== now) {
      const n = layerName(key, l, cas);
      if (n !== undefined) parts.push(`${word(`layer.${l}`)}: ${n}`);
    }
  return { label: layerName(key, now, cas, shift) ?? "", description: parts.join(". ") };
}

/**
 * Name every key button under `pad` for the modifier state: aria-label, and aria-description when the key has other layers.
 * Set on the elements here, not in Keypad's template, so the start chunk carries none of it (and a spread of the
 * attribute, which Svelte's typings do not know, costs 7 kB of runtime).
 */
export function labelKeys(pad: HTMLElement, keys: readonly Key[], shift: boolean, alpha: boolean, cas: boolean): void {
  for (const key of keys) {
    const el = pad.querySelector(`[data-key="${key.id}"]`);
    if (!el) continue;
    const { label, description } = keyLabels(key, shift, alpha, cas);
    el.setAttribute("aria-label", label);
    if (description) el.setAttribute("aria-description", description);
    else el.removeAttribute("aria-description");
  }
}
