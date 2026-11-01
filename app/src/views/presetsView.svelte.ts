// SPDX-License-Identifier: GPL-3.0-or-later
// R89 (docs/05 3.4, docs/mockups/settings.html section 4): the presets in Mode. Mode's row 5 shows the active preset and
// what it holds; ◀ ▶ apply the previous or next one with the sheet open; a tap, a digit or Enter opens `Mode › Presets`
// (the presets, Save, Edit ›). A preset's page holds its five ticks, Update and Rename or delete ›. A name is typed in the
// entry line under the label "Preset name" (AppShell.prompt; route.ts gives it Enter and Esc). The model is R88's
// (state/presets.svelte.ts); this module is part of the Mode sheet's chunk.
import type { MenuItem, SubMenu } from "../apps/types.ts";
import type { EntryPrompt } from "../apps/shell.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { presetText as pt, type PresetKey } from "../i18n/enPresets.ts";
import type { UserKeys } from "../keyboard/userKeys.svelte.ts";
import { PRESET_GROUPS, PresetError, presetsFor, type GroupValues, type Preset, type PresetGroup, type Presets } from "../state/presets.svelte.ts";
import type { Session } from "../state/session.svelte.ts";
import { familyOf } from "../theme/lookView.ts";

type Family = Parameters<typeof familyOf>[0];

/** What the preset rows need from the app (App.svelte's SettingsEnv): the line to type a name in, and the notice. */
export interface PresetsHost {
  readonly shell?: { prompt: EntryPrompt | null };
  readonly entry?: Pick<EntryController, "value" | "chips" | "set">;
  notice?(message: string): void;
}

/** The page's model once it is read (null before; the rows read it on each draw). */
const held = $state<{ model: Presets | null; asked: boolean }>({ model: null, asked: false });

/** Read the presets for the Mode sheet: resolves once they are in, or after a second at most (a store that never
 *  answers must not hold the sheet; the rows fill in when the model comes). */
