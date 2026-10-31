// SPDX-License-Identifier: GPL-3.0-or-later
// R38a: the words of Settings › Data and of the backup's notices. A table of its own, loaded with the Mode sheet's chunk
// (views/modeSheet.ts) and the backup code, so the start chunk does not carry it. English only so far.
export const enData = {
  "data": "Data",
  "data.value": "Backup",
  "backup.save": "Save a backup",
  "backup.saved": "Backup saved",
  "backup.cancelled": "Backup cancelled",
  "backup.failed": "Could not save the backup",
} as const;

export type DataKey = keyof typeof enData;

export function dataText(key: DataKey): string {
  return enData[key];
}
