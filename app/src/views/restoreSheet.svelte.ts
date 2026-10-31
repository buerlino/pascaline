// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data › Restore from a file (R38b, archive/r11-files.md sections 3.4, 3.5): the picked file is checked as a
// whole (state/backup.ts checkBackup); a refusal is the notice. A good file opens a sheet with what it holds, one tick per
// part (all ticked), and Restore / Cancel; the sheet is the shell's, so keys, Esc and Android back (backLayer.ts) work as
// in every sheet. Restore replaces the ticked parts in one transaction and reloads. Loaded on the press only.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { dataText, shownTime } from "../i18n/enData.ts";
import { BACKUP_KEYS, checkBackup, MAX_BACKUP_BYTES, partName, type CheckedBackup } from "../state/backup.ts";
import { holdWrites, restoreParts, undoRestore } from "../state/restore.ts";

type Say = (message: string) => void;

/** What the restore does once Restore is picked; tests replace the store and the reload. */
export interface RestoreOps {
  write(parts: Readonly<Record<string, unknown>>, time: number): Promise<void>;
  reload(): void;
}
const live: RestoreOps = { write: restoreParts, reload: () => location.reload() };

const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});

/** A part's summary at the right of its row: rows per view, definitions, which settings and keys. */
export function partSummary(key: string, value: unknown): string | undefined {
  const v = obj(value);
  if (key === "history") {
    const n = (xs: unknown): number => (Array.isArray(xs) ? xs.length : 0);
    return dataText("restore.rows", { home: n(v["home"]), cas: n(v["cas"]) });
  }
  if (key === "defs") return dataText("restore.defs", { n: Array.isArray(value) ? value.length : 0 });
  if (key === "settings") {
    const up = (x: unknown): string | undefined => (typeof x === "string" ? x.toUpperCase() : undefined);
    const digits = typeof v["digits"] === "number" ? dataText("restore.digits", { n: v["digits"] }) : undefined;
    return [up(v["angle"]), digits, up(v["format"])].filter((x) => x !== undefined).join(" · ");
  }
  if (key === "userKeys") {
    const mark: Record<string, string> = { primary: "", shift: " ⇧", alpha: " α" };
    const which = Object.entries(v).flatMap(([id, slots]) => Object.keys(obj(slots)).map((l) => `${id.toUpperCase()}${mark[l] ?? ` ${l}`}`));
    return dataText("restore.keys", { n: which.length, which: which.join(", ") });
  }
  return undefined;
}

/** The sheet's rows: when and by which version, a tick per part in the backup's key order, then Restore and Cancel. */
export function restoreItems(b: CheckedBackup, say: Say, ops: RestoreOps = live): MenuItem[] {
  const keys = BACKUP_KEYS.filter((k) => k in b.parts);
  const ticked = $state<Record<string, boolean>>(Object.fromEntries(keys.map((k) => [k, true])));
  const chosen = (): string[] => keys.filter((k) => ticked[k]);
  return [
    { id: "made", label: dataText("restore.made", { made: shownTime(b.made), version: b.dataVersion }), keep: true },
    ...keys.map(
      (k): MenuItem => ({
        id: k,
        label: partName(k),
        keep: true,
        ...(partSummary(k, b.parts[k]) === undefined ? {} : { value: partSummary(k, b.parts[k]) as string }),
        get selected() {
          return ticked[k] === true;
        },
        run: () => void (ticked[k] = !ticked[k]),
      }),
    ),
    {
      id: "restore",
      label: dataText("restore.go"),
      get disabled() {
        return chosen().length === 0;
      },
      reason: dataText("restore.none"),
      run: () => void restore(Object.fromEntries(chosen().map((k) => [k, b.parts[k]])), say, ops),
    },
    { id: "cancel", label: dataText("restore.cancel"), run: () => {} },
  ];
}

/** Write the parts and reload; the session's own writes wait for the reload (restore.ts holdWrites). */
async function restore(parts: Record<string, unknown>, say: Say, ops: RestoreOps): Promise<void> {
  const release = holdWrites();
  try {
    await ops.write(parts, Date.now());
  } catch {
    release();
    say(dataText("restore.failed"));
    return;
  }
  ops.reload();
}

/** The picked file: refused with the check's message, else the sheet. */
export async function offerRestore(file: File, shell: AppShell, say: Say): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) return say(dataText("refuse.size")); // never read into memory
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return say(dataText("restore.failed"));
  }
  const checked = checkBackup(bytes);
  if (!checked.ok) return say(checked.message);
  shell.showMenu(dataText("restore.title"), restoreItems(checked, say), { remember: false });
}

/** Settings › Data › Undo the restore: the kept records go back, then the reload. */
export async function offerUndo(say: Say, ops: Pick<RestoreOps, "reload"> & { undo(): Promise<void> } = { undo: undoRestore, reload: live.reload }): Promise<void> {
  const release = holdWrites();
  try {
    await ops.undo();
  } catch {
    release();
    say(dataText("restore.undoFailed"));
    return;
  }
  ops.reload();
}
