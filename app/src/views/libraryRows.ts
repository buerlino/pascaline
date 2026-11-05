// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data › Library (R59, decisions.md S4): one row in Data (which keeps at most seven) whose level holds the
// four: Import a library (the file picker of the restore, S6), Import from the clipboard, Export the library, Copy the
// format for your AI. Not in the ☰ menu. Each row runs and closes the sheet, so its notice shows in the stage; the work
// loads on the press (ClipActions.library, views/libraryJobs.ts). Settings and the user-key slots are not in the file (S4).
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import type { SettingsEnv } from "./yourKeys.ts";

export function librarySection(env: SettingsEnv, pick: () => Promise<File | null>): MenuItem {
  const title = dataText("library");
  const items: MenuItem[] = [
    { id: "import", label: dataText("library.import"), run: () => void pick().then((f) => f && env.data?.((c) => c.library("file", f))) },
    { id: "clipboard", label: dataText("library.clipboard"), run: () => env.data?.((c) => c.library("clipboard")) },
    { id: "export", label: dataText("library.export"), run: () => env.data?.((c) => c.library("export")) },
    { id: "format", label: dataText("library.format"), run: () => env.data?.((c) => c.library("format")) },
  ];
  return { id: "library", label: title, value: dataText("library.value"), submenu: { title, remember: false, items } };
}
