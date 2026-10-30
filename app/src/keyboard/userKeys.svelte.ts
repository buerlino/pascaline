// SPDX-License-Identifier: GPL-3.0-or-later
// The free keys U1–U6 of the R3 cluster (R15b, R15c; decisions.md "R15c"). Each has three slots, its tap, its Shift
// layer (a flick up) and its Alpha layer (a flick down, or Alpha + the key; R15c3), so eighteen actions. An empty Alpha
// slot falls back to the tap, as every key's missing Alpha layer does. spec/keyboard.yaml gives the defaults (all empty); the user's
// choice for a slot replaces its default and is kept in the stamped store under USER_KEYS (state/storage.ts). Settings › Your
// keys sets a slot from Find or from a place (R4b, views/yourKeys.ts); this module is the model it calls.
import type { Kv } from "../state/storage.ts";
import { USER_KEYS } from "../state/storage.ts";
import { KeyboardSpecError, keyboard, parseAction, type Action, type Key, type Layer } from "./keyboard.ts";

export type UserLayer = Layer;
export const USER_LAYERS: readonly UserLayer[] = ["primary", "shift", "alpha"];

/** What a slot holds: the legend drawn on the key and the action, in the yaml form of spec/keyboard.yaml (`{ insert:
 *  "\\sinh\\left(#0\\right)" }`, `{ special: "home" }`, `{ type: "x" }`, `{ cmd: "…" }`). */
export interface UserBinding {
  readonly label: string;
  readonly action: Readonly<Record<string, unknown>>;
}
/** Per key id and layer: the user's binding, or null for a slot the user emptied. A slot that is absent has its default. */
export type StoredUserKeys = Record<string, Partial<Record<UserLayer, UserBinding | null>>>;

/** The free keys, in layout order (U1 … U6). The ids of U1–U3 kept their meaning, so their stored slots stay valid. */
export const USER_KEY_IDS: readonly string[] = keyboard.keys.filter((k) => k.user).map((k) => k.id);

/** A stored binding that still means something (a valid action and a label), null for an emptied slot; else undefined:
 *  an older or damaged record never breaks the keypad, the slot just keeps its default. */
function valid(b: unknown): { label: string; action: Action } | null | undefined {
  if (b === null) return null;
  if (typeof b !== "object" || b === null) return undefined;
  const { label, action } = b as Partial<UserBinding>;
  if (typeof label !== "string" || label === "") return undefined;
  try {
    return { label, action: parseAction(action, "user key") };
  } catch (e) {
    if (e instanceof KeyboardSpecError) return undefined;
    throw e;
  }
}

export class UserKeys {
  /** The user's slots (only the ones that differ from the defaults are stored); each is checked when it is used. */
  private stored = $state<StoredUserKeys>({});
  private readonly kv: Kv;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  /** Read the stored slots (at launch; until then the keys show their defaults). */
  async restore(): Promise<void> {
    const v = await this.kv.get<unknown>(USER_KEYS);
    if (typeof v === "object" && v !== null) this.stored = v as StoredUserKeys;
  }

  /** The key as it is drawn and fires: a free key with the user's slots over its defaults; any other key unchanged. */
  resolve(key: Key): Key {
    if (!key.user) return key;
    const slots = this.slots(key.id);
    if (Object.keys(slots).length === 0) return key;
    const label = { ...key.label };
    const actions = { ...key.actions };
    for (const layer of USER_LAYERS) {
      const b = valid(slots[layer]);
      if (b === undefined) continue;
      if (b === null) {
        delete label[layer];
        delete actions[layer];
      } else {
        label[layer] = b.label.startsWith("$") ? `$${b.label}` : b.label; // the user's text, never a message key
        actions[layer] = b.action;
      }
    }
    // an emptied tap layer is a dead key with the empty-slot face, as U1 ships
    if (!actions.primary) {
      label.primary = "$key.user";
      actions.primary = { kind: "special", name: "none" };
    }
    return { ...key, label, actions };
  }

  /** Does this free key hold nothing in its tap layer (drawn as an empty slot)? */
  isEmpty(key: Key): boolean {
    const p = this.resolve(key).actions.primary;
    return p?.kind === "special" && p.name === "none";
  }

  /** The legend a slot shows, undefined for an empty one (Settings › Your keys, R4b). */
  labelOf(id: string, layer: UserLayer): string | undefined {
    const k = keyboard.byId.get(id);
    if (!k) return undefined;
    const r = this.resolve(k);
    const a = r.actions[layer];
    return !a || (a.kind === "special" && a.name === "none") ? undefined : r.label[layer];
  }

  /** The special a slot holds (a place or a sheet), else undefined. */
  placeOf(id: string, layer: UserLayer): string | undefined {
    const k = keyboard.byId.get(id);
    const a = k && this.resolve(k).actions[layer];
    return a && a.kind === "special" ? a.name : undefined;
  }

  /** Put a binding on a slot (null: empty it). Throws KeyboardSpecError when the action is not a keyboard action. */
  set(id: string, layer: UserLayer, binding: UserBinding | null): void {
    if (!USER_KEY_IDS.includes(id)) throw new KeyboardSpecError(`'${id}' is not a user key`);
    if (binding !== null) {
      if (binding.label === "") throw new KeyboardSpecError(`${id} ${layer}: a binding needs a label`);
      parseAction(binding.action, `${id} ${layer}`);
    }
    this.write({ ...this.stored, [id]: { ...this.slots(id), [layer]: binding } });
  }

  /** Give a slot back its default from spec/keyboard.yaml; without arguments, every slot. */
  reset(id?: string, layer?: UserLayer): void {
    if (id === undefined) return this.write({});
    const slots = { ...this.slots(id) };
    if (layer === undefined) for (const l of USER_LAYERS) delete slots[l];
    else delete slots[layer];
    const next = { ...this.stored };
    if (Object.keys(slots).length === 0) delete next[id];
    else next[id] = slots;
    this.write(next);
  }

  /** A key's stored slots ({} for none, or for a damaged record). */
  private slots(id: string): Partial<Record<UserLayer, UserBinding | null>> {
    const s = this.stored[id];
    return typeof s === "object" && s !== null ? s : {};
  }

  private write(next: StoredUserKeys): void {
    this.stored = next;
    void this.kv.set(USER_KEYS, $state.snapshot(next));
  }
}
