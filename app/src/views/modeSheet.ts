// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet's list and Settings, its next level (docs/05 3.4 with section 7; R49). Mode (one sheet, sheet.svelte.ts)
// holds what changes in a session: angle, format, digits, entry. Settings holds what is set once, in sections: the
// Format key's cycle, the key vibration, the counters. A row with a value is changed in place: ◀ ▶ step it, a digit key
// or a tap steps it forward; in Mode Enter closes, in Settings it stays. No native <select> or number input: the keypad
// drives all of it.
import type { MenuItem, SubMenu, ValueOption } from "../apps/types.ts";
import type { AngleUnit, NumberFormat } from "../calc/port.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { hasStrength, vibrate } from "../input/haptics.ts";
import { NOTATION_MODES } from "../state/displayMode.ts";
import { MAX_DIGITS, type DecimalMark, type EntryMode, type Session } from "../state/session.svelte.ts";
import { aboutText } from "../i18n/enAbout.ts";
import { helpItems } from "./aboutItems.ts";
import { findText } from "../i18n/enFind.ts";
import { dataText } from "../i18n/enData.ts";
import { BRIGHTNESS, validLook, type Look } from "../theme/look.ts";
import { familyOf, FAMILIES, stepped } from "../theme/lookView.ts";
import { yourKeysItems, yourKeysValue, type SettingsEnv } from "./yourKeys.ts";

const ANGLES: readonly AngleUnit[] = ["rad", "deg"];
const FORMATS: readonly NumberFormat[] = ["std", "sci", "eng", "pfx"];
const ENTRIES: readonly EntryMode[] = ["textbook", "line"];
const MARKS: readonly DecimalMark[] = ["point", "comma"];
/** The values the digits and decimals rows offer when picked (◀ ▶ reach every other one). */
const DIGITS_PRESETS: readonly number[] = [4, 6, 8, 10, 12, 15, 20, 25, MAX_DIGITS];

/** The value after `by` steps from `now`, round the ends. */
function cycle<T>(all: readonly T[], now: T, by: 1 | -1): T {
  const i = all.indexOf(now);
  return all[(i + by + all.length) % all.length] as T;
}

/** A button per value (R86): `label` names it, `set` sets it. */
function buttons<T extends string>(all: readonly T[], get: () => T, set: (v: T) => void, label: (v: T) => string): ValueOption[] {
  return all.map((v) => ({
    id: v,
    label: label(v),
    get selected() {
      return get() === v;
    },
    run: () => set(v),
  }));
}

/** A list of numbers to choose from; picking one sets it and closes the sheet. */
function presets(values: readonly number[], get: () => number, set: (n: number) => void): MenuItem[] {
  return values.map((n) => ({
    id: String(n),
    label: String(n),
    get selected() {
      return get() === n;
    },
    run: () => set(n),
  }));
}

/** The Mode sheet's rows. The ids are what `at` of the sheet asks for (a tap on a status chip). */
export function modeItems(session: Session, env: SettingsEnv = {}): MenuItem[] {
  const s = session.settings;
  return [
    {
      id: "angle",
      label: t("mode.angle"),
      get options() {
        return buttons(ANGLES, () => s.angle, (v) => session.setAngle(v), (v) => v.toUpperCase());
      },
      adjust: (by) => session.setAngle(cycle(ANGLES, s.angle, by)),
    },
    {
      id: "format",
      label: t("mode.format"),
      get options() {
        return buttons(FORMATS, () => s.format, (v) => session.setFormat(v), (v) => v.toUpperCase());
      },
      adjust: (by) => session.setFormat(cycle(FORMATS, s.format, by)),
    },
    {
      id: "digits",
      label: t("mode.digits"),
      get value() {
        return String(s.digits);
      },
      adjust: (by) => session.setDigits(s.digits + by),
      submenu: { title: t("mode.digits"), items: presets(DIGITS_PRESETS, () => s.digits, (n) => session.setDigits(n)) },
    },
    {
      id: "entry",
      label: t("mode.entry"),
      get options() {
        return buttons(ENTRIES, () => s.entry, (v) => session.setEntry(v), (v) => t(`entry.${v}`));
      },
      adjust: (by) => session.setEntry(cycle(ENTRIES, s.entry, by)),
    },
    { id: "settings", label: t("mode.settings"), submenu: settingsMenu(session, env) },
  ];
}

