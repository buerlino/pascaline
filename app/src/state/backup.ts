// SPDX-License-Identifier: GPL-3.0-or-later
// The backup (R11 section 3, docs/04 6.2): one JSON file with each stored key's record as stored, stamp included, and
// the check a restore runs on it before it writes anything (R38b, r11 section 3.4). Loaded only when the user saves or
// restores one (never in the start chunk).
import { validDefs } from "../engine/defs.ts";
import { dataText, enData, type DataKey } from "../i18n/enData.ts";
import { keyboard } from "../keyboard/keyboard.ts";
import { defaultLook, validLook } from "../theme/look.ts";
import { CELL_KEYS } from "../units/userCells.svelte.ts";
import { isFmtMode, normalizeCycle } from "./displayMode.ts";
import { DATA_VERSION, unstamp } from "./storage.ts";
import { kvGetRaw, type RawRecord } from "./storageRaw.ts";

/** The keys a backup holds (docs/04 6.2). A new key joins by being added here; the unit test fails until it is here or
 *  in LEFT_OUT. */
export const BACKUP_KEYS: readonly string[] = [
  "settings",
  "view",
  "place",
  "entry",
  "history",
  "defs",
  "userKeys",
  "unitPadCells",
  "taps",
  "app.function",
  "app.solve",
  "units.targets",
  "units.history",
];

/** Keys of docs/04 6.2 that stay out: `defsStarts` is per install (restored, it could make the engine skip the replay,
 *  G19); `backup.undo` (R38b) is the restore's own safety copy. */
export const LEFT_OUT: readonly string[] = ["defsStarts", "backup.undo"];

export interface Backup {
  "pascaline-backup": 1;
  dataVersion: number;
  made: string;
  parts: Record<string, RawRecord>;
}

/** The raw read the backup needs: the record as stored, or undefined. */
export type RawReader = (key: string) => Promise<RawRecord | undefined>;

/** The envelope with the parts that are present, in BACKUP_KEYS order. */
export async function makeBackup(read: RawReader, now: Date): Promise<Backup> {
  const parts: Record<string, RawRecord> = {};
  for (const key of BACKUP_KEYS) {
    const rec = await read(key);
    if (rec !== undefined) parts[key] = rec;
  }
  return { "pascaline-backup": 1, dataVersion: DATA_VERSION, made: now.toISOString(), parts };
}

