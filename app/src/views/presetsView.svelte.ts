// SPDX-License-Identifier: GPL-3.0-or-later
// R89 (docs/05 3.4, docs/mockups/settings.html section 4): the presets in Mode. Mode's row 5 shows the active preset and
// what it holds; ◀ ▶ apply the previous or next one with the sheet open; a tap, a digit or Enter opens `Mode › Presets`
// (the presets, Save, Edit ›). A preset's page holds its five ticks, Update and Rename or delete ›. A name is typed in the
// entry line under the label "Preset name" (AppShell.prompt: route.ts gives it each key first, so Enter and Esc never
// reach the history). The model is R88's (state/presets.svelte.ts), read when Mode opens; this module is part of the
// Mode sheet's chunk, so none of it is in the start chunk.
import type { MenuItem, SubMenu } from "../apps/types.ts";
import type { EntryPrompt } from "../apps/shell.svelte.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { presetText as pt, type PresetKey } from "../i18n/enPresets.ts";
import type { UserKeys } from "../keyboard/userKeys.svelte.ts";
import { PRESET_GROUPS, PresetError, presetsFor, type GroupValues, type Preset, type PresetGroup, type Presets } from "../state/presets.svelte.ts";
import type { Session } from "../state/session.svelte.ts";
import { familyOf } from "../theme/lookView.ts";

type Family = Parameters<typeof familyOf>[0];

/** What the preset rows need from the app (App.svelte's SettingsEnv): the free keys, the line to type a name in, and
 *  the clipboard code, whose notice says what happened. */
export interface PresetsHost {
  readonly userKeys?: UserKeys;
  readonly shell?: { prompt: EntryPrompt | null; readonly sheet: unknown; readonly app: unknown; readonly view: unknown };
  readonly entry?: Pick<EntryController, "value" | "chips" | "set" | "run" | "clear">;
  data?(run: (c: ClipActions) => void | Promise<void>): void;
}
const say = (host: PresetsHost, message: string): void => host.data?.((c) => c.say(message));

/** The page's model once it is read (null before; the rows read it on each draw); `asked`: the read has ended. */
const held = $state<{ model: Presets | null; asked: boolean }>({ model: null, asked: false });
let loading: Promise<void> | undefined;

/** Read the presets (once per page): Mode's rows start it; a key on them meanwhile waits for it. */
function load(session: Session, host: PresetsHost): Promise<void> {
  const keys = host.userKeys;
  if (!keys) return Promise.resolve();
  return (loading ??= presetsFor(session, keys)
    .then((m) => void (held.model = m))
    .catch(() => {})
    .finally(() => (held.asked = true)));
}
/** For tests: the model the rows use. */
export function setPresetsModel(m: Presets | null): void {
  held.model = m;
  held.asked = m !== null;
  loading = m === null ? undefined : Promise.resolve();
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
  if (family && family !== "n62") parts.push(familyOf(family as Family).name);
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
    case "unreadable":
      return pt("fault.unreadable");
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

/** The sheet has closed: the entry line takes a name under its label, and every key goes to it first. Enter offers the
 *  name to `save` (a refusal is the notice, and the line stays for another try); Esc cancels; C empties the name only,
 *  never the history nor the kept line (R123: the line's own clear would drop it, main.ts onClear); the space key types a space; a key or a tap that goes elsewhere (a sheet, a place) cancels first. Either way the
 *  line then holds what it held before. */
function askName(host: PresetsHost, start: string, save: (name: string) => void, said: (name: string) => string): void {
  const { shell, entry } = host;
  if (!shell || !entry) return;
  shell.prompt?.cancel(); // a name still being typed (a tap went elsewhere): its line comes back first, and is the one kept
  const line = entry.value;
  const chips = entry.chips;
  const end = (): void => {
    if (shell.prompt !== prompt) return; // ended already
    shell.prompt = null;
    queueMicrotask(stop); // (not from inside the watch's own run)
    entry.set(line, chips);
  };
  const offer = (): void => {
    const name = nameFrom(entry.value);
    try {
      save(name);
    } catch (e) {
      return say(host, faultText(e, name));
    }
    end();
    say(host, said(name));
  };
  const prompt: EntryPrompt = {
    label: pt("name"),
    aside: { latex: line, chips },
    cancel: end,
    key: (a) => {
      if (a.kind !== "special") entry.run(a.kind === "type" && a.text === " " ? { kind: "insert", latex: "\\ " } : a);
      else if (a.name === "enter") offer();
      else if (a.name === "esc") end();
      else if (a.name === "clear") entry.set("");
      else {
        if (a.name !== "none") end();
        return false;
      }
      return true;
    },
  };
  shell.prompt = prompt;
  entry.set(nameLatex(start));
  // a tap that goes elsewhere ends the name as Esc does: a sheet opens, or another app or view (the place name, Plot).
  // Watched here, in the Mode chunk, so the start chunk's shell carries only the `prompt` field (R89 fix round 2).
  const app = shell.app;
  const view = shell.view;
  const stop = $effect.root(() => {
    $effect(() => {
      if (shell.sheet !== null || shell.app !== app || shell.view !== view) end();
    });
  });
}

/** Apply a preset; once its settings are set, the notice names what it holds. */
function switchTo(m: Presets, id: number, host: PresetsHost): void {
  void m.apply(id).then(
    () => {
      const p = m.list.find((x) => x.id === id);
      if (p) say(host, `${p.name}: ${summary(p)}`);
    },
    (e: unknown) => say(host, faultText(e, "")),
  );
}

const activeOf = (m: Presets): Preset | undefined => m.list.find((x) => x.id === m.active);

/** Mode's row 5: the active preset's name (a dot after it once a held setting changed) and what it holds; ◀ ▶ apply
 *  the previous or next preset, round the ends; a tap, a digit or Enter lists them. */
export function presetRow(session: Session, host: PresetsHost): MenuItem {
  void load(session, host);
  const row: MenuItem = {
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
      if (!held.asked) return void load(session, host).then(() => row.adjust?.(by)); // a key before the read: after it
      const m = held.model;
      if (!m || m.list.length === 0) return;
      const i = m.list.findIndex((x) => x.id === m.active);
      const n = m.list.length;
      const next = i < 0 ? (by > 0 ? 0 : n - 1) : (i + by + n) % n;
      switchTo(m, (m.list[next] as Preset).id, host);
    },
    submenu: presetsMenu(session, host),
  };
  return row;
}

/** `Mode › Presets`: the presets (a pick applies one and closes the sheet), Save the current setup, Edit the presets ›.
 *  While the record is refused (a newer version's, or unreadable) nothing is saved or edited. */
function presetsMenu(session: Session, host: PresetsHost): SubMenu {
  return {
    title: pt("title"),
    remember: false,
    loading: () => (held.asked ? null : load(session, host)),
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
        disabled: m.refused !== null,
        reason: pt(m.refused ?? "newer"),
        run: () => askName(host, "", (name) => void m.capture(name), (name) => pt("saved", { name })),
      };
      const edit: MenuItem = {
        id: "edit",
        label: pt("edit"),
        disabled: m.refused !== null || m.list.length === 0,
        reason: pt(m.refused ?? "edit.empty"),
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
  const fault = (e: unknown): void => say(host, faultText(e, now()?.name ?? ""));
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
        fault(e);
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
        say(host, pt("updated", { name: now()?.name ?? "" }));
      } catch (e) {
        fault(e);
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
              say(host, pt("deleted", { name }));
            } catch (e) {
              fault(e);
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
