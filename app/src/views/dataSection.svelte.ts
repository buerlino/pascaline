// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data (R38a, R38b): Save a backup, Restore from a file, and Undo the restore while its kept copy exists. Each
// row runs and closes the sheet, so its notice shows in the stage. The backup and restore code loads on the press
// (clipboard/actions.svelte.ts); this module comes with the Mode sheet's chunk.
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import type { SettingsEnv } from "./yourKeys.ts";

/** The time of the kept copy (`backup.undo`): undefined until read, null when there is none. A restore and an Undo
 *  both reload the page, so it is read once per session, when the section is first drawn. */
let undoTime = $state<number | null | undefined>(undefined);
let reading = false;
function readUndoTime(): void {
  if (reading) return;
  reading = true;
  void import("../state/restore.ts")
    .then((m) => m.readUndo())
    .then((u) => (undoTime = u?.time ?? null))
    .catch(() => (undoTime = null));
}

/**
 * The file picker: a hidden `<input type="file">` with no `accept` (a backup that came through Drive is often typed
 * `application/octet-stream`; the check refuses what is not a backup, r11 section 2), clicked in the row's own press so
 * the browser opens it. It is never focused (display: none), so no text field takes the focus on the way back (R22).
 * Resolves with the file, or null when the picker was cancelled.
 */
export function pickFile(doc: Document = document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement("input");
    input.type = "file";
    input.style.display = "none";
    const done = (f: File | null): void => {
      input.remove();
      resolve(f);
    };
    input.addEventListener("change", () => done(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => done(null));
    doc.body.append(input);
    input.click();
  });
}

function dataItems(env: SettingsEnv, pick: () => Promise<File | null>): MenuItem[] {
  if (undoTime === undefined) readUndoTime();
  const rows: MenuItem[] = [
    { id: "backup", label: dataText("backup.save"), run: () => env.data?.((c) => c.saveBackup()) },
    {
      id: "restore",
      label: dataText("restore.row"),
      run: () => void pick().then((f) => f && env.data?.((c) => c.restoreBackup(f))),
    },
  ];
  if (typeof undoTime === "number") {
    const time = undoTime;
    rows.push({ id: "undo", label: dataText("restore.undo", { time: shownTime(time) }), run: () => env.data?.((c) => c.restoreBackup("undo")) });
  }
  return rows;
}

/** A time as the Data rows and the restore sheet show it: local `YYYY-MM-DD HH:MM`, or the text itself when it is not
 *  a time. */
export function shownTime(t: string | number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Settings' Data section: a row with › whose level reads the kept copy's time on every draw. */
export function dataSection(env: SettingsEnv, pick: () => Promise<File | null> = pickFile): MenuItem {
  const title = dataText("data");
  return {
    id: "data",
    label: title,
    value: dataText("data.value"),
    submenu: {
      title,
      remember: false,
      get items() {
        return dataItems(env, pick);
      },
    },
  };
}

/** Tests: forget the kept copy's time (it is read once per session). */
export function resetUndoTime(time?: number | null): void {
  undoTime = time;
  reading = time !== undefined;
}