export function presetsReady(session: Session, userKeys: UserKeys): Promise<void> {
  const load = presetsFor(session, userKeys).then((m) => void (held.model = m));
  return Promise.race([load, new Promise<void>((r) => setTimeout(r, 1000))])
    .catch(() => {})
    .finally(() => (held.asked = true));
}
/** The presets were asked for once (in or not): the Mode sheet opens without waiting again. */
export const presetsAsked = (): boolean => held.asked;
/** For tests: the model the rows use. */
export function setPresetsModel(m: Presets | null): void {
  held.model = m;
  held.asked = m !== null;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** How many free-key slots a held Your keys group sets (an emptied slot is not counted). */
export function keysSet(keys: GroupValues | undefined): number {
  const u = keys?.["userKeys"];
  if (!isObject(u)) return 0;
  let n = 0;
  for (const slots of Object.values(u)) if (isObject(slots)) for (const b of Object.values(slots)) if (isObject(b)) n++;
  return n;
}

/** `DEG · ENG 4` (with ` · one line` for the one-line entry). */
function modeShort(m: GroupValues): string[] {
  const out: string[] = [];
  const angle = str(m["angle"]);
  const format = str(m["format"]);
  const digits = num(m["digits"]);
  if (angle) out.push(angle.toUpperCase());
  if (format || digits !== undefined) out.push([format?.toUpperCase(), digits].filter((x) => x !== undefined).join(" "));
  return out;
}

/** What a preset holds, in a line (`DEG · ENG 4 · comma · 5 keys · Graphite`): the Mode values, the decimal mark, the
 *  free keys set and the theme when it is not the default one. A group not held, or a field stored before it existed,
 *  is left out. */
export function summary(p: Preset): string {
  const g = p.groups;
  const parts: string[] = [];
  if (g.mode) {
    parts.push(...modeShort(g.mode));
    if (g.mode["entry"] === "line") parts.push(pt("line"));
  }
  const mark = str(g.numbers?.["decimalMark"]);
  if (mark === "comma" || mark === "point") parts.push(pt(mark));
  if (g.keys) {
    const n = keysSet(g.keys);
    parts.push(n === 0 ? pt("keys.0") : n === 1 ? pt("keys.1") : pt("keys.n", { n }));
  }
  const family = str(g.look?.["family"]);
  if (family && family !== "pascaline") parts.push(familyOf(family as Family).name);
  return parts.join(" · ");
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A held group's values, the second line of its tick on the preset's page. */
export function groupValue(g: PresetGroup, v: GroupValues): string {
  switch (g) {
    case "mode": {
      const entry = str(v["entry"]);
      return [...modeShort(v), ...(entry ? [entry === "line" ? pt("line") : pt("textbook")] : [])].join(" · ");
    }
    case "numbers": {
      const mark = str(v["decimalMark"]);
      const cycle = Array.isArray(v["fmtCycle"]) ? (v["fmtCycle"] as unknown[]).filter((x): x is string => typeof x === "string").map(cap).join(" ") : "";
      return [mark === "comma" ? pt("Comma") : mark === "point" ? pt("Point") : "", cycle].filter((x) => x !== "").join(" · ");
    }
    case "look": {
      const family = str(v["family"]);
      const b = str(v["brightness"]);
      return [family ? familyOf(family as Family).name : "", b ? t(`appearance.brightness.${b}` as MessageKey) : ""].filter((x) => x !== "").join(" · ");
    }
    case "vibration":
      return v["on"] === true ? pt("on", { strength: num(v["strength"]) ?? "?", ms: num(v["ms"]) ?? "?" }) : pt("off");
    case "keys": {
      const n = keysSet(v);
      return n === 0 ? pt("set.0") : pt("set.n", { n });
    }
  }
}

const GROUP_LABEL: Record<PresetGroup, PresetKey> = {
  mode: "group.mode",
  numbers: "group.numbers",
  look: "group.look",
  vibration: "group.vibration",
  keys: "group.keys",
};

/** A refusal of the model (PresetError), as the notice says it. */
function faultText(e: unknown, name: string): string {
  if (!(e instanceof PresetError)) return pt("fault.unknown");
  switch (e.fault) {
    case "empty":
      return pt("fault.empty");
    case "taken":
      return pt("fault.taken", { name });
    case "noGroups":
      return pt("fault.noGroups");
    case "newer":
      return pt("fault.newer");
    case "unknown":
      return pt("fault.unknown");
  }
}

/** The name typed on the line: the letters, digits and signs as typed, MathLive's spaces as spaces. */
export function nameFrom(latex: string): string {
  return latex
    .replace(/\\(?:text|mathrm|operatorname)\{([^}]*)\}/g, "$1")
    .replace(/\\[ ,:;!]|~/g, " ")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** A name as the line takes it (rename starts from the old name). */
const nameLatex = (name: string): string => name.replace(/[\\{}]/g, "").replace(/ /g, "\\ ");

/** The sheet has closed: the entry line takes a name under its label. Enter offers it to `save` (a refusal is the
 *  notice, and the line stays for another try); Esc cancels. Either way the line then holds what it held before. */
function askName(host: PresetsHost, start: string, save: (name: string) => void, said: (name: string) => string): void {
  const { shell, entry } = host;
  if (!shell || !entry) return;
  const line = entry.value;
  const chips = entry.chips;
  const end = (): void => {
    shell.prompt = null;
    entry.set(line, chips);
  };
  shell.prompt = {
    label: pt("name"),
    enter: (latex) => {
      const name = nameFrom(latex);
      try {
        save(name);
      } catch (e) {
        host.notice?.(faultText(e, name));
        return;
      }
      end();
      host.notice?.(said(name));
    },
    cancel: end,
  };
  entry.set(nameLatex(start));
}

/** Apply a preset; once its settings are set, the notice names what it holds. */
function switchTo(m: Presets, id: number, host: PresetsHost): void {
  void m.apply(id).then(
    () => {
      const p = m.list.find((x) => x.id === id);
      if (p) host.notice?.(`${p.name}: ${summary(p)}`);
    },
    (e: unknown) => host.notice?.(faultText(e, "")),
  );
}

const activeOf = (m: Presets): Preset | undefined => m.list.find((x) => x.id === m.active);

/** Mode's row 5: the active preset's name (a dot after it once a held setting changed) and what it holds; ◀ ▶ apply
 *  the previous or next preset, round the ends; a tap, a digit or Enter lists them. */
export function presetRow(host: PresetsHost): MenuItem {
  return {
    id: "preset",
    label: pt("row"),
    get value() {
      const m = held.model;
      const p = m && activeOf(m);
      return m && p ? `${p.name}${m.modified ? " •" : ""}` : pt("none");
    },
    get hint() {
      const m = held.model;
      const p = m && activeOf(m);
      return p ? summary(p) : undefined;
    },
    adjust: (by) => {
      const m = held.model;
      if (!m || m.list.length === 0) return;
      const i = m.list.findIndex((x) => x.id === m.active);
      const n = m.list.length;
      const next = i < 0 ? (by > 0 ? 0 : n - 1) : (i + by + n) % n;
      switchTo(m, (m.list[next] as Preset).id, host);
    },
    submenu: presetsMenu(host),
  };
}

/** `Mode › Presets`: the presets (a pick applies one and closes the sheet), Save the current setup, Edit the presets ›.
 *  While the record is refused (a newer version's, or unreadable) nothing is saved or edited. */
function presetsMenu(host: PresetsHost): SubMenu {
  return {
    title: pt("title"),
    remember: false,
    get items(): MenuItem[] {
      const m = held.model;
      if (!m) return [{ id: "loading", label: pt("loading"), disabled: true }];
      const rows: MenuItem[] = m.list.map((p) => ({
        id: `p${p.id}`,
        label: p.name,
        hint: summary(p),
        get selected() {
          return m.active === p.id;
        },
        run: () => switchTo(m, p.id, host),
      }));
      const save: MenuItem = {
        id: "save",
        label: pt("save"),
        disabled: m.refused,
        reason: pt("newer"),
        run: () => askName(host, "", (name) => void m.capture(name), (name) => pt("saved", { name })),
      };
      const edit: MenuItem = {
        id: "edit",
        label: pt("edit"),
        disabled: m.refused || m.list.length === 0,
        reason: m.refused ? pt("newer") : pt("edit.empty"),
        submenu: { title: pt("edit.title"), remember: false, get items() { return m.list.map((p) => pageRow(m, p, host)); } },
      };
      return [...rows, save, edit];
    },
  };
}

/** A row of `Presets › Edit`: the preset, opening its page. */
function pageRow(m: Presets, p: Preset, host: PresetsHost): MenuItem {
  const id = p.id;
  const now = (): Preset | undefined => m.list.find((x) => x.id === id);
  const say = (e: unknown): void => host.notice?.(faultText(e, now()?.name ?? ""));
  const groups: MenuItem[] = PRESET_GROUPS.map((g) => ({
    id: g,
    label: pt(GROUP_LABEL[g]),
    keep: true,
    get selected() {
      return now()?.groups[g] !== undefined;
    },
    get hint() {
      const v = now()?.groups[g];
      return v ? groupValue(g, v) : pt("notHeld");
    },
    run: () => {
      const q = now();
      if (!q) return;
      const has = PRESET_GROUPS.filter((x) => q.groups[x] !== undefined);
      try {
        m.setGroups(id, has.includes(g) ? has.filter((x) => x !== g) : [...has, g]);
      } catch (e) {
        say(e);
      }
    },
  }));
  const update: MenuItem = {
    id: "update",
    label: pt("update"),
    keep: true,
    run: () => {
      try {
        m.update(id);
        host.notice?.(pt("updated", { name: now()?.name ?? "" }));
      } catch (e) {
        say(e);
      }
    },
  };
  const manage: MenuItem = {
    id: "manage",
    label: pt("manage"),
    submenu: {
      title: pt("manage"),
      remember: false,
      items: [
        {
          id: "rename",
          label: pt("rename"),
          run: () => askName(host, now()?.name ?? "", (name) => m.rename(id, name), (name) => pt("renamed", { name })),
        },
        {
          id: "delete",
          label: pt("delete", { name: p.name }),
          run: () => {
            const name = now()?.name ?? "";
            try {
              m.remove(id);
              host.notice?.(pt("deleted", { name }));
            } catch (e) {
              say(e);
            }
          },
        },
      ],
    },
  };
  return { id: `p${id}`, label: p.name, hint: summary(p), submenu: { title: p.name, remember: false, items: [...groups, update, manage] } };
}

/** Counters' row (R88 counts each apply in `session.taps`). */
export function switchedRow(session: Session): MenuItem {
  const taps = session.taps;
  return {
    id: "presets",
    label: pt("switched"),
    keep: true,
    get value() {
      return String(taps.counts.presets);
    },
  };
}
