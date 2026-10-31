// SPDX-License-Identifier: GPL-3.0-or-later
// R38a, R38b: the words of Settings › Data, the backup's notices and the restore. A table of its own, loaded with the
// Mode sheet's chunk (views/modeSheet.ts) and the backup code, so the start chunk does not carry it. English only so far.
export const enData = {
  "data": "Data",
  "data.value": "Backup",
  "backup.save": "Save a backup",
  "backup.saved": "Backup saved",
  "backup.cancelled": "Backup cancelled",
  "backup.failed": "Could not save the backup",
  // R38b: the restore (archive/r11-files.md section 3.4, 3.5)
  "restore.row": "Restore from a file",
  "restore.title": "Restore from a file",
  "restore.made": "Made {made} by version {version}",
  "restore.go": "Restore",
  "restore.cancel": "Cancel",
  "restore.none": "Tick at least one part",
  "restore.failed": "Could not restore the backup",
  "restore.undo": "Undo the restore ({time})",
  "restore.undone": "Restore undone",
  "restore.undoFailed": "Could not undo the restore",
  "restore.rows": "Home {home} · CAS {cas} rows",
  "restore.defs": "{n} definitions",
  "restore.keys": "{n} slots: {which}",
  "restore.digits": "{n} digits",
  "refuse.size": "Not a backup: the file is over 4 MB",
  "refuse.utf8": "Not a backup: the file is not text",
  "refuse.json": "Not a backup; a library is imported under Settings › Data",
  "refuse.envelope": "Not a Pascaline backup",
  "refuse.format": "Not a backup: its format number is broken",
  "refuse.newerFormat": "Made by a newer Pascaline (backup format {n}; this one reads up to {max})",
  "refuse.parts": "Not a backup: it holds no parts",
  "refuse.unknown": "{part}: a part this version does not know",
  "refuse.noStamp": "{part}: no version stamp or no value",
  "refuse.stamp": "{part}: a broken version stamp",
  "refuse.newer": "{part}: made by a newer Pascaline (version {v}; this one reads up to {max})",
  "refuse.invalid": "{part}: holds data this version cannot read",
  "part.settings": "Settings",
  "part.view": "Open view",
  "part.place": "Open app",
  "part.entry": "Entry line",
  "part.history": "History",
  "part.defs": "Definitions",
  "part.userKeys": "Your keys",
  "part.unitPadCells": "Unit pad cells",
  "part.taps": "Counters",
  "part.app.function": "Function app",
  "part.app.solve": "Solve app",
  "part.units.targets": "Unit targets",
  "part.units.history": "Unit history",
} as const;

export type DataKey = keyof typeof enData;

export function dataText(key: DataKey, vars?: Readonly<Record<string, string | number>>): string {
  const m: string = enData[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => String(vars[k] ?? all)) : m;
}