/** Settings (R49, docs/05 3.4): the next level of the pick sheet, from Mode's last row and every ☰ menu's last row
 *  (AppShell.withSettings). Its title joins the path (`Mode › Settings › Numbers`); each section opens on its first row. */
export function settingsMenu(session: Session, env: SettingsEnv = {}): SubMenu {
  return { title: t("mode.settings"), items: settingsSections(session, env), remember: false };
}

/** A section: a row with › that opens its own level. */
function section(id: string, title: string, items: MenuItem[], value?: () => string): MenuItem {
  return {
    id,
    label: title,
    get value() {
      return value?.();
    },
    submenu: { title, items, remember: false },
  };
}

/** Settings' sections, in their fixed order, each at most seven rows: Appearance (R50e), Numbers, Key vibration, Your
 *  keys (R4b), Data (R38a), Counters, Help and about (R87). A section whose package has not landed is left out; each
 *  of those packages adds its own in its place, so a section's digit moves until the first release. A tick (`selected`
 *  with `run`) is a switch and stays; a row with `adjust` steps with ◀ ▶ and stays on Enter; a row with a value only is
 *  information. */
export function settingsSections(session: Session, env: SettingsEnv = {}): MenuItem[] {
  const s = session.settings;
  const off = () => !s.haptics.on;
  return [
    section("appearance", t("settings.appearance"), appearanceItems(session), () => `${familyOf(s.look.family).name} · ${t(`appearance.brightness.${s.look.brightness}` as MessageKey)}`),
    section("numbers", t("settings.numbers"), numbersItems(session), () => s.fmtCycle.map((m) => m.toUpperCase()).join(" ")),
    section(
      "vibration",
      t("settings.vibration"),
      [
        {
          id: "haptics",
          label: t("settings.haptics"),
          keep: true,
          get selected() {
            return s.haptics.on;
          },
          run: () => session.setHaptics({ on: !s.haptics.on }),
        },
        {
          id: "strength",
          label: t("settings.haptics.strength"),
          keep: true,
          get value() {
            return `${s.haptics.strength} %`;
          },
          get disabled() {
            return off() || !hasStrength(); // read on each look: the native plugin may load after this open
          },
          get reason() {
            return off() ? t("settings.haptics.off") : t("settings.haptics.webNote");
          },
          adjust: (by) => session.setHaptics({ strength: s.haptics.strength + 10 * by }),
        },
        {
          id: "ms",
          label: t("settings.haptics.ms"),
          keep: true,
          get value() {
            return `${s.haptics.ms} ms`;
          },
          get disabled() {
            return off();
          },
          get reason() {
            return t("settings.haptics.off");
          },
          adjust: (by) => session.setHaptics({ ms: s.haptics.ms + 5 * by }),
        },
        {
          id: "try",
          label: t("settings.haptics.try"),
          keep: true,
          get disabled() {
            return off();
          },
          get reason() {
            return t("settings.haptics.off");
          },
          run: () => vibrate(s.haptics.strength / 100, s.haptics.ms), // one key-down pulse, as set
        },
      ],
      () => t(s.haptics.on ? "settings.on" : "settings.off"),
    ),
    // Your keys (R4b, views/yourKeys.ts): only where the app gives the slots
    ...(env.userKeys ? [section("keys", findText("keys.title"), yourKeysItems(env), () => yourKeysValue(env))] : []),
    // Data (R38a; R38b adds Restore and Undo, R59 the library): only where the app gives the backup
    ...(env.saveBackup ? [section("data", dataText("data"), dataItems(env), () => dataText("data.value"))] : []),
    section("counters", t("settings.counters"), tapsItems(session), () => {
      return t("settings.counters.value", { n: String(session.taps.counts.presses) }); // (a reset replaces the object)
    }),
    section("help", aboutText("help"), helpItems()),
  ];
}

/** Data: the rows run and close the sheet, so the notice shows in the stage. */
function dataItems(env: SettingsEnv): MenuItem[] {
  return [{ id: "backup", label: dataText("backup.save"), run: () => env.saveBackup?.() }];
}

/** Appearance (R50e): the theme (◀ ▶ step through the five families; a tap, a digit or Enter lists them, and a pick
 *  keeps the sheet open so the status line and keys above show it), the brightness, and the two switches. */
