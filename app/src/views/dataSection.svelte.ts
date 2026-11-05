// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data (R38a, R38b): Save a backup, Restore from a file, Undo the restore while its kept copy exists, and
// Library › (R59, libraryRows.ts). Each row runs and closes the sheet, so its notice shows in the stage. The last row
// (R96) tells whether the data is kept, with the date of the last backup under it. The backup and restore code loads on the press
// (clipboard/actions.svelte.ts); this module comes with the Mode sheet's chunk.
import type { MenuItem } from "../apps/types.ts";
import { dataText, shownTime, type DataKey } from "../i18n/enData.ts";
import { kvGet, storeHealth } from "../state/storage.ts";
import type { SettingsEnv } from "./yourKeys.ts";
import { librarySection } from "./libraryRows.ts";

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

/** R96: the browser's answer to persisted() (undefined until one came) and the times of the last backup this install
 *  saved (`backup.last`) and offered as a web download (`backup.offered`, R122: the browser does not say whether it
 *  saved it), both written by state/backup.ts (null: none), read again on each open of the level. */
let persisted = $state<boolean | undefined>(undefined);
let lastBackup = $state<string | null>(null);
let lastOffered = $state<string | null>(null);
function readStoreState(): void {
  void import("../state/persist.ts").then((m) => m.askPersisted()).then((a) => (persisted = a), () => {});
  void kvGet<string>("backup.last").then((r) => (lastBackup = r.kind === "value" ? r.value : null));
  void kvGet<string>("backup.offered").then((r) => (lastOffered = r.kind === "value" ? r.value : null));
}

/** The hint under the line: the newer of the last saved and the last offered backup (ISO times sort as text). */
function backupHint(): string | undefined {
  if (lastOffered !== null && (lastBackup === null || lastOffered > lastBackup)) return dataText("store.lastOffered", { date: shownTime(lastOffered) });
  return lastBackup === null ? undefined : dataText("store.lastBackup", { date: shownTime(lastBackup) });
}

/** The line (R96): not saved after a write that failed or a read that failed (R93), else kept, on this device only when
 *  the browser said it keeps the store out of its eviction. Before the first write it reads as kept. */
export function storeLine(): DataKey {
  const h = storeHealth();
  return h === "failed" || h === "unread" ? "store.notSaved" : persisted === true ? "store.kept" : "store.mayDelete";
}

function storeRow(): MenuItem {
  const hint = backupHint();
  return { id: "store", label: dataText(storeLine()), keep: true, ...(hint === undefined ? {} : { hint }) };
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
  rows.push(librarySection(env, pick), storeRow()); // R59: the library's four rows under one (Data keeps at most seven)
  return rows;
}

/** Settings' Data section: a row with › whose level reads the kept copy's time on every draw. Each open gets a level
 *  of its own (the sheet keeps the one it opened), whose first draw reads the store's state once (R96). */
export function dataSection(env: SettingsEnv, pick: () => Promise<File | null> = pickFile): MenuItem {
  const title = dataText("data");
  return {
    id: "data",
    label: title,
    value: dataText("data.value"),
    get submenu() {
      let read = false;
      return {
        title,
        remember: false,
        get items() {
          if (!read) {
            read = true;
            readStoreState();
          }
          return dataItems(env, pick);
        },
      };
    },
  };
}

/** Tests: forget the kept copy's time (it is read once per session). */
export function resetUndoTime(time?: number | null): void {
  undoTime = time;
  reading = time !== undefined;
}
