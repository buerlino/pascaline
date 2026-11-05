// SPDX-License-Identifier: GPL-3.0-or-later
// R38a, R38b: the words of Settings › Data, the backup's notices and the restore. A table of its own, loaded with the
// Mode sheet's chunk (views/modeSheet.ts) and the backup code, so the start chunk does not carry it. English only so far.
export const enData = {
  "data": "Data",
  "data.value": "Backup",
  "backup.save": "Save a backup",
  "backup.saved": "Backup saved",
  "backup.offered": "Backup offered as a download",
  "backup.cancelled": "Backup cancelled",
  "backup.failed": "Could not save the backup",
  // R127: Settings › Counters › Export the counts
  "counts.saved": "Counts saved",
  "counts.offered": "Counts offered as a download",
  "counts.cancelled": "Counts cancelled",
  "counts.failed": "Could not save the counts",
  // R96: the store's state, the level's last row, with the last backup under it
  "store.kept": "Kept on this device",
  "store.mayDelete": "Kept, but the browser may delete it: save a backup",
  "store.notSaved": "Not saved: changes are lost when the app closes",
  "store.lastBackup": "Last backup: {date}",
  "store.lastOffered": "Last backup offered: {date}",
  // R38b: the restore (archive/r11-files.md section 3.4, 3.5)
  "restore.row": "Restore from a file",
  "restore.title": "Restore from a file",
  "restore.made": "Made {made} by version {version}",
  "restore.go": "Restore",
  "restore.cancel": "Cancel",
  "restore.none": "Tick at least one part",
  "restore.failed": "Could not restore the backup",
  "restore.undo": "Undo the restore ({time})",
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
  "part.presets": "Presets",
  "part.app.function": "Function app",
  "part.app.solve": "Solve app",
  "part.units.targets": "Unit targets",
  // R59: Settings › Data › Library (decisions.md S4, archive/r10-connector.md)
  "library": "Library",
  "library.value": "Import · Export",
  "library.import": "Import a library",
  "library.clipboard": "Import from the clipboard",
  "library.export": "Export the library",
  "library.format": "Copy the format for your AI",
  "library.imported": "Library imported: {added} new, {replaced} replaced, {same} unchanged; {tests} tests passed",
  "library.guard": "Tests run on plain Giac (radians, no exact-first): a guard, not a proof",
  "library.refused": "Library refused, nothing changed: {why}",
  "library.testsFailed": "tests failed: {list}",
  "library.clash": "Nothing changed: {n} of your own names would be replaced: {list}",
  "library.clashItem": "{name} (line {line})",
  "library.failure": "line {line}: {expr} gave {got}",
  "library.gaveError": "an error",
  "library.then": "{first}. {then}",
  "library.clashTitle": "Replace your own names?",
  "library.replace": "Replace and import",
  "library.cancel": "Cancel",
  "library.noEngine": "The library needs the engine, which is not running",
  "library.failed": "Could not import the library",
  "library.unreadable": "Could not read the file",
  "library.noClip": "Could not read the clipboard",
  "library.emptyClip": "The clipboard holds no text",
  "library.nothing": "No definitions to export",
  "library.saved": "Library saved",
  "library.offered": "Library offered as a download",
  "library.cancelled": "Library export cancelled",
  "library.saveFailed": "Could not save the library",
  "library.left": "{n} left out (assumptions, and decimals in the backup only): {list}",
  "library.formatCopied": "Format copied: paste it into your AI chat",
  "library.copyFailed": "Could not copy the format",
} as const;

export type DataKey = keyof typeof enData;

export function dataText(key: DataKey, vars?: Readonly<Record<string, string | number>>): string {
  const m: string = enData[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => String(vars[k] ?? all)) : m;
}

/** A time as Settings › Data and the restore sheet show it (R38b): local `YYYY-MM-DD HH:MM`, or the text itself when it
 *  is not a time. */
export function shownTime(t: string | number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
