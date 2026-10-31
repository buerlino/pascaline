// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Your keys (R4b, docs/05 3.4, docs/mockups/settings.html section 3 frame 4): the free keys U1–U6 with their
// Shift and Alpha layers, eighteen slots. A row per slot opens its level: Find (the pick sets the slot), a place or a
// sheet (Home, CAS, Apps, Menu, Mode, Settings), or empty. Pressing a free key while the list is open highlights its
// row (route.ts, Sheet.goKey). The slots are in the stamped store under USER_KEYS (keyboard/userKeys.svelte.ts).
import type { MenuItem } from "../apps/types.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import { findText as t } from "../i18n/enFind.ts";
import { legend, t as tr } from "../i18n/index.ts";
import type { Layer, Special } from "../keyboard/keyboard.ts";
import { USER_KEY_IDS, USER_LAYERS, type UserKeys } from "../keyboard/userKeys.svelte.ts";
import { CELL_KEYS, LEG_OF, unitCells } from "../units/userCells.svelte.ts";

/** What Settings › Your keys needs from the app: the slots, and Find to pick a slot's content from (App.svelte). */
export interface SettingsEnv {
  readonly userKeys?: UserKeys;
  chooseFor?(id: string, layer: Layer): void;
  /** Settings › Data (R38a, R38b): runs a backup action on the clipboard code, which shows its notice and opens the
   *  restore sheet (App.svelte's withClip: it waits for that code when the sheet opened before it came). */
  data?(run: (c: ClipActions) => void | Promise<void>): void;
}

/** The places and sheets a slot can hold. */
const PLACES: readonly { name: Special; label: () => string }[] = [
  { name: "home", label: () => tr("view.home") },
  { name: "cas", label: () => tr("view.cas") },
  { name: "apps", label: () => tr("apps.title") },
  { name: "menu", label: () => t("keys.menu") },
  { name: "mode", label: () => tr("mode.title") },
  { name: "settings", label: () => tr("mode.settings") },
];
const MARK: Record<Layer, string> = { primary: "", shift: " ⇧", alpha: " α" };

/** How many slots hold something, for the section's row. */
export function slotsSet(u: UserKeys): number {
  return USER_KEY_IDS.reduce((n, id) => n + USER_LAYERS.filter((l) => u.labelOf(id, l) !== undefined).length, 0);
}

export function yourKeysItems(env: SettingsEnv): MenuItem[] {
  const u = env.userKeys;
  if (!u) return [];
  const slot = (id: string, n: number, layer: Layer): MenuItem => {
    const name = `U${n}${MARK[layer]}`;
    return {
      id: `${id}:${layer}`,
      label: name,
      get value() {
        const l = u.labelOf(id, layer);
        return l === undefined ? t("keys.empty") : legend(l);
      },
      slot: { key: id, layer },
      submenu: {
        title: name,
        items: [
          { id: "find", label: t("keys.find"), run: () => env.chooseFor?.(id, layer) },
          ...PLACES.map(
            (p): MenuItem => ({
              id: p.name,
              label: p.label(),
              keep: true,
              get selected() {
                return u.placeOf(id, layer) === p.name;
              },
              run: () => u.set(id, layer, { label: p.label(), action: { special: p.name } }),
            }),
          ),
          { id: "empty", label: t("keys.emptyDo"), keep: true, run: () => u.reset(id, layer) },
        ],
      },
    };
  };
  return [
    ...USER_KEY_IDS.flatMap((id, i) => USER_LAYERS.map((layer) => slot(id, i + 1, layer))),
    unitCellsItem(env),
    { id: "reset", label: t("keys.reset"), keep: true, run: () => u.reset() },
  ];
}

/** The section's value: how many slots are set. */
export function yourKeysValue(env: SettingsEnv): string {
  const n = env.userKeys ? slotsSet(env.userKeys) : 0;
  return n === 0 ? t("keys.none") : t("keys.some", { n: String(n) });
}

/** Settings › Your keys › Unit pad cells (R24d): the user cells of the unit pad, U1–U6 with a tap, a flick up (Shift) and a
 *  flick down (Alpha), eighteen legs. A leg's level: Find on units (the pick sets it), back to its default, or empty.
 *  The legs are in the stamped store under UNIT_PAD_CELLS (units/userCells.svelte.ts); pressing a free key goes to its row. */
function unitCellsItem(env: SettingsEnv): MenuItem {
  const leg = (key: string, n: number, layer: Layer): MenuItem => {
    const name = `U${n}${MARK[layer]}`;
    const l = LEG_OF[layer];
    return {
      id: `${key}:${layer}`,
      label: name,
      get value() {
        return unitCells.textOf(key, l) ?? t("keys.empty");
      },
      slot: { key, layer },
      submenu: {
        title: name,
        items: [
          { id: "find", label: t("keys.find"), run: () => env.chooseFor?.(`${CELL_PREFIX}${key}`, layer) },
          { id: "default", label: t("keys.default"), keep: true, run: () => unitCells.reset(key, l) },
          { id: "empty", label: t("keys.emptyDo"), keep: true, run: () => unitCells.set(key, l, null) },
        ],
      },
    };
  };
  let loaded = false;
  return {
    id: "unitcells",
    label: t("keys.unitCells"),
    get value() {
      return unitCells.count() === 0 ? t("keys.none") : t("keys.some", { n: String(unitCells.count()) });
    },
    submenu: {
      title: t("keys.unitCells"),
      loading: () => (loaded ? null : unitCells.restore().then(() => void (loaded = true))),
      items: [
        ...CELL_KEYS.flatMap((key, i) => (["primary", "shift", "alpha"] as const).map((layer) => leg(key, i + 1, layer))),
        { id: "reset", label: t("keys.resetCells"), keep: true, run: () => unitCells.reset() },
      ],
    },
  };
}

/** `chooseFor`'s id for a unit pad cell: "cell:u1" (the free keys' own ids are "u1" …). */
export const CELL_PREFIX = "cell:";