function appearanceItems(session: Session): MenuItem[] {
  const look = () => session.settings.look;
  const setLook = (patch: Partial<Look>): void => {
    session.settings.look = validLook({ ...look(), ...patch }, look());
    session.save();
    session.onLook?.({ ...session.settings.look });
  };
  const ids = FAMILIES.map((f) => f.id);
  const brightness = (b: (typeof BRIGHTNESS)[number]) => t(`appearance.brightness.${b}` as MessageKey);
  return [
    {
      id: "theme",
      label: t("appearance.theme"),
      get dots() {
        return familyOf(look().family).dots;
      },
      get value() {
        return familyOf(look().family).name;
      },
      adjust: (by) => setLook({ family: stepped(ids, look().family, by) }),
      submenu: {
        title: t("appearance.theme"),
        items: FAMILIES.map((f) => ({
          id: f.id,
          label: f.name,
          dots: f.dots,
          keep: true,
          get selected() {
            return look().family === f.id;
          },
          run: () => setLook({ family: f.id }),
        })),
        remember: false,
      },
    },
    {
      id: "brightness",
      label: t("appearance.brightness"),
      keep: true,
      get value() {
        return brightness(look().brightness);
      },
      adjust: (by) => setLook({ brightness: stepped(BRIGHTNESS, look().brightness, by) }),
    },
    {
      id: "contrast",
      label: t("appearance.contrast"),
      hint: t("appearance.contrast.hint"),
      keep: true,
      get selected() {
        return look().contrast;
      },
      run: () => setLook({ contrast: !look().contrast }),
    },
    {
      id: "plain",
      label: t("appearance.plain"),
      hint: t("appearance.plain.hint"),
      keep: true,
      get selected() {
        return look().plain;
      },
      run: () => setLook({ plain: !look().plain }),
    },
  ];
}

/** Numbers: the decimal mark (R57: a value row, Point or Comma), the Fmt key's cycle (its hint a second line under the
 *  first tick) and the decimals Fixed shows, right under its tick (S2 I3). */
function numbersItems(session: Session): MenuItem[] {
  const s = session.settings;
  const mark: MenuItem = {
    id: "mark",
    label: t("settings.decimalMark"),
    keep: true,
    get value() {
      return t(`settings.decimalMark.${s.decimalMark}`);
    },
    adjust: (by) => session.setDecimalMark(cycle(MARKS, s.decimalMark, by)),
  };
  return [mark, ...numbersRows(session)];
}

function numbersRows(session: Session): MenuItem[] {
  const s = session.settings;
  return NOTATION_MODES.flatMap((mode, i): MenuItem[] => {
    const tick: MenuItem = {
      id: mode,
      label: t(`settings.fmt.${mode}` as MessageKey),
      ...(i === 0 ? { hint: t("settings.fmtCycle.hint") } : {}),
      keep: true,
      get selected() {
        return s.fmtCycle.includes(mode);
      },
      run: () => session.setFmtMode(mode, !s.fmtCycle.includes(mode)),
    };
    if (mode !== "fix") return [tick];
    const decimals: MenuItem = {
      id: "decimals",
      label: t("mode.decimals"),
      keep: true,
      get value() {
        return String(s.fixDecimals);
      },
      adjust: (by) => session.setFixDecimals(s.fixDecimals + by),
    };
    return [tick, decimals];
  });
}

/** The press counter (R70, docs/04 5.2: every key tap, flick and screen tap) and the Shift and Alpha tap counter (R9,
 *  P7 point 4): the counts, since when, and a reset. Counted on this device only, never sent anywhere. The first four
 *  rows are information. */
function tapsItems(session: Session): MenuItem[] {
  const taps = session.taps;
  return [
    { id: "presses", label: t("settings.taps.presses"), keep: true, get value() { return String(taps.counts.presses); } },
    { id: "shift", label: t("settings.taps.shift"), keep: true, get value() { return String(taps.counts.shift); } },
    { id: "alpha", label: t("settings.taps.alpha"), keep: true, get value() { return String(taps.counts.alpha); } },
    { id: "since", label: t("settings.taps.since"), keep: true, get value() { return taps.counts.since || "—"; } },
    { id: "reset", label: t("settings.taps.reset"), keep: true, run: () => taps.reset() },
  ];
}