/** `pascaline-backup-YYYY-MM-DD.json`, by the local date. */
export function backupName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `pascaline-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Settings › Data › Save a backup: makes the file, hands it to the file port, and returns the notice to show. */
export async function saveBackup(now: Date = new Date()): Promise<string> {
  try {
    const text = JSON.stringify(await makeBackup(kvGetRaw, now));
    const { saveFile } = await import("../clipboard/files.ts");
    const result = await saveFile(backupName(now), "application/json", text);
    return dataText(result === "saved" ? "backup.saved" : result === "cancelled" ? "backup.cancelled" : "backup.failed");
  } catch {
    return dataText("backup.failed");
  }
}

// ---- the restore's check (R38b, archive/r11-files.md section 3.4)

/** The file format this app reads (the envelope's own number; the parts carry their own stamps). */
export const BACKUP_FORMAT = 1;
/** A restore refuses a larger file: twice the worst case of r11 section 3.3, so a wrong pick (a video) is never read. */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const FORMAT = "pascaline-backup";
const STAMP = "@pascaline";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** JSON with sorted keys: two values are the same data whatever order their fields were written in. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (isObject(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const isCount = (n: unknown): boolean => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** Per key id and layer: null (an emptied slot) or a binding the reader keeps. */
function slotsOk(v: unknown, ids: readonly string[], layers: readonly string[], binding: (b: Record<string, unknown>) => boolean): boolean {
  if (!isObject(v)) return false;
  return Object.entries(v).every(
    ([id, slots]) => ids.includes(id) && isObject(slots) && Object.entries(slots).every(([l, b]) => layers.includes(l) && (b === null || (isObject(b) && binding(b)))),
  );
}
const text = (x: unknown): boolean => typeof x === "string" && x !== "";
const whole = (x: unknown, lo: number, hi: number): boolean => typeof x === "number" && Number.isInteger(x) && x >= lo && x <= hi;

// The start's readers live in the start chunk (session.svelte.ts, keyboard/userKeys.svelte.ts). An import of them from
// this lazy chunk makes the bundler split the start chunk into six files (59.09 → 60.62 kB gzip, measured in R38b), so
// the rules they apply are repeated here, as storageRaw.ts repeats storage.ts's constants, and restore.test.ts runs both
// on the same values and fails when they disagree. What needs no such import is used as it is (validLook,
// normalizeCycle, validDefs, the keyboard spec, CELL_KEYS).

/** session.svelte.ts HISTORY_LIMIT: rows kept per view. */
export const HISTORY_ROWS = 200;
/** keyboard/userKeys.svelte.ts USER_LAYERS. */
export const KEY_LAYERS: readonly string[] = ["primary", "shift", "alpha"];
/** The settings fields `migrateSettings` reads and the values it keeps as they are; any other value it resets. */
const SETTING_RULES: Readonly<Record<string, (x: unknown) => boolean>> = {
  angle: (x) => x === "rad" || x === "deg",
  format: (x) => x === "std" || x === "sci" || x === "eng" || x === "pfx",
  entry: (x) => x === "textbook" || x === "line",
  decimalMark: (x) => x === "point" || x === "comma",
  digits: (x) => whole(x, 1, 30), // MAX_DIGITS
  fixDecimals: (x) => whole(x, 0, 12),
  fmtCycle: (x) => Array.isArray(x) && canon(normalizeCycle(x.filter(isFmtMode))) === canon(x),
  haptics: (x) =>
    isObject(x) && Object.keys(x).length === 3 && typeof x["on"] === "boolean" && whole(x["strength"], 0, 100) && whole(x["ms"], 5, 100), // HAPTIC_MS_RANGE
  look: (x) => isObject(x) && canon(validLook(x, defaultLook())) === canon(x),
};

/** Each key's validator. */
export type Validators = Readonly<Record<string, (value: unknown) => boolean>>;

/**
 * The validators: for each key the check the app runs when it reads that key at start, made strict, so that a row or a
 * field the start would drop is a fault (a restore never loses data silently). Settings: `migrateSettings` keeps every
 * field the part holds. History: `restoreHistory`'s filter (finished rows with their LaTeX, at most HISTORY_LIMIT per
 * view). Definitions: the log's load check (`validDefs`) keeps every entry. Your keys and the unit pad cells: known keys
 * and layers, each slot null or a binding their reader keeps. The taps: their load check. Keys whose start reads field by
 * field with defaults (the apps, the place) and the units keys are checked by type.
 */
export const VALIDATORS: Validators = {
  settings: (v) => isObject(v) && Object.entries(SETTING_RULES).every(([k, ok]) => !(k in v) || ok(v[k])),
  view: (v) => v === "home" || v === "cas",
  place: isObject,
  entry: (v) => v === null || (isObject(v) && (v["view"] === "home" || v["view"] === "cas") && typeof v["latex"] === "string"),
  history: (v) =>
    isObject(v) &&
    (["home", "cas"] as const).every((view) => {
      const xs = v[view];
      return (
        xs === undefined ||
        (Array.isArray(xs) &&
          xs.length <= HISTORY_ROWS &&
          xs.every((i: unknown) => isObject(i) && (i["status"] === "done" || i["status"] === "error") && typeof i["latex"] === "string"))
      );
    }),
  defs: (v) => Array.isArray(v) && validDefs(v).length === v.length,
  userKeys: (v) =>
    slotsOk(
      v,
      keyboard.keys.filter((k) => k.user).map((k) => k.id), // USER_KEY_IDS
      KEY_LAYERS,
      (b) => text(b["label"]) && isObject(b["action"]),
    ),
  unitPadCells: (v) =>
    slotsOk(v, CELL_KEYS, ["tap", "up", "down"], (b) => text(b["unit"]) && (b["prefix"] === undefined || text(b["prefix"])) && (b["label"] === undefined || text(b["label"]))),
  taps: (v) => isObject(v) && isCount(v["shift"]) && isCount(v["alpha"]) && typeof v["since"] === "string" && (v["presses"] === undefined || isCount(v["presses"])),
  "app.function": isObject,
  "app.solve": isObject,
  "units.targets": (v) => typeof v === "object" && v !== null,
  "units.history": (v) => typeof v === "object" && v !== null,
};

/** A file that passed: its envelope's facts and each part's value, brought up to DATA_VERSION. */
export interface CheckedBackup {
  readonly ok: true;
  readonly made: string;
  readonly dataVersion: number;
  readonly parts: Readonly<Record<string, unknown>>;
}
/** A refused file: the message to show and the part it names, if any. */
export interface RefusedBackup {
  readonly ok: false;
  readonly message: string;
  readonly part?: string;
}

/** A part's name as the sheet and the messages show it. */
export const partName = (key: string): string => (`part.${key}` in enData ? dataText(`part.${key}` as DataKey) : key);

/**
 * r11 section 3.4, in order: the first fault refuses the whole file, with its message and the part it names, and
 * nothing is written. The probe's `check` (tools/probes/backup-file.mjs) plus step 5: each part through `unstamp` and
 * its key's validator (VALIDATORS; a key without one is refused).
 */
export function checkBackup(bytes: Uint8Array, validators: Validators = VALIDATORS): CheckedBackup | RefusedBackup {
  const no = (key: DataKey, part?: string, vars: Record<string, string | number> = {}): RefusedBackup => ({
    ok: false,
    message: dataText(key, { ...vars, ...(part === undefined ? {} : { part: partName(part) }) }),
    ...(part === undefined ? {} : { part }),
  });
  if (bytes.length > MAX_BACKUP_BYTES) return no("refuse.size");
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return no("refuse.utf8");
  }
  let f: unknown;
  try {
    f = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch {
    return no("refuse.json");
  }
  if (!isObject(f) || !(FORMAT in f)) return no("refuse.envelope");
  const format = f[FORMAT];
  if (typeof format !== "number" || !Number.isInteger(format) || format < 1) return no("refuse.format");
  if (format > BACKUP_FORMAT) return no("refuse.newerFormat", undefined, { n: format, max: BACKUP_FORMAT });
  const parts = f["parts"];
  if (!isObject(parts)) return no("refuse.parts");
  for (const [key, rec] of Object.entries(parts)) {
    if (!BACKUP_KEYS.includes(key)) return no("refuse.unknown", key);
    if (!isObject(rec) || !(STAMP in rec) || !("value" in rec)) return no("refuse.noStamp", key);
    const v = rec[STAMP];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return no("refuse.stamp", key);
    if (v > DATA_VERSION) return no("refuse.newer", key, { v, max: DATA_VERSION });
  }
  const values: Record<string, unknown> = {};
  for (const [key, rec] of Object.entries(parts)) {
    let value: unknown;
    try {
      value = unstamp(key, rec).value;
    } catch {
      return no("refuse.invalid", key); // a migration step that cannot read the value
    }
    if (!validators[key]?.(value)) return no("refuse.invalid", key);
    values[key] = value;
  }
  return { ok: true, made: typeof f["made"] === "string" ? f["made"] : "", dataVersion: typeof f["dataVersion"] === "number" ? f["dataVersion"] : 0, parts: values };
}
