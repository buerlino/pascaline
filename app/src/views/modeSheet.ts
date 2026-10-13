// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet and Settings (docs/05 3.4 with section 7), as lists for the one sheet (sheet.svelte.ts). Mode holds
// what changes in a session: angle, format, digits, decimals, entry. Settings holds what is set once: the Format key's
// cycle and the key vibration. A row with a value is changed in place: ◀ ▶ step it, a digit key or a tap steps it
// forward, Enter closes. No native <select> or number input: the keypad drives all of it.
import type { MenuItem } from "../apps/types.ts";
import type { AngleUnit, NumberFormat } from "../calc/port.ts";
import { t, type MessageKey } from "../i18n/index.ts";
import { hasStrength } from "../input/haptics.ts";
import { NOTATION_MODES } from "../state/displayMode.ts";
import { MAX_DIGITS, type EntryMode, type Session } from "../state/session.svelte.ts";

const ANGLES: readonly AngleUnit[] = ["rad", "deg"];
const FORMATS: readonly NumberFormat[] = ["std", "sci", "eng", "pfx"];
const ENTRIES: readonly EntryMode[] = ["textbook", "line"];
/** The values the digits and decimals rows offer when picked (◀ ▶ reach every other one). */
const DIGITS_PRESETS: readonly number[] = [4, 6, 8, 10, 12, 15, 20, 25, MAX_DIGITS];
const DECIMALS_PRESETS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12];

/** The value after `by` steps from `now`, round the ends. */
function cycle<T>(all: readonly T[], now: T, by: 1 | -1): T {
  const i = all.indexOf(now);
  return all[(i + by + all.length) % all.length] as T;
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
export function modeItems(session: Session, openSettings: () => void): MenuItem[] {
  const s = session.settings;
  return [
    {
      id: "angle",
      label: t("mode.angle"),
      get value() {
        return t(`angle.${s.angle}`);
      },
      adjust: (by) => session.setAngle(cycle(ANGLES, s.angle, by)),
    },
    {
      id: "format",
      label: t("mode.format"),
      get value() {
        return t(`format.${s.format}`);
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
      id: "decimals",
      label: t("mode.decimals"),
      get value() {
        return String(s.fixDecimals);
      },
      adjust: (by) => session.setFixDecimals(s.fixDecimals + by),
      submenu: { title: t("mode.decimals"), items: presets(DECIMALS_PRESETS, () => s.fixDecimals, (n) => session.setFixDecimals(n)) },
    },
    {
      id: "entry",
      label: t("mode.entry"),
      get value() {
        return t(`entry.${s.entry}`);
      },
      adjust: (by) => session.setEntry(cycle(ENTRIES, s.entry, by)),
    },
    { id: "settings", label: t("mode.settings"), run: openSettings },
  ];
}

/** The Settings sheet's rows. */
export function settingsItems(session: Session): MenuItem[] {
  const s = session.settings;
  const off = () => !s.haptics.on;
  const strengthAvailable = hasStrength();
  return [
    {
      id: "fmtCycle",
      label: t("settings.fmtCycle"),
      submenu: {
        title: t("settings.fmtCycle"),
        items: NOTATION_MODES.map((mode) => ({
          id: mode,
          label: t(`settings.fmt.${mode}` as MessageKey),
          keep: true,
          get selected() {
            return s.fmtCycle.includes(mode);
          },
          run: () => session.setFmtMode(mode, !s.fmtCycle.includes(mode)),
        })),
      },
    },
    {
      id: "haptics",
      label: t("settings.haptics"),
      get value() {
        return t(s.haptics.on ? "settings.on" : "settings.off");
      },
      adjust: () => session.setHaptics({ on: !s.haptics.on }),
    },
    {
      id: "strength",
      label: t("settings.haptics.strength"),
      get value() {
        return `${s.haptics.strength} %`;
      },
      get disabled() {
        return off() || !strengthAvailable;
      },
      get reason() {
        return off() ? t("settings.haptics.off") : t("settings.haptics.webNote");
      },
      adjust: (by) => session.setHaptics({ strength: s.haptics.strength + 10 * by }),
    },
    {
      id: "ms",
      label: t("settings.haptics.ms"),
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
    tapsItem(session),
  ];
}

/** The Shift and Alpha tap counter (R9, P7 point 4): the counts, since when, and a reset. Counted on this device only,
 *  never sent anywhere. */
function tapsItem(session: Session): MenuItem {
  const taps = session.taps;
  const counts = (): { shift: string; alpha: string } => ({ shift: String(taps.counts.shift), alpha: String(taps.counts.alpha) });
  return {
    id: "taps",
    label: t("settings.taps"),
    get value() {
      return t("settings.taps.value", counts());
    },
    submenu: {
      title: t("settings.taps"),
      items: [
        // information rows: picking one does nothing (the sheet stays)
        { id: "shift", label: t("settings.taps.shift"), keep: true, get value() { return counts().shift; } },
        { id: "alpha", label: t("settings.taps.alpha"), keep: true, get value() { return counts().alpha; } },
        { id: "since", label: t("settings.taps.since"), keep: true, get value() { return taps.counts.since || "—"; } },
        { id: "reset", label: t("settings.taps.reset"), keep: true, run: () => taps.reset() },
      ],
    },
  };
}

